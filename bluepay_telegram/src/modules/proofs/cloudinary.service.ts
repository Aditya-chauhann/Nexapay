import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    cloudinary.config({
      cloud_name: this.config.get<string>('cloudinary.cloudName'),
      api_key: this.config.get<string>('cloudinary.apiKey'),
      api_secret: this.config.get<string>('cloudinary.apiSecret'),
    });
  }

  /**
   * Uploads raw image bytes to Cloudinary and returns the hosted URL. We already
   * download the bytes to feed OCR, so we reuse them here instead of making
   * Cloudinary fetch the (short-lived) Telegram URL itself.
   */
  async uploadBuffer(imageBuffer: Buffer): Promise<string> {
    const dataUri = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    const res = await cloudinary.uploader.upload(dataUri, {
      folder: 'payout-bridge/proofs',
    });
    return res.secure_url;
  }

  // Upload a PDF (e.g. a dispute's bank statement) and return the hosted URL.
  // resource_type 'raw' keeps it a downloadable file rather than an image.
  async uploadPdf(pdfBuffer: Buffer, filename: string): Promise<string> {
    const dataUri = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
    const res = await cloudinary.uploader.upload(dataUri, {
      folder: 'payout-bridge/disputes',
      resource_type: 'raw',
      public_id: filename.replace(/\.[^.]+$/, '') || undefined,
    });
    return res.secure_url;
  }
}
