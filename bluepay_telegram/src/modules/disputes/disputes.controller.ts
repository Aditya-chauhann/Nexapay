import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { DisputesService, UploadedPdf } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';

// Inbound: TronPay -> this service. Protected by the shared API key.
@UseGuards(ApiKeyGuard)
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('bankStatement', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async create(
    @Body() dto: CreateDisputeDto,
    @UploadedFile() file: UploadedPdf,
  ) {
    return this.disputes.handle(dto, file);
  }
}
