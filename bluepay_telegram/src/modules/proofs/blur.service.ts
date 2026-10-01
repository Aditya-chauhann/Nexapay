import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Produces a heavily-blurred copy of an image so the original payment details
 * (UPI id, amount, account) can't be recovered. Permanent pixel blur — distinct
 * from Telegram's tap-to-reveal spoiler. Swap to the spoiler later by skipping
 * this and passing `spoiler: true` when reposting instead.
 */
@Injectable()
export class BlurService {
  private readonly logger = new Logger(BlurService.name);

  async blur(imageBuffer: Buffer): Promise<Buffer> {
    // Resize to a smaller width to compress, then blur.
    return sharp(imageBuffer)
      .resize({ width: 800 })
      .blur(25)
      .jpeg({ quality: 60 })
      .toBuffer();
  }
}
