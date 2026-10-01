import {
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  Post,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { PayoutRequestsService } from './payout-requests.service';
import { CreatePayoutRequestDto } from './dto/create-payout-request.dto';
import { MatchingService } from '../matching/matching.service';

// Inbound: TronPay -> this service. Protected by the shared API key.
@UseGuards(ApiKeyGuard)
@Controller('payout-requests')
export class PayoutRequestsController {
  constructor(
    private readonly service: PayoutRequestsService,
    @Inject(forwardRef(() => MatchingService))
    private readonly matching: MatchingService,
  ) {}

  @Post()
  async create(@Body() dto: CreatePayoutRequestDto) {
    const request = await this.service.create(dto);
    // Held, not announced. Try to match it to a buyer offer right away; if none
    // is available it stays held and the sweep / next offer will pick it up.
    void this.matching.matchWithdrawal(request.referenceId);
    return {
      referenceId: request.referenceId,
      status: request.status,
    };
  }

  // Inbound: TronPay cancels a not-yet-matched request (e.g. a smart
  // auto-liquidation user turned the toggle off). Only `held` requests cancel;
  // an already-announced one is left to settle.
  @Delete(':referenceId')
  async cancel(@Param('referenceId') referenceId: string) {
    return this.service.cancelIfHeld(referenceId);
  }

  // Inbound: TronPay relays a RECEIVER (user) decline within the 5-min window.
  // Removes the announcement + drops the offer + cancels the request (no re-offer).
  @Post(':referenceId/user-decline')
  async userDecline(@Param('referenceId') referenceId: string) {
    return this.matching.userDecline(referenceId);
  }
}
