import { Module } from '@nestjs/common';
import { ProofsModule } from '../proofs/proofs.module';
import { TelegramModule } from '../telegram/telegram.module';
import { PayoutRequestsModule } from '../payout-requests/payout-requests.module';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [ProofsModule, TelegramModule, PayoutRequestsModule],
  controllers: [DisputesController],
  providers: [DisputesService],
})
export class DisputesModule {}
