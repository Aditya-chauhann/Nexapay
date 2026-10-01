import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { DailyLogger } from '../../common/daily-logger';

export interface PaidCallbackPayload {
  referenceId: string;
  // What the user requested (net INR).
  requestedAmount: number;
  // What the matched buyer actually paid (the offer amount).
  paidAmount: number;
  // requestedAmount - paidAmount (signed: + underpaid, - overpaid).
  differenceInr: number;
  // --- Overpayment tag (payer's screenshot shows MORE than announced) ---
  // These are informational only: they do NOT feed into TronPay's balance
  // reconciliation (which uses paidAmount). `overpaidBy` is the positive extra
  // amount (screenshotAmount - announced); both null when no overpayment.
  screenshotAmount?: number | null;
  overpaidBy?: number | null;
  upiId: string;
  imageUrl: string;
  blurredImageUrl: string | null;
  extracted: Record<string, unknown>;
  telegram: {
    groupChatId: number;
    messageId: string;
    senderId: string | null;
    senderUsername: string | null;
  };
}

/**
 * Outbound: this service -> TronPay. Tells TronPay a reference has been paid.
 * The body is HMAC-signed with a shared secret so TronPay can verify the call
 * genuinely came from us before opening the dispute modal for the user.
 */
@Injectable()
export class CallbacksService {
  private readonly logger = new Logger(CallbacksService.name);

  constructor(private readonly config: ConfigService) {}

  async notifyPaid(payload: PaidCallbackPayload): Promise<void> {
    const url = this.config.get<string>('callback.url');
    const secret = this.config.get<string>('callback.signingSecret') ?? '';
    if (!url) {
      this.logger.warn('TRONPAY_CALLBACK_URL not set — skipping callback');
      return;
    }

    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', secret).update(body).digest('hex');

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signature,
        },
        body,
      });
      if (!res.ok) {
        this.logger.error(
          `Callback to TronPay failed: ${res.status} for ref ${payload.referenceId}`,
        );
        DailyLogger.error(`Paid callback to TronPay FAILED: ref=${payload.referenceId}, paidAmount=${payload.paidAmount}, status=${res.status}`, undefined, 'CallbacksService');
      } else {
        this.logger.log(`Notified TronPay: ${payload.referenceId} paid`);
        DailyLogger.log(`Paid callback to TronPay SUCCESS: ref=${payload.referenceId}, requestedAmount=${payload.requestedAmount}, paidAmount=${payload.paidAmount}, differenceInr=${payload.differenceInr}`, 'CallbacksService');
      }
    } catch (err) {
      // TODO: persist failed callbacks and retry (so we never lose a "paid").
      this.logger.error('Callback request threw', err as Error);
      DailyLogger.error('Paid callback to TronPay threw an exception', (err as Error).stack, 'CallbacksService');
    }
  }

  // Tell TronPay a SMART reservation was matched to a payer (announced). TronPay
  // uses this to create the "awaiting payment" row the user can decline within
  // 5 minutes. Signed the same way; distinguished by `type: 'matched'`.
  async notifyMatched(payload: {
    referenceId: string;
    matchedAmount: number;
    upiId: string;
    groupChatId: number;
  }): Promise<void> {
    const base = this.config.get<string>('callback.url');
    const secret = this.config.get<string>('callback.signingSecret') ?? '';
    if (!base) return;
    // Same signed channel, dedicated path: …/payout-bridge/callback → …/matched
    const url = base.replace(/\/callback$/, '/matched');
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-signature': signature },
        body,
      });
      if (!res.ok) {
        this.logger.error(
          `Matched-callback to TronPay failed: ${res.status} for ref ${payload.referenceId}`,
        );
        DailyLogger.error(`Smart matched-callback to TronPay FAILED: ref=${payload.referenceId}, matchedAmount=${payload.matchedAmount}, status=${res.status}`, undefined, 'CallbacksService');
      } else {
        this.logger.log(`Notified TronPay: ${payload.referenceId} matched`);
        DailyLogger.log(`Smart matched-callback to TronPay SUCCESS: ref=${payload.referenceId}, matchedAmount=${payload.matchedAmount}, upi=${payload.upiId}`, 'CallbacksService');
      }
    } catch (err) {
      this.logger.error('Matched-callback threw', err as Error);
      DailyLogger.error('Smart matched-callback to TronPay threw an exception', (err as Error).stack, 'CallbacksService');
    }
  }
  async notifyUnmatched(payload: { referenceId: string }): Promise<void> {
    const base = this.config.get<string>('callback.url');
    const secret = this.config.get<string>('callback.signingSecret') ?? '';
    if (!base) return;
    const url = base.replace(/\/callback\/?$/, '/unmatched');
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-signature': signature },
        body,
      });
      if (!res.ok) {
        this.logger.error(`Unmatched-callback to TronPay failed: ${res.status} for ref ${payload.referenceId}`);
        DailyLogger.error(`Smart unmatched-callback to TronPay FAILED: ref=${payload.referenceId}, status=${res.status}`, undefined, 'CallbacksService');
      } else {
        this.logger.log(`Notified TronPay: ${payload.referenceId} unmatched`);
        DailyLogger.log(`Smart unmatched-callback to TronPay SUCCESS: ref=${payload.referenceId}`, 'CallbacksService');
      }
    } catch (err) {
      this.logger.error('Unmatched-callback threw', err as Error);
      DailyLogger.error('Smart unmatched-callback to TronPay threw an exception', (err as Error).stack, 'CallbacksService');
    }
  }
}
