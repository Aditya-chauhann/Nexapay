import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface TransactionAlertPayload {
  type: 'Deposit' | 'Withdrawal' | 'Withdrawal Dispute' | 'Dispute' | string;
  status: string;
  username: string;
  name: string;
  ipAddress?: string;
  time?: string | Date;
  amount: string | number;
  destinationOrWallet?: string;
  txIdOrRef?: string;
  extraDetails?: Record<string, string | number | null | undefined>;
}

export class DailyLogger {
  private static logDir = path.join(process.cwd(), 'logs');
  private static logger = new Logger('DailyProcess');

  private static ensureDirExists() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      console.error('DailyLogger failed to create logs directory:', err);
    }
  }

  static log(message: string, context?: string) {
    this.logger.log(message, context);
    this.writeToFile('INFO', message, context);
  }

  static warn(message: string, context?: string) {
    this.logger.warn(message, context);
    this.writeToFile('WARN', message, context);
  }

  static error(message: string, trace?: string, context?: string) {
    this.logger.error(message, trace, context);
    this.writeToFile('ERROR', message, context, trace);
    this.sendTelegramAlert('ERROR', message, context, trace);
  }

  static security(message: string, context?: string) {
    this.logger.warn(`[SECURITY] ${message}`, context);
    this.writeToFile('SECURITY', message, context);
    this.sendTelegramAlert('SECURITY', message, context);
  }

  static async transactionAlert(data: TransactionAlertPayload) {
    const isDispute = data.type.toLowerCase().includes('dispute');
    const icon = isDispute ? '⚠️' : data.type === 'Deposit' ? '💰' : '💸';
    const statusLower = (data.status || '').toLowerCase();
    const statusIcon = isDispute
      ? statusLower.includes('approve') || statusLower.includes('resolved')
        ? '✅'
        : statusLower.includes('decline') || statusLower.includes('reject')
        ? '❌'
        : '⚠️'
      : statusLower.includes('paid') ||
        statusLower.includes('confirm') ||
        statusLower.includes('success') ||
        statusLower.includes('approve')
      ? '✅'
      : statusLower.includes('fail') ||
        statusLower.includes('reject') ||
        statusLower.includes('cancel')
      ? '❌'
      : '⏳';

    const timestamp = (data.time ? new Date(data.time) : new Date()).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'medium',
    });

    const alertTitle = isDispute ? 'Dispute Alert' : `Transaction Alert — ${this.escapeHtml(data.type)}`;

    let message =
      `${icon} <b>${alertTitle}</b>\n\n` +
      `<b>Transaction Type:</b> <code>${this.escapeHtml(data.type)}</code>\n` +
      `<b>Status:</b> ${statusIcon} <code>${this.escapeHtml(data.status)}</code>\n` +
      `<b>Username:</b> <code>${this.escapeHtml(data.username || 'Unknown')}</code>\n` +
      `<b>Name of User:</b> ${this.escapeHtml(data.name || 'Unknown')}\n` +
      `<b>Amount:</b> <b>${this.escapeHtml(String(data.amount))}</b>\n` +
      `<b>IP Address:</b> <code>${this.escapeHtml(data.ipAddress || '127.0.0.1')}</code>\n` +
      `<b>Time (IST):</b> <code>${this.escapeHtml(timestamp)}</code>`;

    if (data.destinationOrWallet) {
      const label = data.type === 'Deposit' ? 'Wallet Address' : 'Payout Destination';
      message += `\n<b>${label}:</b> <code>${this.escapeHtml(data.destinationOrWallet)}</code>`;
    }

    if (data.txIdOrRef) {
      const label = data.type === 'Deposit' ? 'Tx Hash' : 'Reference / ID';
      message += `\n<b>${label}:</b> <code>${this.escapeHtml(data.txIdOrRef)}</code>`;
    }

    if (data.extraDetails) {
      for (const [k, v] of Object.entries(data.extraDetails)) {
        if (v != null && String(v).trim() !== '') {
          message += `\n<b>${this.escapeHtml(k)}:</b> ${this.escapeHtml(String(v))}`;
        }
      }
    }

    this.log(
      `[TRANSACTION] ${data.type} ${data.status}: user=${data.username} (${data.name}), amount=${data.amount}, ip=${data.ipAddress}`,
      'TransactionAlert',
    );
    await this.sendRawTelegramAlert(message);
  }

  private static writeToFile(level: string, message: string, context?: string, trace?: string) {
    try {
      this.ensureDirExists();
      const today = new Date();
      const dateString = today.toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `${dateString}.log`);

      const timestamp = today.toISOString();
      const contextStr = context ? ` [${context}]` : '';
      const traceStr = trace ? `\nStack: ${trace}` : '';

      const logLine = `[${timestamp}] [${level}]${contextStr} ${message}${traceStr}\n`;
      fs.appendFileSync(logFile, logLine, 'utf8');
    } catch (err) {
      console.error('DailyLogger failed to write entry to file:', err);
    }
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private static async sendRawTelegramAlert(htmlText: string) {
    const token = process.env.TELEGRAM_ALERT_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;

    if (!token || !chatId) {
      return;
    }

    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: htmlText,
          parse_mode: 'HTML',
        }),
      });
    } catch (err) {
      console.error('DailyLogger failed to send Telegram alert:', err);
    }
  }

  private static async sendTelegramAlert(level: string, message: string, context?: string, trace?: string) {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `<b>${this.escapeHtml(context)}</b>` : '<code>System</code>';
    const levelIcon = level === 'ERROR' ? '🚨' : '🔒';
    const traceStr = trace ? `\n\n<b>Stack Trace:</b>\n<code>${this.escapeHtml(trace.substring(0, 800))}</code>` : '';

    const text =
      `${levelIcon} <b>System Alert — ${level}</b>\n` +
      `<b>Time:</b> <code>${timestamp}</code>\n` +
      `<b>Module:</b> ${contextStr}\n\n` +
      `<b>Details:</b>\n${this.escapeHtml(message)}` +
      traceStr;

    await this.sendRawTelegramAlert(text);
  }
}
