import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BuyerOfferDocument = HydratedDocument<BuyerOffer>;

export enum BuyerOfferStatus {
  // Available in the pool to be matched against a withdrawal.
  Open = 'open',
  // Consumed by a match (won't be matched again).
  Matched = 'matched',
  // The LP declined / let their claim time out — never re-matched.
  Declined = 'declined',
}

// A buyer/seller offer read from a Telegram group — the liquidity supply.
// The amount is parsed from the first token of the message (e.g. "50k upi").
@Schema({ timestamps: true })
export class BuyerOffer {
  // Which group this offer came from — the payout-needed message must go back
  // to this same group when this offer is matched.
  @Prop({ type: Number, required: true, index: true })
  groupChatId: number;

  @Prop({ type: String, default: null })
  groupTitle: string | null;

  // Parsed INR amount the buyer is willing to pay.
  @Prop({ type: Number, required: true, index: true })
  amount: number;

  // The original message text, kept for audit/debugging.
  @Prop({ type: String, default: '' })
  rawText: string;

  @Prop({ type: String, default: null })
  telegramMessageId: string | null;

  @Prop({ type: String, default: null })
  senderId: string | null;

  @Prop({ type: String, default: null })
  senderUsername: string | null;

  @Prop({
    type: String,
    required: true,
    enum: BuyerOfferStatus,
    default: BuyerOfferStatus.Open,
    index: true,
  })
  status: BuyerOfferStatus;

  // referenceId of the withdrawal this offer was matched to.
  @Prop({ type: String, default: null })
  matchedWithdrawalRef: string | null;

  @Prop({ type: Date, default: null })
  matchedAt: Date | null;

  // --- Decline / timeout audit (kept in DB; offer never re-enters the queue) ---
  // 'declined' = someone pressed Decline; 'claim-timeout' = 30-min window elapsed.
  @Prop({ type: String, default: null })
  declineReason: string | null;

  // Telegram display name of whoever declined (or the claimer who timed out).
  @Prop({ type: String, default: null })
  declinedByName: string | null;

  @Prop({ type: Date, default: null })
  declinedAt: Date | null;
}

export const BuyerOfferSchema = SchemaFactory.createForClass(BuyerOffer);
