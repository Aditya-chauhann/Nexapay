import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudinaryService } from '../proofs/cloudinary.service';
import { TelegramService } from '../telegram/telegram.service';
import { PayoutRequestsService } from '../payout-requests/payout-requests.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';

// Minimal shape of a Multer memory-storage file (avoids needing @types/multer).
export interface UploadedPdf {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cloudinary: CloudinaryService,
    private readonly telegram: TelegramService,
    private readonly payoutRequests: PayoutRequestsService,
  ) {}

  // A user raised a dispute in TronPay. Store the bank statement (Cloudinary) and
  // post it — with the issue, UPI, amount, and reference id — into the SAME group
  // the payout was matched/paid in.
  async handle(
    dto: CreateDisputeDto,
    file: UploadedPdf,
  ): Promise<{ pdfUrl: string | null }> {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('bankStatement (PDF) file is required');
    }
    const isPdf =
      (file.mimetype && file.mimetype.toLowerCase().includes('pdf')) ||
      (file.originalname && file.originalname.toLowerCase().endsWith('.pdf')) ||
      file.mimetype === 'application/octet-stream';
    if (!isPdf) {
      throw new BadRequestException('bankStatement must be a PDF');
    }

    // Store the statement (for our records) and get a hosted URL.
    let pdfUrl: string | null = null;
    try {
      pdfUrl = await this.cloudinary.uploadPdf(
        file.buffer,
        file.originalname || `dispute-${dto.referenceId}.pdf`,
      );
    } catch (err) {
      this.logger.error('Dispute PDF upload failed', err as Error);
    }

    // Find the group this payout lived in; fall back to the default group.
    const req = await this.payoutRequests.findByRef(dto.referenceId);
    const fallback = Number(
      this.config.get<string>('telegram.groupChatId') || 0,
    );
    const groupChatId =
      req && req.groupChatId != null ? req.groupChatId : fallback;
    if (!groupChatId) {
      this.logger.warn(
        `No group to post dispute for ref ${dto.referenceId} — skipping Telegram.`,
      );
      return { pdfUrl };
    }

    const caption =
      `🚩 Dispute raised\n` +
      `Amount: ₹${dto.amount || 'N/A'}\n` +
      `UPI: ${dto.upiId || 'N/A'}\n` +
      `Ref: ${dto.referenceId}\n` +
      `Issue: ${dto.issue || 'Dispute raised by user'}`;

    try {
      await this.telegram.sendDocument(
        groupChatId,
        file.buffer,
        file.originalname || `dispute-${dto.referenceId}.pdf`,
        caption,
      );
      this.logger.log(
        `Dispute for ref ${dto.referenceId} posted to group ${groupChatId}.`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send dispute doc to telegram group ${groupChatId}`,
        err as Error,
      );
    }

    return { pdfUrl };
  }
}
