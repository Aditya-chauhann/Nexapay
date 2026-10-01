import { Module, forwardRef } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { ProofsModule } from '../proofs/proofs.module';
import { OffersModule } from '../offers/offers.module';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [
    OffersModule,
    forwardRef(() => MatchingModule),
    forwardRef(() => ProofsModule),
  ],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
