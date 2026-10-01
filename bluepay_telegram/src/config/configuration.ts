export default () => ({
  port: parseInt(process.env.PORT ?? '3005', 10),
  // Accept either MONGO_URI or MONGODB_URI (empty values fall through to the
  // default via `||`, so a blank key doesn't produce a broken connection string).
  mongoUri:
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/payout-bridge',

  inboundApiKey: process.env.INBOUND_API_KEY ?? '',

  ocrProvider: process.env.OCR_PROVIDER ?? 'openai',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    botUsername: process.env.TELEGRAM_BOT_USERNAME ?? '',
    groupChatId: process.env.TELEGRAM_GROUP_CHAT_ID ?? '',
    // BotFather Mini App short name (from /newapp) used to build the group
    // "Upload screenshot" direct-link button (t.me/<bot>/<shortName>?startapp=…).
    miniAppShortName: process.env.TELEGRAM_MINIAPP_SHORT_NAME ?? '',
    // Public HTTPS origin where THIS bridge is reachable (ngrok locally, the
    // Render URL in prod). This is the base you register in BotFather as the
    // Mini App's Web App URL: `<this>/miniapp/upload`. Must be https in prod.
    miniAppBaseUrl: process.env.TELEGRAM_MINIAPP_BASE_URL ?? '',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  },

  callback: {
    url: process.env.TRONPAY_CALLBACK_URL ?? '',
    signingSecret: process.env.CALLBACK_SIGNING_SECRET ?? '',
  },
});
