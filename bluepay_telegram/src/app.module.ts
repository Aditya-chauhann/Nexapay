import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { PayoutRequestsModule } from './modules/payout-requests/payout-requests.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { ProofsModule } from './modules/proofs/proofs.module';
import { CallbacksModule } from './modules/callbacks/callbacks.module';
import { OffersModule } from './modules/offers/offers.module';
import { MatchingModule } from './modules/matching/matching.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { MiniAppModule } from './modules/miniapp/miniapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongoUri'),
      }),
    }),
    OffersModule,
    MatchingModule,
    PayoutRequestsModule,
    TelegramModule,
    ProofsModule,
    CallbacksModule,
    DisputesModule,
    MiniAppModule,
  ],
})
export class AppModule {}
