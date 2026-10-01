import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MiniAppService, UploadedImage } from './miniapp.service';

// Telegram Mini App: the claimer uploads their payment screenshot privately.
// No API-key guard — every data/upload call is authenticated by the signed
// Telegram `initData` (verified against the bot token) instead.
@Controller('miniapp')
export class MiniAppController {
  constructor(private readonly miniApp: MiniAppService) { }

  @Get('upload')
  @Header('Content-Type', 'text/html; charset=utf-8')
  page(): string {
    return this.miniApp.renderPage();
  }

  @Get('payout')
  details(
    @Query('ref') ref: string,
    @Headers('x-init-data') initData: string,
  ) {
    return this.miniApp.getPayoutDetails(ref ?? '', initData ?? '');
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('screenshot', {
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
    }),
  )
  upload(
    @Body() body: { ref?: string; initData?: string },
    @UploadedFile() screenshot: UploadedImage,
  ) {
    return this.miniApp.handleUpload(
      body.ref ?? '',
      body.initData ?? '',
      screenshot,
    );
  }
}
