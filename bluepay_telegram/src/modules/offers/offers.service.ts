import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BuyerOffer,
  BuyerOfferDocument,
  BuyerOfferStatus,
} from './schemas/buyer-offer.schema';
import { parseOfferAmount } from './offer-parser';

export interface IncomingOffer {
  groupChatId: number;
  groupTitle: string | null;
  rawText: string;
  telegramMessageId: string | null;
  senderId: string | null;
  senderUsername: string | null;
}

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    @InjectModel(BuyerOffer.name)
    private readonly model: Model<BuyerOfferDocument>,
  ) {}

  // Store a group message as an offer if its first token parses to an amount.
  // Returns the stored offer, or null if the message wasn't an offer.
  async ingest(input: IncomingOffer): Promise<BuyerOfferDocument | null> {
    const amount = parseOfferAmount(input.rawText);
    if (amount == null) {
      this.logger.debug(
        `Skipped (not an offer): "${input.rawText}" from group ${input.groupChatId}`,
      );
      return null;
    }

    const offer = await this.model.create({
      groupChatId: input.groupChatId,
      groupTitle: input.groupTitle,
      amount,
      rawText: input.rawText,
      telegramMessageId: input.telegramMessageId,
      senderId: input.senderId,
      senderUsername: input.senderUsername,
      status: BuyerOfferStatus.Open,
    });
    this.logger.log(
      `Offer stored: ₹${amount} (from "${input.rawText}") group ${input.groupChatId}`,
    );
    return offer;
  }

  /**
   * Atomically claim the OLDEST open offer whose amount falls in
   * [minAmount, maxAmount], marking it matched to `withdrawalRef`. Atomicity
   * prevents two matches grabbing the same offer. Returns the claimed offer or
   * null if none qualifies.
   */
  async claimOldestInRange(
    minAmount: number,
    maxAmount: number,
    withdrawalRef: string,
  ): Promise<BuyerOfferDocument | null> {
    return this.model.findOneAndUpdate(
      {
        status: BuyerOfferStatus.Open,
        amount: { $gte: minAmount, $lte: maxAmount },
      },
      {
        $set: {
          status: BuyerOfferStatus.Matched,
          matchedWithdrawalRef: withdrawalRef,
          matchedAt: new Date(),
        },
      },
      { sort: { createdAt: 1 }, new: true },
    );
  }

  // Atomically claim a SPECIFIC offer (Open -> Matched). Used when a freshly
  // arrived offer is matched to a held withdrawal. Returns null if it was
  // already taken.
  async claimSpecific(
    offerId: Types.ObjectId,
    withdrawalRef: string,
  ): Promise<BuyerOfferDocument | null> {
    return this.model.findOneAndUpdate(
      { _id: offerId, status: BuyerOfferStatus.Open },
      {
        $set: {
          status: BuyerOfferStatus.Matched,
          matchedWithdrawalRef: withdrawalRef,
          matchedAt: new Date(),
        },
      },
      { new: true },
    );
  }

  // Release a previously-claimed offer back to the pool (used to roll back if
  // announcing the match fails after we claimed the offer).
  async release(offerId: Types.ObjectId): Promise<void> {
    await this.model.updateOne(
      { _id: offerId },
      {
        $set: {
          status: BuyerOfferStatus.Open,
          matchedWithdrawalRef: null,
          matchedAt: null,
        },
      },
    );
  }

  // Mark a matched offer as declined (LP declined or let their claim expire) so
  // it is never matched again. The record is KEPT in the DB (audit) with who /
  // when / why. The request it was matched to gets re-offered to a DIFFERENT
  // open offer.
  async markDeclined(
    offerId: Types.ObjectId,
    reason: string,
    declinedByName: string | null,
  ): Promise<void> {
    await this.model.updateOne(
      { _id: offerId },
      {
        $set: {
          status: BuyerOfferStatus.Declined,
          declineReason: reason,
          declinedByName: declinedByName ?? null,
          declinedAt: new Date(),
        },
      },
    );
    this.logger.log(
      `Offer ${offerId.toString()} DECLINED (${reason}) by ${
        declinedByName ?? 'system'
      } — removed from sender queue permanently (kept in DB).`,
    );
  }

  // Find a buyer offer by its MongoDB ObjectId.
  async findById(id: Types.ObjectId | string): Promise<BuyerOfferDocument | null> {
    return this.model.findById(id).exec();
  }
}
