import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProofDocument = HydratedDocument<Proof>;

export enum ProofStatus {
  // Matched to an open payout request and TronPay was notified.
  Matched = 'matched',
  // No open request matched (wrong amount, UPI typo, noise, early arrival).
  // Stored and left alone, per product decision.
  Unmatched = 'unmatched',
}

@Schema({ timestamps: true })
export class Proof {
  // Where we stored the screenshot (Cloudinary URL) — this is what we hand to
  // TronPay so it can save it on the user's record.
  @Prop({ required: true })
  imageUrl: string;

  // Raw caption the LP typed alongside the screenshot.
  @Prop({ default: '' })
  caption: string;

  // The UPI id we extracted (primarily from the caption).
  @Prop({ type: String, lowercase: true, trim: true, default: null, index: true })
  upiId: string | null;

  // The amount we read from the screenshot via OCR.
  @Prop({ type: Number, default: null })
  amount: number | null;

  // Other details OCR pulled out (UTR, timestamp, raw text, etc.).
  @Prop({ type: Object, default: {} })
  extracted: Record<string, unknown>;

  // --- Amount-mismatch tag (payer paid a different amount than announced) ---
  // Set to 'overpaid' when the OCR-read screenshot amount is GREATER than the
  // announced amount the payer was asked to send. null = amounts agreed (or OCR
  // couldn't read an amount to compare). Settlement still proceeds; this is a flag.
  @Prop({ type: String, enum: ['overpaid'], default: null, index: true })
  amountMismatch: 'overpaid' | null;

  // The amount OCR read from the screenshot (what the payer actually sent).
  @Prop({ type: Number, default: null })
  screenshotAmount: number | null;

  // The announced amount the payer was asked to pay (matchedAmount at match time).
  @Prop({ type: Number, default: null })
  expectedAmount: number | null;

  @Prop({ type: String, required: true, enum: ProofStatus, index: true })
  status: ProofStatus;

  // referenceId of the payout request this proof fulfilled, if matched.
  @Prop({ type: String, default: null, index: true })
  matchedReferenceId: string | null;

  // --- Telegram provenance (audit) ---
  @Prop({ type: Number, default: null, index: true })
  groupChatId: number | null;

  @Prop({ type: String, default: null })
  groupTitle: string | null;

  // Message id of the blurred screenshot we reposted (original is deleted).
  @Prop({ type: String, default: null })
  blurredMessageId: string | null;

  @Prop({ type: String, default: null })
  telegramMessageId: string | null;

  @Prop({ type: String, default: null })
  telegramFileId: string | null;

  @Prop({ type: String, default: null })
  senderId: string | null;

  @Prop({ type: String, default: null })
  senderUsername: string | null;
}

export const ProofSchema = SchemaFactory.createForClass(Proof);
