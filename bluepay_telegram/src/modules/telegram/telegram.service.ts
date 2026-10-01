import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { PayoutRequestDocument } from '../payout-requests/schemas/payout-request.schema';
import { ProofsService } from '../proofs/proofs.service';
import { OffersService } from '../offers/offers.service';
import { DailyLogger } from '../../common/daily-logger';
import { MatchingService } from '../matching/matching.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly offers: OffersService,
    @Inject(forwardRef(() => MatchingService))
    private readonly matching: MatchingService,
    @Inject(forwardRef(() => ProofsService))
    private readonly proofs: ProofsService,
  ) { }

  async onModuleInit(): Promise<void> {
    const token = this.config.get<string>('telegram.botToken');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — Telegram disabled');
      return;
    }
    this.bot = new Telegraf(token);

    // Capture the time the bot initializes, with a small 30-second buffer
    // to account for any clock drift between Telegram servers and this server.
    const botStartTime = Math.floor(Date.now() / 1000) - 30;

    this.bot.use((ctx, next) => {
      if (ctx.message && 'date' in ctx.message) {
        if (ctx.message.date < botStartTime) {
          this.logger.debug(`Ignored old backlog message from timestamp: ${ctx.message.date}`);
          return;
        }
      }
      return next();
    });

    // `/report` (alias `/stats`): reply with the payout book summary. Registered
    // BEFORE the generic text handler so a command is never ingested as an offer.
    // Restricted to a private chat with the bot or the configured admin group so
    // totals aren't exposed inside buyer groups.
    this.bot.command(['report', 'stats'], async (ctx) => {
      try {
        if (!(await this.statsAllowed(ctx))) return;
        const stats = await this.matching.getStats();
        await ctx.reply(this.formatStats(stats));
      } catch (err) {
        this.logger.error('report command failed', err as Error);
      }
    });

    // Text messages across ALL groups the bot is in are candidate buyer offers.
    this.bot.on(message('text'), async (ctx) => {
      try {
        // Slash-commands are never buyer offers — let their handlers own them.
        if (ctx.message.text.startsWith('/')) return;
        const groupName =
          'title' in ctx.chat ? ctx.chat.title : String(ctx.chat.id);
        this.logger.log(
          `[msg] group="${groupName}" (${ctx.chat.id}) from=@${ctx.from?.username ?? ctx.from?.id ?? '?'
          }: "${ctx.message.text}"`,
        );
        DailyLogger.log(`Ingested offer message: group="${groupName}" (${ctx.chat.id}) from=@${ctx.from?.username ?? ctx.from?.id ?? '?'}: "${ctx.message.text}"`, 'TelegramService');
        const offer = await this.offers.ingest({
          groupChatId: ctx.chat.id,
          groupTitle: 'title' in ctx.chat ? ctx.chat.title : null,
          rawText: ctx.message.text,
          telegramMessageId: String(ctx.message.message_id),
          senderId: ctx.from ? String(ctx.from.id) : null,
          senderUsername: ctx.from?.username ?? null,
        });
        if (offer) await this.matching.matchOffer(offer);
      } catch (err) {
        this.logger.error('Failed to handle text message', err as Error);
      }
    });

    // Photos are payment-proof screenshots (UPI id typed as the caption).
    this.bot.on(message('photo'), async (ctx) => {
      try {
        DailyLogger.log(`Incoming payment proof photo received from telegram user=@${ctx.from?.username ?? ctx.from?.id ?? '?'}`, 'TelegramService');
        const photos = ctx.message.photo;
        const largest = photos[photos.length - 1];
        const fileLink = await ctx.telegram.getFileLink(largest.file_id);
        await this.proofs.handleIncomingScreenshot({
          imageUrl: fileLink.href,
          caption: ctx.message.caption ?? '',
          groupChatId: ctx.chat.id,
          groupTitle: 'title' in ctx.chat ? ctx.chat.title : null,
          telegramMessageId: String(ctx.message.message_id),
          telegramFileId: largest.file_id,
          senderId: ctx.from ? String(ctx.from.id) : null,
          senderUsername: ctx.from?.username ?? null,
        });
      } catch (err) {
        this.logger.error('Failed to handle incoming photo', err as Error);
      }
    });

    // "Pay Now" — first click claims the payout and starts the 30-min window.
    this.bot.action(/^pay:(.+)$/, async (ctx) => {
      try {
        const referenceId = ctx.match[1];
        const from = ctx.from;
        const name = from?.username
          ? `@${from.username}`
          : from?.first_name ?? 'someone';
        DailyLogger.log(`Payout claim action triggered for referenceId=${referenceId} by user=${name}`, 'TelegramService');
        const result = await this.matching.claimPayout(
          referenceId,
          from ? String(from.id) : '',
          name,
        );
        if (!result.ok) {
          await ctx.answerCbQuery(result.reason);
          return;
        }
        const req = result.req;
        const text = await this.buildPayoutText(
          req,
          `🔒 Claimed by ${name} — pay & upload the screenshot within 30 min.`,
        );
        try {
          await ctx.editMessageText(text, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: this.claimedKeyboard(referenceId, req),
            },
          });
        } catch (err) {
          this.logger.warn(`editMessageText failed: ${(err as Error).message}`);
        }
        await ctx.answerCbQuery('You claimed this payout. Pay within 30 min.');
      } catch (err) {
        this.logger.error('pay action failed', err as Error);
      }
    });

    // "Decline" — remove the announcement and re-offer to another LP.
    this.bot.action(/^decline:(.+)$/, async (ctx) => {
      try {
        const referenceId = ctx.match[1];
        const from = ctx.from;
        const name = from?.username
          ? `@${from.username}`
          : from?.first_name ?? 'someone';
        DailyLogger.log(`Payout decline action triggered (re-offering) for referenceId=${referenceId} by user=${name}`, 'TelegramService');
        await ctx.answerCbQuery('Declined — re-offering to others.');
        await this.matching.reoffer(referenceId, 'declined', name);
      } catch (err) {
        this.logger.error('decline action failed', err as Error);
      }
    });

    this.bot.launch({ dropPendingUpdates: true })
      .then(() => {
        this.logger.log('Telegram bot launched (long-polling)');
      })
      .catch((err) => {
        this.logger.error('Failed to launch Telegram bot (unreachable or invalid token)', err as Error);
      });
  }

  onModuleDestroy(): void {
    this.bot?.stop('SIGTERM');
  }

  // Helper method to construct payout announcement message text with HTML formatting,
  // user tag, and 1-tap copyable code tags for Account Holder Name, UPI ID, and Reference ID.
  private async buildPayoutText(
    req: PayoutRequestDocument,
    extraFooter: string = '',
  ): Promise<string> {
    let userMention = '';
    if (req.matchedOfferId) {
      try {
        const offer = await this.offers.findById(req.matchedOfferId as Types.ObjectId);
        if (offer) {
          if (offer.senderUsername) {
            userMention = `@${offer.senderUsername}\n`;
          } else if (offer.senderId) {
            userMention = `<a href="tg://user?id=${offer.senderId}">User</a>\n`;
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch matched offer details: ${(err as Error).message}`);
      }
    }

    const holderLine = req.accountHolderName
      ? `Name: <code>${req.accountHolderName}</code>\n`
      : '';

    let text =
      `${userMention}💸 <b>Payout needed</b>\n` +
      `Amount: ₹${req.matchedAmount}\n` +
      holderLine +
      `UPI: <code>${req.upiId}</code>\n` +
      `Ref: <code>${req.referenceId}</code>`;

    if (extraFooter) {
      text += `\n\n${extraFooter}`;
    }

    return text;
  }

  // Posts the "payout needed" announcement into the matched offer's group, with
  // "Pay Now" / "Decline" buttons. Quotes original offer message and tags user.
  async announcePayout(req: PayoutRequestDocument): Promise<string | null> {
    if (!this.bot || req.groupChatId == null) {
      this.logger.warn('Cannot announce — bot or group missing');
      return null;
    }

    let replyToMessageId: number | undefined = undefined;

    if (req.matchedOfferId) {
      try {
        const offer = await this.offers.findById(req.matchedOfferId as Types.ObjectId);
        if (offer && offer.telegramMessageId) {
          const parsedId = Number(offer.telegramMessageId);
          if (!isNaN(parsedId)) {
            replyToMessageId = parsedId;
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch offer message id: ${(err as Error).message}`);
      }
    }

    const text = await this.buildPayoutText(req);

    const copyTextValue = req.accountHolderName
      ? `Name: ${req.accountHolderName}\nUPI: ${req.upiId}`
      : `UPI: ${req.upiId}`;

    const inline_keyboard: any[][] = [
      [{ text: '📋 Copy Name & UPI', copy_text: { text: copyTextValue } }],
    ];

    if (req.smart) {
      inline_keyboard.push([
        { text: '✅ Pay Now', callback_data: `pay:${req.referenceId}` },
        { text: '❌ Decline', callback_data: `decline:${req.referenceId}` },
      ]);
    }

    const extra: any = {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard },
    };

    if (replyToMessageId) {
      extra.reply_to_message_id = replyToMessageId;
      extra.allow_sending_without_reply = true;
    }

    try {
      const sent = await this.bot.telegram.sendMessage(
        req.groupChatId,
        text,
        extra,
      );
      return String(sent.message_id);
    } catch (err) {
      const errMsg = (err as Error).message ?? '';
      if (replyToMessageId && errMsg.includes('message to be replied not found')) {
        this.logger.warn(
          `Reply target ${replyToMessageId} not found in announcePayout. Retrying without reply.`,
        );
        delete extra.reply_to_message_id;
        delete extra.allow_sending_without_reply;
        const sent = await this.bot.telegram.sendMessage(
          req.groupChatId,
          text,
          extra,
        );
        return String(sent.message_id);
      }
      throw err;
    }
  }

  // `/report` is answered only in a private chat with the bot or in the
  // configured admin group — never in an arbitrary buyer group.
  private async statsAllowed(ctx: any): Promise<boolean> {
    const adminGroup = this.config.get<string>('telegram.groupChatId') ?? '';
    if (adminGroup !== '' && String(ctx.chat.id) === adminGroup) {
      return true;
    }
    if (ctx.chat.type === 'private' && adminGroup !== '' && ctx.from) {
      try {
        const member = await ctx.telegram.getChatMember(adminGroup, ctx.from.id);
        return ['creator', 'administrator'].includes(member.status);
      } catch {
        return false;
      }
    }
    return false;
  }

  private formatStats(s: import('../payout-requests/payout-requests.service').PayoutStats): string {
    const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
    const block = (
      title: string,
      m: import('../payout-requests/payout-requests.service').ModeStats,
    ) =>
      `${title}\n` +
      `✅ Successful: ${m.successful.count} — ${inr(m.successful.amount)}\n` +
      `❌ Failed: ${m.failed.count}\n` +
      `⏳ Pending: ${m.pending.count} ` +
      `(awaiting liquidity: ${m.pending.awaitingLiquidity}, ` +
      `awaiting screenshot: ${m.pending.awaitingScreenshot})`;
    return (
      `📊 Payout report\n\n` +
      block('🅼 Manual withdrawals', s.manual) +
      `\n\n` +
      block('🅰 Automated (smart) withdrawals', s.smart)
    );
  }

  // Keyboard shown after "Pay Now" is claimed: an "Upload screenshot" button that
  // opens the Mini App via its Telegram DIRECT LINK (t.me/<bot>/<app>?startapp=…),
  // plus Decline. web_app inline buttons are NOT allowed in groups, but a `url`
  // button to a Mini App direct link is — and it still launches with full
  // initData (the ref arrives as start_param). The upload button only appears
  // when the bot username + Mini App short name are configured.
  private claimedKeyboard(referenceId: string, req?: PayoutRequestDocument) {
    const botUsername = this.config.get<string>('telegram.botUsername') ?? '';
    const shortName =
      this.config.get<string>('telegram.miniAppShortName') ?? '';
    const rows: any[][] = [];

    if (req) {
      const copyTextValue = req.accountHolderName
        ? `Name: ${req.accountHolderName}\nUPI: ${req.upiId}`
        : `UPI: ${req.upiId}`;
      rows.push([
        { text: '📋 Copy Name & UPI', copy_text: { text: copyTextValue } },
      ]);
    }

    if (botUsername && shortName) {
      rows.push([
        {
          text: '📤 Upload screenshot',
          url: `https://t.me/${botUsername}/${shortName}?startapp=${referenceId}`,
        },
      ]);
    }
    rows.push([{ text: '❌ Decline', callback_data: `decline:${referenceId}` }]);
    return rows;
  }

  // Once a payout is fulfilled (screenshot matched), mark the announcement as
  // paid and remove the claim buttons (no more Pay Now / Decline).
  async markAnnouncementPaid(
    chatId: number,
    messageId: number,
    req: PayoutRequestDocument,
    paidAmount?: number,
  ): Promise<void> {
    if (!this.bot) return;

    const expected = req.matchedAmount ?? req.requestedAmount;
    let statusFooter = '';

    if (
      typeof paidAmount === 'number' &&
      paidAmount > 0 &&
      paidAmount < expected
    ) {
      const diff = expected - paidAmount;
      statusFooter =
        `⚠️ <b>Partial Payment Received</b>\n` +
        `• Expected Amount: ₹${expected.toLocaleString('en-IN')}\n` +
        `• Amount Received: ₹${paidAmount.toLocaleString('en-IN')}\n` +
        `• Remaining Difference: ₹${diff.toLocaleString('en-IN')}\n\n` +
        `<i>Notice: A partial payment was recorded. If you wish to receive the remaining amount, please request again with the correct balance.</i>`;
    } else {
      const finalPaid =
        typeof paidAmount === 'number' && paidAmount > 0
          ? paidAmount
          : expected;
      statusFooter = `✅ <b>Payment Completed</b> (₹${finalPaid.toLocaleString('en-IN')})`;
    }

    const text = await this.buildPayoutText(req, statusFooter);
    try {
      await this.bot.telegram.editMessageText(chatId, messageId, undefined, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] },
      });
    } catch (err) {
      this.logger.error('Failed to mark announcement paid', err as Error);
    }
  }

  async markAnnouncementRejected(
    chatId: number,
    messageId: number,
    req: PayoutRequestDocument,
    reason: string,
  ): Promise<void> {
    if (!this.bot) return;

    const statusFooter = `❌ <b>Screenshot Rejected</b> — ${reason}`;
    const text = await this.buildPayoutText(req, statusFooter);
    try {
      await this.bot.telegram.editMessageText(chatId, messageId, undefined, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] },
      });
    } catch (err) {
      this.logger.error('Failed to mark announcement rejected', err as Error);
    }
  }

  // Post a plain text message into a group (e.g. an overpayment alert). Best
  // effort — a Telegram failure must never break settlement. Returns the message
  // id (or null if the bot is disabled / the send failed).
  async sendGroupMessage(
    chatId: number,
    text: string,
    parseMode?: 'HTML' | 'Markdown',
    replyToMessageId?: number,
  ): Promise<string | null> {
    if (!this.bot) return null;
    try {
      const extra: any = {
        parse_mode: parseMode,
      };
      if (replyToMessageId) {
        extra.reply_to_message_id = replyToMessageId;
      }
      try {
        const sent = await this.bot.telegram.sendMessage(chatId, text, extra);
        return String(sent.message_id);
      } catch (err) {
        const errMsg = (err as Error).message ?? '';
        if (replyToMessageId && errMsg.includes('message to be replied not found')) {
          this.logger.warn(`Reply target ${replyToMessageId} not found for sendMessage. Retrying without reply.`);
          delete extra.reply_to_message_id;
          const sent = await this.bot.telegram.sendMessage(chatId, text, extra);
          return String(sent.message_id);
        }
        throw err;
      }
    } catch (err) {
      this.logger.warn(`sendGroupMessage failed: ${(err as Error).message}`);
      return null;
    }
  }

  // Delete a message (used to remove the original, clear screenshot).
  async deleteMessage(chatId: number, messageId: number): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.telegram.deleteMessage(chatId, messageId);
    } catch (err) {
      this.logger.warn(`deleteMessage failed: ${(err as Error).message}`);
    }
  }

  // A robust native fetch helper for sending files to Telegram to bypass
  // Telegraf/node-fetch's socket hang up issues with buffers.
  private async sendFileNative(
    method: 'sendPhoto' | 'sendDocument',
    chatId: number,
    buffer: Buffer,
    filename: string,
    caption?: string,
    spoiler = false,
    replyToMessageId?: number,
  ): Promise<string | null> {
    const token = this.config.get<string>('telegram.botToken');
    if (!token) return null;

    const buildForm = (includeReply = true) => {
      const form = new FormData();
      form.append('chat_id', String(chatId));

      // Convert Buffer to Blob so native FormData accepts it correctly
      const blob = new Blob([new Uint8Array(buffer)]);
      const fieldName = method === 'sendPhoto' ? 'photo' : 'document';
      form.append(fieldName, blob, filename);

      if (caption) {
        form.append('caption', caption);
        form.append('parse_mode', 'HTML');
      }
      if (spoiler && method === 'sendPhoto') {
        form.append('has_spoiler', 'true');
      }
      if (includeReply && replyToMessageId) {
        form.append('reply_to_message_id', String(replyToMessageId));
      }
      return form;
    };

    try {
      let res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        body: buildForm(true),
      });
      let data = await res.json();

      if (!data.ok && replyToMessageId && data.description?.includes('message to be replied not found')) {
        this.logger.warn(`Reply target ${replyToMessageId} not found for native ${method}. Retrying without reply.`);
        res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
          method: 'POST',
          body: buildForm(false),
        });
        data = await res.json();
      }

      if (!data.ok) {
        this.logger.error(`Native ${method} failed: ${JSON.stringify(data)}`);
        return null;
      }
      return String(data.result.message_id);
    } catch (err) {
      this.logger.error(`Native ${method} fetch error`, err as Error);
      return null;
    }
  }

  // Send a document (e.g. a dispute's bank-statement PDF) into a group with a
  // caption. Returns the message id.
  async sendDocument(
    chatId: number,
    buffer: Buffer,
    filename: string,
    caption?: string,
  ): Promise<string | null> {
    return this.sendFileNative('sendDocument', chatId, buffer, filename, caption);
  }

  // Repost an image buffer (the blurred screenshot) into a group. Returns the
  // reposted message id.
  async sendPhoto(
    chatId: number,
    buffer: Buffer,
    caption?: string,
    spoiler = false,
    replyToMessageId?: number,
  ): Promise<string | null> {
    return this.sendFileNative('sendPhoto', chatId, buffer, 'proof.jpg', caption, spoiler, replyToMessageId);
  }
}
