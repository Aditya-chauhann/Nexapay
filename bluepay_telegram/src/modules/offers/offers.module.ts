import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BuyerOffer, BuyerOfferSchema } from './schemas/buyer-offer.schema';
import { OffersService } from './offers.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BuyerOffer.name, schema: BuyerOfferSchema },
    ]),
  ],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
