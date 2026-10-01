import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import { CryptoApisClient } from './cryptoapis.client';
import {
  WalletSubscription,
  WalletSubscriptionDocument,
  WalletSubscriptionStatus,
} from './schemas/wallet-subscription.schema';

export interface SyncSubscriptionsResult {
  created: number;
  skipped: number;
  failed: number;
}

@Injectable()
export class CryptoApisSubscriptionsService {
  private readonly logger = new Logger(CryptoApisSubscriptionsService.name);

  constructor(
    private readonly client: CryptoApisClient,
    @InjectModel(WalletSubscription.name)
    private readonly subscriptionModel: Model<WalletSubscriptionDocument>,
    @InjectModel(Wallet.name)
    private readonly walletModel: Model<WalletDocument>,
  ) {}

  async ensureSubscribed(
    address: string,
    force = false,
  ): Promise<'created' | 'skipped' | 'failed'> {
    const normalized = address.trim();
    if (!force) {
      const existing = await this.subscriptionModel.findOne({
        address: normalized,
        status: WalletSubscriptionStatus.Active,
      });
      if (existing) {
        return 'skipped';
      }
    }

    try {
      const result = await this.client.createAddressTokenSubscription(
        normalized,
        normalized,
      );

      await this.subscriptionModel.updateOne(
        { address: normalized },
        {
          $set: {
            address: normalized,
            subscriptionId: result.referenceId,
            eventType: 'address-tokens-transactions-confirmed',
            status: WalletSubscriptionStatus.Active,
            lastError: null,
          },
        },
        { upsert: true },
      );

      return 'created';
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(
        `Failed to subscribe address ${normalized}: ${message}`,
      );

      await this.subscriptionModel.updateOne(
        { address: normalized },
        {
          $set: {
            address: normalized,
            subscriptionId: '',
            eventType: 'address-tokens-transactions-confirmed',
            status: WalletSubscriptionStatus.Failed,
            lastError: message,
          },
        },
        { upsert: true },
      );

      return 'failed';
    }
  }

  async syncAllAddresses(
    concurrency = 5,
    force = false,
  ): Promise<SyncSubscriptionsResult> {
    const wallets = await this.walletModel.find().select('address').lean();
    const addresses = wallets.map((w) => w.address);

    this.logger.log(
      `Found ${addresses.length} wallet addresses. Starting sync (force=${force}, concurrency=${concurrency})...`,
    );

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < addresses.length; i += concurrency) {
      const batch = addresses.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map((address) => this.ensureSubscribed(address, force)),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const addr = batch[j];
        if (result.status === 'fulfilled') {
          if (result.value === 'created') {
            created += 1;
            this.logger.log(`[${i + j + 1}/${addresses.length}] Subscribed ${addr} -> SUCCESS`);
          } else {
            skipped += 1;
            this.logger.log(`[${i + j + 1}/${addresses.length}] Subscribed ${addr} -> SKIPPED (Already active)`);
          }
        } else {
          failed += 1;
          this.logger.warn(`[${i + j + 1}/${addresses.length}] Subscribed ${addr} -> FAILED: ${result.reason}`);
        }
      }

      // Small 150ms delay between batches to respect CryptoAPIs rate limits
      if (i + concurrency < addresses.length) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }

    return { created, skipped, failed };
  }

  async getSubscriptionStatus(
    address: string,
  ): Promise<{ status: WalletSubscriptionStatus | 'not_found'; lastError?: string }> {
    const normalized = address.trim();
    const doc = await this.subscriptionModel.findOne({ address: normalized });
    if (!doc) {
      return { status: 'not_found' };
    }
    return {
      status: doc.status,
      lastError: doc.lastError,
    };
  }
}
