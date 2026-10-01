import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PayoutRequest,
  PayoutRequestSchema,
} from './schemas/payout-request.schema';
import { PayoutRequestsService } from './payout-requests.service';
import { PayoutRequestsController } from './payout-requests.controller';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PayoutRequest.name, schema: PayoutRequestSchema },
    ]),
    forwardRef(() => MatchingModule),
  ],
  controllers: [PayoutRequestsController],
  providers: [PayoutRequestsService],
  exports: [PayoutRequestsService],
})
export class PayoutRequestsModule {}
