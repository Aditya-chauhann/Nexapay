import { createHmac, timingSafeEqual } from 'crypto';

export interface TelegramInitUser {
  id: number;
  username?: string;
  first_name?: string;
}

export interface VerifiedInitData {
  valid: boolean;
  user: TelegramInitUser | null;
}

/**
 * Verify a Telegram Mini App `initData` string against the bot token.
 * See https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *   secret_key   = HMAC_SHA256(key="WebAppData", msg=bot_token)
 *   expected_hash= HMAC_SHA256(key=secret_key,   msg=data_check_string)
 * `data_check_string` = all fields except `hash`, as `key=value`, sorted, '\n'-joined.
 * Also rejects stale payloads (default 1h) to prevent replay.
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 3600,
): VerifiedInitData {
  try {
    if (!initData || !botToken) return { valid: false, user: null };
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false, user: null };
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    const expected = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, user: null };
    }

    const authDate = Number(params.get('auth_date') ?? 0);
    if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) {
      return { valid: false, user: null };
    }

    const userRaw = params.get('user');
    const user = userRaw
      ? (JSON.parse(userRaw) as TelegramInitUser)
      : null;
    return { valid: true, user };
  } catch {
    return { valid: false, user: null };
  }
}
