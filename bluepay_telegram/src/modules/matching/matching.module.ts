import { Module, forwardRef } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { OffersModule } from '../offers/offers.module';
import { PayoutRequestsModule } from '../payout-requests/payout-requests.module';
import { TelegramModule } from '../telegram/telegram.module';
import { CallbacksModule } from '../callbacks/callbacks.module';

@Module({
  imports: [
    OffersModule,
    forwardRef(() => PayoutRequestsModule),
    forwardRef(() => TelegramModule),
    CallbacksModule,
  ],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
