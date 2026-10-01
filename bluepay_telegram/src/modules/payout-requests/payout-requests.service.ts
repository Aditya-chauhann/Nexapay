import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PayoutRequest,
  PayoutRequestDocument,
  PayoutRequestStatus,
} from './schemas/payout-request.schema';
import { CreatePayoutRequestDto } from './dto/create-payout-request.dto';
import { BuyerOfferDocument } from '../offers/schemas/buyer-offer.schema';

// Summary for one withdrawal mode (manual vs. smart auto-liquidation).
export interface ModeStats {
  successful: { count: number; amount: number };
  failed: { count: number };
  pending: {
    count: number;
    awaitingLiquidity: number;
    awaitingScreenshot: number;
    amount: number;
  };
}

// Shape of the payout book summary powering the Telegram `/report` command,
// split by mode so manual and automated (smart) withdrawals report separately.
export interface PayoutStats {
  manual: ModeStats;
  smart: ModeStats;
}

// Matching tolerance: an offer qualifies for a withdrawal of X if its amount is
// within [X - BELOW, X]. We never pay the user MORE than requested (no upward
// tolerance), but may pay up to BELOW less when an exact match isn't available.
export const MATCH_TOLERANCE_BELOW = 5000;

@Injectable()
export class PayoutRequestsService {
  private readonly logger = new Logger(PayoutRequestsService.name);

  constructor(
    @InjectModel(PayoutRequest.name)
    private readonly model: Model<PayoutRequestDocument>,
  ) { }

  // TronPay registers a new withdrawal. Stored as `held` — NOT announced until a
  // buyer offer is matched to it.
  async create(dto: CreatePayoutRequestDto): Promise<PayoutRequestDocument> {
    const existing = await this.model.findOne({ referenceId: dto.referenceId });
    if (existing) {
      throw new ConflictException(
        'A payout request with this referenceId already exists',
      );
    }
    const created = await this.model.create({
      referenceId: dto.referenceId,
      requestedAmount: dto.amount,
      upiId: dto.upiId.toLowerCase(),
      accountHolderName: dto.accountHolderName ?? null,
      smart: dto.smart ?? false,
      status: PayoutRequestStatus.Held,
      queuedAt: new Date(),
    });
    if (created.smart) {
      this.logger.log(
        `[SmartToggle] created no-floor request ${created.referenceId}: ` +
        `ceiling ₹${created.requestedAmount} → UPI ${created.upiId} (held).`,
      );
    } else {
      this.logger.log(
        `Created payout request ${created.referenceId}: ₹${created.requestedAmount} (held).`,
      );
    }
    return created;
  }

  // Cancel a request that hasn't been matched yet. Only `held` requests can be
  // cancelled; an `announced` (in-flight) one is left to settle. Returns whether
  // it was cancelled plus the current status, so the caller can decide how to
  // reconcile (e.g. a smart user turning the toggle off).
  async cancelIfHeld(
    referenceId: string,
  ): Promise<{ cancelled: boolean; status: PayoutRequestStatus | null }> {
    const updated = await this.model.findOneAndUpdate(
      { referenceId, status: PayoutRequestStatus.Held },
      { $set: { status: PayoutRequestStatus.Cancelled } },
      { new: true },
    );
    if (updated) {
      this.logger.log(
        `[SmartToggle] cancelled held request ${referenceId} (was smart=${updated.smart}).`,
      );
      return { cancelled: true, status: updated.status };
    }
    const current = await this.model.findOne({ referenceId });
    this.logger.log(
      `[SmartToggle] cancel request ${referenceId}: not held ` +
      `(status=${current ? current.status : 'not-found'}) — left as-is.`,
    );
    return { cancelled: false, status: current ? current.status : null };
  }

  findByRef(referenceId: string): Promise<PayoutRequestDocument | null> {
    return this.model.findOne({ referenceId });
  }

  // Atomically claim an announced request for payment (first "Pay Now" wins).
  // Returns the updated request, or null if it wasn't announced/unclaimed.
  async claimForPayment(
    referenceId: string,
    claimedBy: string,
    claimedByName: string,
    ttlMs: number,
  ): Promise<PayoutRequestDocument | null> {
    const now = new Date();
    return this.model.findOneAndUpdate(
      {
        referenceId,
        status: PayoutRequestStatus.Announced,
        claimedBy: null,
      },
      {
        $set: {
          claimedBy,
          claimedByName,
          claimedAt: now,
          claimExpiresAt: new Date(now.getTime() + ttlMs),
        },
      },
      { new: true },
    );
  }

  // Hard-cancel a request (user declined the payment) — set Cancelled and clear
  // match/claim state. Unlike reofferReset this does NOT go back to the pool.
  async cancelByRef(referenceId: string): Promise<PayoutRequestDocument | null> {
    return this.model.findOneAndUpdate(
      { referenceId },
      {
        $set: {
          status: PayoutRequestStatus.Cancelled,
          matchedOfferId: null,
          matchedAmount: null,
          groupChatId: null,
          announcementMessageId: null,
          matchedAt: null,
          claimedBy: null,
          claimedByName: null,
          claimedAt: null,
          claimExpiresAt: null,
        },
      },
      { new: true },
    );
  }

  // Announced requests whose claim window has elapsed with no screenshot.
  listExpiredClaims(): Promise<PayoutRequestDocument[]> {
    return this.model.find({
      status: PayoutRequestStatus.Announced,
      claimedBy: { $ne: null },
      claimExpiresAt: { $lt: new Date() },
    });
  }

  // Reset a request back to the pool so it can be matched again (declined / timed
  // out). Clears the match + claim state; the record itself is kept in the DB.
  async reofferReset(referenceId: string): Promise<PayoutRequestDocument | null> {
    return this.model.findOneAndUpdate(
      { referenceId },
      {
        $set: {
          status: PayoutRequestStatus.Held,
          matchedOfferId: null,
          matchedAmount: null,
          groupChatId: null,
          announcementMessageId: null,
          matchedAt: null,
          claimedBy: null,
          claimedByName: null,
          claimedAt: null,
          claimExpiresAt: null,
          // Move to the BACK of the queue so a request no LP will pay can't
          // keep grabbing offers ahead of everyone behind it.
          queuedAt: new Date(),
        },
        $inc: { reofferCount: 1 },
      },
      { new: true },
    );
  }

  listHeld(): Promise<PayoutRequestDocument[]> {
    return this.model
      .find({ status: PayoutRequestStatus.Held })
      .sort({ queuedAt: 1 });
  }

  private offerPatch(offer: BuyerOfferDocument) {
    return {
      status: PayoutRequestStatus.Announced,
      matchedOfferId: offer._id as Types.ObjectId,
      matchedAmount: offer.amount,
      groupChatId: offer.groupChatId,
      matchedAt: new Date(),
    };
  }

  // Atomically move a specific held request -> announced, attaching the offer.
  // Returns null if it wasn't held (already matched elsewhere).
  async claimHeldByRef(
    referenceId: string,
    offer: BuyerOfferDocument,
  ): Promise<PayoutRequestDocument | null> {
    return this.model.findOneAndUpdate(
      { referenceId, status: PayoutRequestStatus.Held },
      { $set: this.offerPatch(offer) },
      { new: true },
    );
  }

  // Atomically claim the OLDEST held request that this offer qualifies for.
  //  - Normal requests: requestedAmount in [offer, offer + BELOW]  (the inverse
  //    of the offer-in-range condition offer in [X - BELOW, X]). The lower bound
  //    is the offer amount itself — we never match a withdrawal that requested
  //    LESS than the offer (would overpay the user).
  //  - Smart requests: requestedAmount is a ceiling, so any request with
  //    requestedAmount >= offer qualifies (no upper cap). We still never overpay
  //    because the offer is <= the ceiling.
  // Returns null if none qualifies.
  async claimOldestHeldForOffer(
    offer: BuyerOfferDocument,
  ): Promise<PayoutRequestDocument | null> {
    return this.model.findOneAndUpdate(
      {
        status: PayoutRequestStatus.Held,
        $or: [
          {
            smart: { $ne: true },
            requestedAmount: {
              $gte: offer.amount,
              $lte: offer.amount + MATCH_TOLERANCE_BELOW,
            },
          },
          {
            smart: true,
            requestedAmount: { $gte: offer.amount },
          },
        ],
      },
      { $set: this.offerPatch(offer) },
      { sort: { queuedAt: 1 }, new: true },
    );
  }

  // Roll a request back to held (used when the partner claim fails).
  async revertToHeld(referenceId: string): Promise<void> {
    await this.model.updateOne(
      { referenceId },
      {
        $set: {
          status: PayoutRequestStatus.Held,
          matchedOfferId: null,
          matchedAmount: null,
          groupChatId: null,
          matchedAt: null,
        },
      },
    );
  }

  async setAnnouncementMessageId(
    referenceId: string,
    messageId: string,
  ): Promise<void> {
    await this.model.updateOne(
      { referenceId },
      { $set: { announcementMessageId: messageId } },
    );
  }

  /**
   * Proof matching: a screenshot arrived in `groupChatId` with `upiId` in the
   * caption. Atomically fulfil the OLDEST announced request for that UPI in that
   * group. UPI is the primary key (OCR amount is unreliable); the group scopes
   * it. Returns the fulfilled request or null.
   */
  // Fulfil a specific announced request by its referenceId (used by the Mini App
  // upload flow, where we already know exactly which payout the claimer is paying).
  async fulfilAnnouncedByRef(
    referenceId: string,
    proofId: Types.ObjectId,
  ): Promise<PayoutRequestDocument | null> {
    return this.model.findOneAndUpdate(
      { referenceId, status: PayoutRequestStatus.Announced },
      {
        $set: {
          status: PayoutRequestStatus.Fulfilled,
          matchedProofId: proofId,
          fulfilledAt: new Date(),
        },
      },
      { new: true },
    );
  }

  // Aggregate the payout book into the buckets the client's Telegram report
  // shows — successful (fulfilled), failed (cancelled), pending (held +
  // announced) — split by mode (`smart` true = automated, false = manual).
  // `amount` for successful is the sum actually paid (matchedAmount); for
  // announced it's the amount currently in-flight (awaiting screenshot).
  async getStats(): Promise<PayoutStats> {
    const rows = await this.model.aggregate<{
      _id: { status: PayoutRequestStatus; smart: boolean };
      count: number;
      matched: number;
    }>([
      {
        $group: {
          _id: { status: '$status', smart: { $ifNull: ['$smart', false] } },
          count: { $sum: 1 },
          matched: { $sum: { $ifNull: ['$matchedAmount', 0] } },
        },
      },
    ]);
    const modeStats = (smart: boolean): ModeStats => {
      const row = (s: PayoutRequestStatus) =>
        rows.find((r) => r._id.status === s && r._id.smart === smart);
      const fulfilled = row(PayoutRequestStatus.Fulfilled);
      const cancelled = row(PayoutRequestStatus.Cancelled);
      const held = row(PayoutRequestStatus.Held);
      const announced = row(PayoutRequestStatus.Announced);
      return {
        successful: {
          count: fulfilled?.count ?? 0,
          amount: fulfilled?.matched ?? 0,
        },
        failed: { count: cancelled?.count ?? 0 },
        pending: {
          count: (held?.count ?? 0) + (announced?.count ?? 0),
          awaitingLiquidity: held?.count ?? 0,
          awaitingScreenshot: announced?.count ?? 0,
          amount: announced?.matched ?? 0,
        },
      };
    };
    return { manual: modeStats(false), smart: modeStats(true) };
  }

  async fulfilAnnouncedByUpi(
    upiId: string,
    groupChatId: number,
    proofId: Types.ObjectId,
  ): Promise<PayoutRequestDocument | null> {
    return this.model.findOneAndUpdate(
      {
        upiId: upiId.toLowerCase(),
        groupChatId,
        status: PayoutRequestStatus.Announced,
      },
      {
        $set: {
          status: PayoutRequestStatus.Fulfilled,
          matchedProofId: proofId,
          fulfilledAt: new Date(),
        },
      },
      { sort: { createdAt: 1 }, new: true },
    );
  }

  async findAnnouncedByUpi(
    upiId: string,
    groupChatId: number,
  ): Promise<PayoutRequestDocument | null> {
    return this.model.findOne({
      upiId: upiId.toLowerCase(),
      groupChatId,
      status: PayoutRequestStatus.Announced,
    }, {}, { sort: { createdAt: 1 } }).exec();
  }
}
