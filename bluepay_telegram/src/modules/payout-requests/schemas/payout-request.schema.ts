import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PayoutRequestDocument = HydratedDocument<PayoutRequest>;

export enum PayoutRequestStatus {
  // Received from the caller, waiting to be matched to a buyer offer.
  Held = 'held',
  // Matched to an offer and announced in that offer's group; waiting for the
  // buyer's payment screenshot.
  Announced = 'announced',
  // A screenshot was matched and the caller was notified.
  Fulfilled = 'fulfilled',
  // The caller cancelled this request before it was matched (e.g. a smart
  // auto-liquidation user turned the toggle off). Never matched.
  Cancelled = 'cancelled',
}

@Schema({ timestamps: true })
export class PayoutRequest {
  // Opaque id supplied by the calling app (e.g. TronPay's withdrawal id).
  @Prop({ required: true, unique: true, index: true })
  referenceId: string;

  // INR amount the user requested (net INR). For normal requests, matching looks
  // for an offer in [requestedAmount - 5000, requestedAmount] — never above the
  // requested amount. For `smart` requests this is the ceiling only (see below).
  @Prop({ required: true, type: Number, index: true })
  requestedAmount: number;

  // Smart auto-liquidation request: `requestedAmount` is a CEILING, not a target.
  // Any offer with amount in [1, requestedAmount] qualifies (no lower floor), so
  // we pay whatever we can match up to the user's full balance.
  @Prop({ default: false, index: true })
  smart: boolean;

  // The UPI VPA the money must be sent to. Stored lower-cased.
  @Prop({ required: true, lowercase: true, trim: true, index: true })
  upiId: string;

  @Prop({ type: String, default: null })
  accountHolderName: string | null;

  @Prop({
    required: true,
    enum: PayoutRequestStatus,
    default: PayoutRequestStatus.Held,
    index: true,
  })
  status: PayoutRequestStatus;

  // Queue-ordering key (matching sorts by this, oldest first). Normally equals
  // creation time, but is bumped to "now" when a request is re-offered
  // (declined / timed out) so it moves to the BACK of the queue and can't starve
  // requests behind it. `createdAt` is preserved for audit.
  @Prop({ type: Date, default: () => new Date(), index: true })
  queuedAt: Date;

  // --- Set when matched to a buyer offer ---
  @Prop({ type: Types.ObjectId, ref: 'BuyerOffer', default: null })
  matchedOfferId: Types.ObjectId | null;

  // The offer's amount = what the buyer actually pays (may differ from
  // requestedAmount within the matching tolerance).
  @Prop({ type: Number, default: null })
  matchedAmount: number | null;

  // Group the matched offer came from — the announcement and screenshot live here.
  @Prop({ type: Number, default: null, index: true })
  groupChatId: number | null;

  @Prop({ type: String, default: null })
  announcementMessageId: string | null;

  @Prop({ type: Date, default: null })
  matchedAt: Date | null;

  // --- Claim ("Pay Now") tracking ---
  // The Telegram user who clicked "Pay Now" (first click wins). While set, the
  // LP has until claimExpiresAt (30 min) to upload the payment screenshot; if
  // they don't (or they Decline), the announcement is removed from Telegram and
  // the request is re-offered to the pool.
  @Prop({ type: String, default: null })
  claimedBy: string | null;

  @Prop({ type: String, default: null })
  claimedByName: string | null;

  @Prop({ type: Date, default: null })
  claimedAt: Date | null;

  @Prop({ type: Date, default: null, index: true })
  claimExpiresAt: Date | null;

  // How many times this request has been re-offered (audit; the record is kept
  // in the DB even after its Telegram message is removed).
  @Prop({ type: Number, default: 0 })
  reofferCount: number;

  // --- Set when a screenshot fulfils it ---
  @Prop({ type: Types.ObjectId, ref: 'Proof', default: null })
  matchedProofId: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  fulfilledAt: Date | null;
}

export const PayoutRequestSchema = SchemaFactory.createForClass(PayoutRequest);
