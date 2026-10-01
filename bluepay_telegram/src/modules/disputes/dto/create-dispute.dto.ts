import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Multipart form fields accompanying the bank-statement PDF. All values arrive
// as strings (multipart), so amount is kept as a string for the caption.
export class CreateDisputeDto {
  @IsString()
  @IsNotEmpty()
  referenceId: string;

  @IsOptional()
  @IsString()
  upiId?: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsString()
  issue?: string;

  @IsOptional()
  @IsString()
  disputeId?: string;
}

