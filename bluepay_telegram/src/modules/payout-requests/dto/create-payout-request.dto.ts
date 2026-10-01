import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreatePayoutRequestDto {
  // Opaque reference from the caller (TronPay withdrawal id). Used for the
  // callback later, so it must be unique per request.
  @IsString()
  @IsNotEmpty()
  referenceId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  upiId: string;

  @IsOptional()
  @IsString()
  accountHolderName?: string;

  // Smart auto-liquidation: treat `amount` as a ceiling and match any offer at or
  // below it (no lower floor). Defaults to false (normal ±tolerance matching).
  @IsOptional()
  @IsBoolean()
  smart?: boolean;
}
