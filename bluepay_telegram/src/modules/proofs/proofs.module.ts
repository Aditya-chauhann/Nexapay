import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Proof, ProofSchema } from './schemas/proof.schema';
import { ProofsService } from './proofs.service';
import { CloudinaryService } from './cloudinary.service';
import { OcrService } from './ocr.service';
import { BlurService } from './blur.service';
import { PayoutRequestsModule } from '../payout-requests/payout-requests.module';
import { CallbacksModule } from '../callbacks/callbacks.module';
import { TelegramModule } from '../telegram/telegram.module';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Proof.name, schema: ProofSchema }]),
    forwardRef(() => PayoutRequestsModule),
    CallbacksModule,
    forwardRef(() => TelegramModule),
    forwardRef(() => MatchingModule),
  ],
  providers: [ProofsService, CloudinaryService, OcrService, BlurService],
  exports: [ProofsService, CloudinaryService],
})
export class ProofsModule {}
