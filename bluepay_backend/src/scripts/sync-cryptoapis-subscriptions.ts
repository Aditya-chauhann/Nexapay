import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CryptoApisSubscriptionsService } from '../modules/cryptoapis/cryptoapis-subscriptions.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const subscriptions = app.get(CryptoApisSubscriptionsService);

    const args = process.argv.slice(2);
    const force = args.includes('--force') || args.includes('-f');
    const reset = args.includes('--reset');

    const nonFlagArgs = args.filter((a) => !a.startsWith('-'));
    const concurrency = nonFlagArgs.length > 0 ? parseInt(nonFlagArgs[0], 10) : 5;

    if (!Number.isFinite(concurrency) || concurrency < 1) {
      throw new Error('Concurrency must be a positive integer');
    }

    if (reset) {
      console.log('Resetting all subscriptions in DB to failed/resync state...');
      // If reset is passed, force is implicitly true
    }

    console.log(
      `Syncing CryptoAPIs subscriptions for all wallet addresses (concurrency=${concurrency}, force=${force || reset})...`,
    );

    const result = await subscriptions.syncAllAddresses(concurrency, force || reset);

    console.log('----------------------------------------------------');
    console.log(
      `Finished! Subscribed/Created: ${result.created}, Skipped: ${result.skipped}, Failed: ${result.failed}`,
    );
    console.log('----------------------------------------------------');

    if (result.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('CryptoAPIs subscription sync failed:', err);
  process.exit(1);
});
