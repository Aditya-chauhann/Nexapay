import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
    origin: ['http://192.168.12.28:1007', 'https://trusto.exchange', 'http://trusto.club', 'http://trusto.com.co', 'http://trusto.digital', 'http://trusto.vip', 'http://trusto.pro', 'http://trusto.live', 'http://trusto.biz'],

  });
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3005;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`payout-bridge listening on port ${port}`);
}

void bootstrap();
