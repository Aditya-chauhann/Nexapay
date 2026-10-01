import { Module } from '@nestjs/common';
import { CallbacksService } from './callbacks.service';

@Module({
  providers: [CallbacksService],
  exports: [CallbacksService],
})
export class CallbacksModule {}
