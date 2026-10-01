/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL for REST + socket.io. See .env.example. */
  readonly VITE_API_BASE_URL?: string;
  /** When true, Bank Transfer payout shows as "Coming soon" on Withdraw. */
  readonly VITE_PAYOUT_BANK_HIDE?: string;
  /** When true, UPI payout shows as "Coming soon" on Withdraw. */
  readonly VITE_PAYOUT_UPI_HIDE?: string;
  /** When true, Crypto payout shows as "Coming soon" on Withdraw. */
  readonly VITE_PAYOUT_CRYPTO_HIDE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
