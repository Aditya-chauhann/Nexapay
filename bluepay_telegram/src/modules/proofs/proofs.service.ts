import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Proof, ProofDocument, ProofStatus } from './schemas/proof.schema';
import { CloudinaryService } from './cloudinary.service';
import { OcrService } from './ocr.service';
import { BlurService } from './blur.service';
import { PayoutRequestsService } from '../payout-requests/payout-requests.service';
import { PayoutRequestDocument } from '../payout-requests/schemas/payout-request.schema';
import { CallbacksService } from '../callbacks/callbacks.service';
import { TelegramService } from '../telegram/telegram.service';
import { MatchingService } from '../matching/matching.service';
import { DailyLogger } from '../../common/daily-logger';

export interface IncomingScreenshot {
  imageUrl: string;
  caption: string;
  groupChatId: number;
  groupTitle: string | null;
  telegramMessageId: string;
  telegramFileId: string;
  senderId: string | null;
  senderUsername: string | null;
}

// Matches a UPI VPA like "name@bank" inside free text.
const UPI_REGEX = /[a-z0-9.\-_]{2,}@[a-z]{2,}/i;

@Injectable()
export class ProofsService {
  private readonly logger = new Logger(ProofsService.name);

  constructor(
    @InjectModel(Proof.name) private readonly model: Model<ProofDocument>,
    private readonly cloudinary: CloudinaryService,
    private readonly ocr: OcrService,
    private readonly blur: BlurService,
    @Inject(forwardRef(() => PayoutRequestsService))
    private readonly payoutRequests: PayoutRequestsService,
    private readonly callbacks: CallbacksService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegram: TelegramService,
    @Inject(forwardRef(() => MatchingService))
    private readonly matching: MatchingService,
  ) { }

  /**
   * Mini App upload path: the claimer uploaded the payment screenshot privately
   * (never posted to the group). We know the exact payout from `referenceId` and
   * the claimer from the verified Telegram user, so we bind directly — no UPI/OCR
   * guessing, no blur/repost. Stores the image, fulfils the request, marks the
   * announcement Paid, and calls back to TronPay.
   */
  async fulfilFromMiniApp(
    referenceId: string,
    imageBuffer: Buffer,
    telegramUserId: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const req = await this.payoutRequests.findByRef(referenceId);
    if (!req || req.status !== 'announced') {
      return { ok: false, reason: 'This payout is no longer awaiting proof.' };
    }
    if (!req.claimedBy || req.claimedBy !== telegramUserId) {
      return {
        ok: false,
        reason: 'Only the person who tapped "Pay Now" can upload the proof.',
      };
    }

    const hostedUrl = await this.cloudinary.uploadBuffer(imageBuffer);
    const ocr = await this.ocr.extract(imageBuffer).catch(() => null);
    const extracted = (ocr ?? { text: '' }) as unknown as Record<string, unknown>;
    DailyLogger.log('ocr findings', JSON.stringify(ocr))
    // Validate the extracted data before fulfilling the payout.
    if (!ocr || ocr.is_payment_screenshot === false) {
      DailyLogger.warn(`Mini App proof rejected for ref=${referenceId}: image is not a payment screenshot.`, 'ProofsService');
      await this.reofferWithGroupNotice(req, ocr, 'Not a payment screenshot', 'The uploaded image is not a valid UPI payment screenshot.', imageBuffer);
      return { ok: false, reason: 'The uploaded image does not appear to be a payment screenshot.' };
    }
    if (ocr.status === 'FAILED') {
      DailyLogger.warn(`Mini App proof rejected for ref=${referenceId}: screenshot shows a FAILED payment.`, 'ProofsService');
      await this.reofferWithGroupNotice(req, ocr, 'Payment status is FAILED', 'The screenshot shows a failed payment. Please complete the payment and retry.', imageBuffer);
      return { ok: false, reason: 'The screenshot shows a failed payment. Please upload a successful payment screenshot.' };
    }
    if (ocr.status === 'PENDING') {
      DailyLogger.warn(`Mini App proof rejected for ref=${referenceId}: screenshot shows a PENDING payment.`, 'ProofsService');
      await this.reofferWithGroupNotice(req, ocr, 'Payment status is PENDING', 'The payment has not been confirmed yet. Please wait for success and retry.', imageBuffer);
      return { ok: false, reason: 'The screenshot shows a pending payment. Please wait for it to succeed before uploading.' };
    }
    if (ocr.amount === null) {
      DailyLogger.warn(`Mini App proof rejected for ref=${referenceId}: could not extract a valid amount from the screenshot (status=${ocr.status}).`, 'ProofsService');
      await this.reofferWithGroupNotice(req, ocr, 'Amount unreadable', 'Could not extract the payment amount. Please upload a clearer screenshot.', imageBuffer);
      return { ok: false, reason: 'Could not read the payment amount from the screenshot. Please ensure the screenshot clearly shows the payment amount.' };
    }

    const proof = await this.model.create({
      imageUrl: hostedUrl,
      caption: '',
      upiId: req.upiId,
      amount: ocr.amount ?? null,
      extracted,
      status: ProofStatus.Matched,
      matchedReferenceId: req.referenceId,
      groupChatId: req.groupChatId,
      senderId: telegramUserId,
    });

    const matched = await this.payoutRequests.fulfilAnnouncedByRef(
      req.referenceId,
      proof._id as Types.ObjectId,
    );
    if (!matched) {
      return { ok: false, reason: 'This payout was just settled elsewhere.' };
    }

    // Overpayment/partial payment guard — use screenshot OCR amount if valid.
    const ocrAmount = ocr.amount ?? proof.amount ?? null;
    const requestedAmount = matched.requestedAmount;
    const paidAmount =
      typeof ocrAmount === 'number' && ocrAmount > 0
        ? ocrAmount
        : matched.matchedAmount ?? requestedAmount;

    // Mark the announcement Paid/Partial + strip buttons.
    if (matched.groupChatId != null && matched.announcementMessageId) {
      await this.telegram.markAnnouncementPaid(
        matched.groupChatId,
        Number(matched.announcementMessageId),
        matched,
        paidAmount,
      );
    }

    const { screenshotAmount, overpaidBy } = await this.flagOverpaymentIfAny(
      matched,
      proof,
      ocrAmount,
      { senderId: telegramUserId, senderUsername: null },
    );

    await this.callbacks.notifyPaid({
      referenceId: matched.referenceId,
      requestedAmount,
      paidAmount,
      differenceInr: requestedAmount - paidAmount,
      upiId: matched.upiId,
      imageUrl: hostedUrl,
      blurredImageUrl: null, // Will be generated asynchronously
      extracted,
      telegram: {
        groupChatId: matched.groupChatId ?? 0,
        messageId: '',
        senderId: telegramUserId,
        senderUsername: null,
      },
      screenshotAmount,
      overpaidBy,
    });

    this.logger.log(
      `Mini App proof for ref ${referenceId} by tg-user ${telegramUserId} — fulfilled.`,
    );
    DailyLogger.log(`Mini App proof for ref ${referenceId} by tg-user ${telegramUserId} — fulfilled.`, 'ProofsService');

    // Post a BLURRED copy of the proof into the group for the record. 
    // Done asynchronously so it doesn't block the Mini App's HTTP response.
    if (matched.groupChatId != null) {
      const groupChatId = matched.groupChatId;
      void (async () => {
        try {
          const blurred = await this.blur.blur(imageBuffer);
          const blurredMsgId = await this.telegram.sendPhoto(
            groupChatId,
            blurred,
            `🔒 Proof for ${matched.referenceId}`,
            true,
            matched.announcementMessageId ? Number(matched.announcementMessageId) : undefined,
          );
          proof.blurredMessageId = blurredMsgId;
          try {
            await this.cloudinary.uploadBuffer(blurred);
          } catch {
            /* storage optional */
          }
          await proof.save();
        } catch (err) {
          this.logger.error('Mini App blur/repost failed', err as Error);
        }
      })();
    }

    return { ok: true };
  }

  async handleIncomingScreenshot(input: IncomingScreenshot): Promise<void> {
    // 1. Download the image bytes once — reused for storage, OCR and blur.
    let imageBuffer: Buffer | null = null;
    try {
      const res = await fetch(input.imageUrl);
      imageBuffer = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      this.logger.error('Failed to download Telegram image', err as Error);
    }

    // 2. Store the clear image (TronPay keeps this for dispute records).
    let hostedUrl = input.imageUrl;
    if (imageBuffer) {
      try {
        hostedUrl = await this.cloudinary.uploadBuffer(imageBuffer);
      } catch {
        this.logger.warn('Cloudinary not configured/failed; using source url');
      }
    }

    // 3. OCR extraction.
    const ocr = imageBuffer
      ? await this.ocr.extract(imageBuffer)
      : { amount: null, utr: null, upiId: null, text: '', is_payment_screenshot: false, status: 'UNKNOWN' };

    // Validate: reject FAILED or PENDING payment screenshots immediately —
    // send a structured rejection notice in the group (with blurred image) and do not attempt to match.
    if (ocr.is_payment_screenshot === false) {
      DailyLogger.warn(`Group screenshot rejected in group=${input.groupChatId} from sender=${input.senderId ?? '?'}: not a payment screenshot.`, 'ProofsService');
      await this.handleInvalidGroupScreenshot(
        input,
        ocr,
        'Not a payment screenshot',
        'The uploaded image is not a valid UPI payment screenshot. Please upload a valid payment screenshot.',
        imageBuffer ?? undefined,
      );
      return;
    }
    if (ocr.status === 'FAILED') {
      DailyLogger.warn(`Group screenshot rejected in group=${input.groupChatId} from sender=${input.senderId ?? '?'}: screenshot shows FAILED payment.`, 'ProofsService');
      await this.handleInvalidGroupScreenshot(
        input,
        ocr,
        'Payment status is FAILED',
        'The screenshot shows a failed payment. Please complete the payment successfully and upload the correct screenshot.',
        imageBuffer ?? undefined,
      );
      return;
    }
    if (ocr.status === 'PENDING') {
      DailyLogger.warn(`Group screenshot rejected in group=${input.groupChatId} from sender=${input.senderId ?? '?'}: screenshot shows PENDING payment.`, 'ProofsService');
      await this.handleInvalidGroupScreenshot(
        input,
        ocr,
        'Payment status is PENDING',
        'The payment has not been confirmed yet. Please wait for the payment to succeed before uploading.',
        imageBuffer ?? undefined,
      );
      return;
    }

    // 4. UPI id comes primarily from the typed caption, OCR as fallback.
    const captionUpi = input.caption.match(UPI_REGEX)?.[0] ?? null;
    const upiId = (captionUpi ?? ocr.upiId)?.toLowerCase() ?? null;

    const extracted: Record<string, unknown> = {
      ...ocr,
    };
    this.logger.log(
      `Proof in group ${input.groupChatId} -> upi=${upiId ?? 'NONE'} ` +
      `(captionUpi=${captionUpi ?? 'none'}, ocrAmount=${ocr.amount ?? 'none'})`,
    );
    DailyLogger.log(`Proof in group ${input.groupChatId} -> upi=${upiId ?? 'NONE'} (captionUpi=${captionUpi ?? 'none'}, ocrAmount=${ocr.amount ?? 'none'})`, 'ProofsService');

    // 5. Persist the proof first (audit trail).
    const proof = await this.model.create({
      imageUrl: hostedUrl,
      caption: input.caption,
      upiId,
      amount: ocr.amount,
      extracted,
      status: ProofStatus.Unmatched,
      groupChatId: input.groupChatId,
      groupTitle: input.groupTitle,
      telegramMessageId: input.telegramMessageId,
      telegramFileId: input.telegramFileId,
      senderId: input.senderId,
      senderUsername: input.senderUsername,
    });

    // 6. Need the UPI to match anything.
    if (!upiId) {
      this.logger.warn(`Proof ${proof._id.toString()} has no UPI — unmatched`);
      DailyLogger.warn(`Proof ${proof._id.toString()} has no UPI — unmatched`, 'ProofsService');
      return;
    }

    // 7. Match to the oldest announced request for this UPI in THIS group.
    const matched = await this.payoutRequests.fulfilAnnouncedByUpi(
      upiId,
      input.groupChatId,
      proof._id as Types.ObjectId,
    );
    if (!matched) {
      this.logger.log(
        `No announced request for upi=${upiId} in group ${input.groupChatId} — unmatched`,
      );
      DailyLogger.log(`No announced request for upi=${upiId} in group ${input.groupChatId} — unmatched`, 'ProofsService');
      return;
    }

    proof.status = ProofStatus.Matched;
    proof.matchedReferenceId = matched.referenceId;

    const requestedAmount = matched.requestedAmount;
    const paidAmount =
      typeof ocr.amount === 'number' && ocr.amount > 0
        ? ocr.amount
        : matched.matchedAmount ?? requestedAmount;

    // Paid now — strip the claim buttons (Decline) from the announcement.
    if (matched.announcementMessageId && matched.groupChatId != null) {
      await this.telegram.markAnnouncementPaid(
        matched.groupChatId,
        Number(matched.announcementMessageId),
        matched,
        paidAmount,
      );
    }

    // 8. Blur the original in the group (delete + repost blurred).
    let blurredUrl: string | null = null;
    if (imageBuffer) {
      try {
        const blurred = await this.blur.blur(imageBuffer);
        await this.telegram.deleteMessage(
          input.groupChatId,
          Number(input.telegramMessageId),
        );
        const blurredMsgId = await this.telegram.sendPhoto(
          input.groupChatId,
          blurred,
          `🔒 Proof for ${matched.referenceId}`,
          false,
          matched.announcementMessageId ? Number(matched.announcementMessageId) : undefined,
        );
        proof.blurredMessageId = blurredMsgId;
        try {
          blurredUrl = await this.cloudinary.uploadBuffer(blurred);
        } catch {
          /* storage optional */
        }
      } catch (err) {
        this.logger.error('Blur/repost failed', err as Error);
      }
    }
    await proof.save();

    // 8b. Overpayment guard — flag + alert if the screenshot shows more than
    // the announced amount. Does not change the settled amount below.
    const { screenshotAmount, overpaidBy } = await this.flagOverpaymentIfAny(
      matched,
      proof,
      ocr.amount,
      { senderId: input.senderId, senderUsername: input.senderUsername },
    );

    // 9. Richer settlement callback to TronPay.
    await this.callbacks.notifyPaid({
      referenceId: matched.referenceId,
      requestedAmount,
      paidAmount,
      differenceInr: requestedAmount - paidAmount,
      upiId: matched.upiId,
      imageUrl: hostedUrl,
      blurredImageUrl: blurredUrl,
      extracted,
      telegram: {
        groupChatId: input.groupChatId,
        messageId: input.telegramMessageId,
        senderId: input.senderId,
        senderUsername: input.senderUsername,
      },
      screenshotAmount,
      overpaidBy,
    });
  }

  /**
   * Overpayment guard: if the OCR-read screenshot amount is GREATER than the
   * announced amount the payer was asked to send, tag the proof and alert the
   * LP with detail in the chat.
   */
  private async flagOverpaymentIfAny(
    matched: PayoutRequestDocument,
    proof: ProofDocument,
    ocrAmount: number | null,
    sender: { senderId: string | null; senderUsername: string | null },
  ): Promise<{ screenshotAmount: number | null; overpaidBy: number | null }> {
    const expected = matched.matchedAmount ?? matched.requestedAmount;
    if (typeof ocrAmount !== 'number' || ocrAmount <= expected) {
      return { screenshotAmount: null, overpaidBy: null };
    }

    const overpaidBy = ocrAmount - expected;
    proof.amountMismatch = 'overpaid';
    proof.screenshotAmount = ocrAmount;
    proof.expectedAmount = expected;
    await proof.save();

    if (matched.groupChatId != null) {
      const payer = sender.senderUsername
        ? `@${sender.senderUsername}`
        : sender.senderId
          ? `tg://user?id=${sender.senderId}`
          : 'Sender';

      const text =
        `⚠️ Overpayment detected\n` +
        `Ref: ${matched.referenceId}\n` +
        `Announced: ₹${expected}\n` +
        `Screenshot: ₹${ocrAmount}\n` +
        `Extra paid: ₹${overpaidBy}\n` +
        `UPI: ${matched.upiId}\n` +
        `Paid by: ${payer}`;
      await this.telegram.sendGroupMessage(matched.groupChatId, text);
    }

    this.logger.warn(
      `Overpayment on ref ${matched.referenceId}: announced ₹${expected}, ` +
      `screenshot ₹${ocrAmount} (+₹${overpaidBy})`,
    );
    DailyLogger.warn(`Overpayment on ref ${matched.referenceId}: announced ₹${expected}, screenshot ₹${ocrAmount} (+₹${overpaidBy})`, 'ProofsService');

    return { screenshotAmount: ocrAmount, overpaidBy };
  }

  /**
   * Re-offers the payout (releases LP's claim) and posts a structured HTML
   * rejection notice to the Telegram group — matching the success message format.
   * Blur and post the invalid screenshot if imageBuffer is provided.
   */
  private async reofferWithGroupNotice(
    req: PayoutRequestDocument,
    ocr: { amount?: number | null; upiId?: string | null; status?: string } | null,
    reason: string,
    detail: string,
    imageBuffer?: Buffer,
  ): Promise<void> {
    try {
      await this.matching.reoffer(req.referenceId, 'invalid-screenshot');
    } catch (err) {
      this.logger.warn(`reofferWithGroupNotice: reoffer failed for ref=${req.referenceId}: ${(err as Error).message}`);
    }
    if (req.groupChatId != null) {
      const text = this.buildInvalidScreenshotHtml({
        referenceId: req.referenceId,
        upiId: req.upiId,
        requestedAmount: req.matchedAmount ?? req.requestedAmount ?? null,
        ocrAmount: ocr?.amount ?? null,
        ocrStatus: ocr?.status ?? 'UNKNOWN',
        reason,
        detail,
      });

      const replyToId = req.announcementMessageId ? Number(req.announcementMessageId) : undefined;
      if (imageBuffer) {
        try {
          await this.telegram.sendPhoto(req.groupChatId, imageBuffer, text, false, replyToId);
          return;
        } catch (err) {
          this.logger.error('Failed to send clear photo notice for Mini App rejection', err as Error);
        }
      }

      // Fallback if no buffer or sending photo fails
      await this.telegram.sendGroupMessage(req.groupChatId, text, 'HTML', replyToId);
    }
  }

  private async handleInvalidGroupScreenshot(
    input: IncomingScreenshot,
    ocr: { amount?: number | null; upiId?: string | null; status?: string } | null,
    reason: string,
    detail: string,
    imageBuffer?: Buffer,
  ): Promise<void> {
    let replyToMessageId: number | undefined = undefined;
    let referenceId: string | null = null;
    let expectedAmount: number | null = null;

    // Look up matching announcement by UPI in this group to thread the reply
    if (ocr?.upiId) {
      try {
        const activeAnnounce = await this.payoutRequests.findAnnouncedByUpi(ocr.upiId, input.groupChatId);
        if (activeAnnounce) {
          referenceId = activeAnnounce.referenceId;
          expectedAmount = activeAnnounce.matchedAmount ?? activeAnnounce.requestedAmount ?? null;
          if (activeAnnounce.announcementMessageId) {
            replyToMessageId = Number(activeAnnounce.announcementMessageId);
          }
          // Release their claim immediately and edit the announcement message text
          await this.matching.reoffer(activeAnnounce.referenceId, 'invalid-screenshot');
        }
      } catch (err) {
        this.logger.warn(`Failed lookup or reoffer for invalid ss: ${(err as Error).message}`);
      }
    }

    const text = this.buildInvalidScreenshotHtml({
      referenceId,
      upiId: ocr?.upiId ?? null,
      requestedAmount: expectedAmount,
      ocrAmount: ocr?.amount ?? null,
      ocrStatus: ocr?.status ?? 'UNKNOWN',
      reason,
      detail,
    });

    if (imageBuffer) {
      try {
        // Delete the clear screenshot from the group
        await this.telegram.deleteMessage(
          input.groupChatId,
          Number(input.telegramMessageId),
        );
        // Send the unblurred screenshot with the rejection text as caption, replying to original announcement
        await this.telegram.sendPhoto(input.groupChatId, imageBuffer, text, false, replyToMessageId);
        return;
      } catch (err) {
        this.logger.error('Failed to send clear photo reply for invalid group screenshot', err as Error);
      }
    }

    // Fallback if no buffer or sending photo fails
    await this.telegram.sendGroupMessage(input.groupChatId, text, 'HTML', replyToMessageId);
  }

  /**
   * Builds a structured HTML rejection message that mirrors the success
   * announcement format: status badge, reason, payout details, and footer.
   */
  private buildInvalidScreenshotHtml(params: {
    referenceId: string | null;
    upiId: string | null;
    requestedAmount: number | null;
    ocrAmount: number | null;
    ocrStatus: string;
    reason: string;
    detail: string;
  }): string {
    const { referenceId, upiId, requestedAmount, ocrAmount, ocrStatus, reason, detail } = params;

    const statusIcon = ocrStatus === 'FAILED' ? '❌' : ocrStatus === 'PENDING' ? '⏳' : '🚫';
    const statusLabel = ocrStatus === 'FAILED' ? 'FAILED' : ocrStatus === 'PENDING' ? 'PENDING' : 'INVALID';

    let text = `${statusIcon} <b>Screenshot Rejected — ${reason}</b>\n`;

    if (referenceId) {
      text += `Ref: <code>${referenceId}</code>\n`;
    }
    if (upiId) {
      text += `UPI: <code>${upiId}</code>\n`;
    }
    if (requestedAmount != null) {
      text += `Expected Amount: ₹${requestedAmount.toLocaleString('en-IN')}\n`;
    }
    if (ocrAmount != null) {
      text += `Detected Amount: ₹${ocrAmount.toLocaleString('en-IN')}\n`;
    }
    text += `Detected Status: <b>${statusLabel}</b>\n`;
    text += `\n<i>${detail}</i>`;

    if (referenceId) {
      text += `\n\n<i>ℹ️ Payout has been re-offered. Another LP may now claim it.</i>`;
    }

    return text;
  }
}
