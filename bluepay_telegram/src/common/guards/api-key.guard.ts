import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * Guards inbound endpoints (TronPay -> this service). The caller must send the
 * shared key in the `x-api-key` header. Keeps the service from accepting payout
 * requests from anyone who can reach the port.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('inboundApiKey');
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.header('x-api-key');
    if (!expected || !provided) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided);
    if (
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
    return true;
  }
}
