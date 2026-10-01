import { Module } from '@nestjs/common';
import { ProofsModule } from '../proofs/proofs.module';
import { PayoutRequestsModule } from '../payout-requests/payout-requests.module';
import { MiniAppController } from './miniapp.controller';
import { MiniAppService } from './miniapp.service';

@Module({
  imports: [ProofsModule, PayoutRequestsModule],
  controllers: [MiniAppController],
  providers: [MiniAppService],
})
export class MiniAppModule {}
