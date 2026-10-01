import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { OffersService } from '../offers/offers.service';
import { BuyerOfferDocument } from '../offers/schemas/buyer-offer.schema';
import {
  MATCH_TOLERANCE_BELOW,
  PayoutRequestsService,
  PayoutStats,
} from '../payout-requests/payout-requests.service';
import { PayoutRequestDocument } from '../payout-requests/schemas/payout-request.schema';
import { TelegramService } from '../telegram/telegram.service';
import { CallbacksService } from '../callbacks/callbacks.service';
import { DailyLogger } from '../../common/daily-logger';

// Safety-net sweep interval (Option C) — retries any still-held withdrawals in
// case an event-driven attempt (Option B) was missed (e.g. across a restart).
const SWEEP_INTERVAL_MS = 30_000;

// After an LP clicks "Pay Now" they have this long to upload the payment
// screenshot before the announcement is removed and the request re-offered.
const CLAIM_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class MatchingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchingService.name);
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly offers: OffersService,
    private readonly payoutRequests: PayoutRequestsService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegram: TelegramService,
    private readonly callbacks: CallbacksService,
  ) {}

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => {
      this.sweep().catch((err) =>
        this.logger.error('sweep failed', err as Error),
      );
    }, SWEEP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  // Payout-book summary for the Telegram `/report` command.
  getStats(): Promise<PayoutStats> {
    return this.payoutRequests.getStats();
  }

  // Trigger B1: a new (or still-held) withdrawal — find an offer for it.
  async matchWithdrawal(referenceId: string): Promise<void> {
    const req = await this.payoutRequests.findByRef(referenceId);
    if (!req || req.status !== 'held') return;

    // Upper bound is the requested amount itself — never match an offer larger
    // than what the user requested (we don't pay the user more than requested).
    const max = req.requestedAmount;
    // Smart requests have NO lower floor: any offer at or below the ceiling
    // qualifies. Normal requests keep the [requested - 5000, requested] window.
    const min = req.smart ? 1 : req.requestedAmount - MATCH_TOLERANCE_BELOW;
    const offer = await this.offers.claimOldestInRange(min, max, referenceId);
    if (!offer) return; // no liquidity yet — stays held

    const claimed = await this.payoutRequests.claimHeldByRef(referenceId, offer);
    if (!claimed) {
      // Lost the race (matched by another path) — give the offer back.
      await this.offers.release(offer._id as Types.ObjectId);
      return;
    }
    await this.announce(claimed);
  }

  // Trigger B2: a new offer arrived — find the oldest held withdrawal for it.
  async matchOffer(offer: BuyerOfferDocument): Promise<void> {
    const claimedReq = await this.payoutRequests.claimOldestHeldForOffer(offer);
    if (!claimedReq) return; // no waiting withdrawal — offer stays open

    const claimedOffer = await this.offers.claimSpecific(
      offer._id as Types.ObjectId,
      claimedReq.referenceId,
    );
    if (!claimedOffer) {
      // Offer taken by another match — roll the withdrawal back to held.
      await this.payoutRequests.revertToHeld(claimedReq.referenceId);
      return;
    }
    await this.announce(claimedReq);
  }

  // An LP clicked "Pay Now". First click wins; start their 30-min pay window.
  // Returns the claimed request, or a reason it couldn't be claimed.
  async claimPayout(
    referenceId: string,
    telegramUserId: string,
    displayName: string,
  ): Promise<{ ok: true; req: PayoutRequestDocument } | { ok: false; reason: string }> {
    const claimed = await this.payoutRequests.claimForPayment(
      referenceId,
      telegramUserId,
      displayName,
      CLAIM_TTL_MS,
    );
    if (claimed) {
      this.logger.log(
        `Payout ${referenceId} claimed by ${displayName} — 30 min to upload proof.`,
      );
      DailyLogger.log(`Payout claimed: ref=${referenceId}, claimedBy=${displayName} — 30-min upload window started.`, 'MatchingService');
      return { ok: true, req: claimed };
    }
    const current = await this.payoutRequests.findByRef(referenceId);
    if (current && current.claimedBy) {
      return {
        ok: false,
        reason: `Already claimed by ${current.claimedByName ?? 'someone'}.`,
      };
    }
    return { ok: false, reason: 'This payout is no longer available.' };
  }

  // Decline / claim-timeout: remove the announcement from Telegram (kept in DB),
  // mark that offer declined (audit + never re-matched), and re-offer the request
  // to a DIFFERENT open offer.
  async reoffer(
    referenceId: string,
    reason: string,
    byName: string | null = null,
  ): Promise<void> {
    const req = await this.payoutRequests.findByRef(referenceId);
    if (!req || req.status !== 'announced') return; // already fulfilled/held/etc.

    // Who to credit in the audit: the explicit decliner, else whoever claimed it.
    const decliner = byName ?? req.claimedByName ?? null;

    if (req.groupChatId != null && req.announcementMessageId) {
      if (reason === 'invalid-screenshot') {
        await this.telegram.markAnnouncementRejected(
          req.groupChatId,
          Number(req.announcementMessageId),
          req,
          'Invalid/Failed Payment Proof',
        );
      } else {
        await this.telegram.deleteMessage(
          req.groupChatId,
          Number(req.announcementMessageId),
        );
      }
    }
    if (req.matchedOfferId) {
      await this.offers.markDeclined(
        req.matchedOfferId as Types.ObjectId,
        reason,
        decliner,
      );
    }
    await this.payoutRequests.reofferReset(referenceId);
    this.logger.log(
      `Re-offering receiver ${referenceId} (${reason}${
        decliner ? ` by ${decliner}` : ''
      }) — sender offer removed from queue, receiver back to pool.`,
    );
    DailyLogger.log(`Payout re-offered: ref=${referenceId}, reason=${reason}, by=${decliner ?? 'system'}`, 'MatchingService');

    if (req.smart) {
      void this.callbacks.notifyUnmatched({ referenceId });
    }

    // Try to match it to another open offer right away.
    await this.matchWithdrawal(referenceId);
  }

  // Re-offer any claims that ran past their 30-min window without a screenshot.
  async reofferExpiredClaims(): Promise<void> {
    const expired = await this.payoutRequests.listExpiredClaims();
    for (const req of expired) {
      this.logger.log(`Claim expired for ${req.referenceId} — re-offering.`);
      DailyLogger.warn(`Claim TTL expired: ref=${req.referenceId}, claimedBy=${req.claimedByName ?? 'unknown'} — re-offering.`, 'MatchingService');
      await this.reoffer(
        req.referenceId,
        'claim-timeout',
        req.claimedByName ?? null,
      );
    }
  }

  // Option C: re-offer expired claims, then retry all held withdrawals.
  async sweep(): Promise<void> {
    await this.reofferExpiredClaims();
    const held = await this.payoutRequests.listHeld();
    for (const req of held) {
      await this.matchWithdrawal(req.referenceId);
    }
  }

  private async announce(req: PayoutRequestDocument): Promise<void> {
    const messageId = await this.telegram.announcePayout(req);
    if (messageId) {
      await this.payoutRequests.setAnnouncementMessageId(
        req.referenceId,
        messageId,
      );
    }
    this.logger.log(
      `${req.smart ? '[SmartToggle] ' : ''}Matched ${req.referenceId}: ` +
        `${req.smart ? 'ceiling' : 'requested'}=${req.requestedAmount} ` +
        `paid=${req.matchedAmount} → announced "Payout needed" to group ${req.groupChatId} ` +
        `(UPI ${req.upiId}).`,
    );
    DailyLogger.log(`Payout matched & announced: ref=${req.referenceId}, smart=${req.smart ?? false}, requestedAmount=${req.requestedAmount}, matchedAmount=${req.matchedAmount}, upi=${req.upiId}, group=${req.groupChatId}`, 'MatchingService');

    // For SMART matches, tell TronPay so it can create the "awaiting payment"
    // row the user can decline within 5 minutes.
    if (req.smart && req.matchedAmount != null && req.groupChatId != null) {
      void this.callbacks.notifyMatched({
        referenceId: req.referenceId,
        matchedAmount: req.matchedAmount,
        upiId: req.upiId,
        groupChatId: req.groupChatId,
      });
    }
  }

  // The RECEIVER (user) declined the payment within their 5-min window (smart).
  // Remove the announcement, drop the matched offer, and cancel the request
  // outright — NO re-offer (the user backed out of this payout).
  async userDecline(referenceId: string): Promise<{ cancelled: boolean }> {
    const req = await this.payoutRequests.findByRef(referenceId);
    if (!req) return { cancelled: false };
    if (req.status !== 'held' && req.status !== 'announced') {
      // already fulfilled/cancelled — nothing to do.
      return { cancelled: false };
    }
    if (req.groupChatId != null && req.announcementMessageId) {
      await this.telegram.deleteMessage(
        req.groupChatId,
        Number(req.announcementMessageId),
      );
    }
    if (req.matchedOfferId) {
      await this.offers.markDeclined(
        req.matchedOfferId as Types.ObjectId,
        'user-declined',
        null,
      );
    }
    await this.payoutRequests.cancelByRef(referenceId);
    this.logger.log(
      `[SmartToggle] user declined ${referenceId} — announcement removed, offer dropped, request cancelled (no re-offer).`,
    );
    DailyLogger.warn(`[SmartToggle] User declined payout: ref=${referenceId} — announcement removed, request cancelled.`, 'MatchingService');
    return { cancelled: true };
  }
}
