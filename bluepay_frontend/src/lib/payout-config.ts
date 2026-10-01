import { getSystemControlSettings, type MyPricing } from "@/lib/api-pricing";

export type PayoutMethod = "bank" | "upi" | "crypto";

function parseEnvBool(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

/** Per-method visibility from dynamic settings / env fallback. */
export function isPayoutMethodHidden(method: PayoutMethod, pricing?: MyPricing | null): boolean {
  if (pricing) {
    if (pricing.enableWithdrawals === false) return true;
    if (method === "bank" && pricing.enableBankWithdrawal === false) return true;
    if (method === "upi" && pricing.enableUpiWithdrawal === false) return true;
    if (method === "crypto" && pricing.enableCryptoWithdrawal === false) return true;
  }

  const controls = getSystemControlSettings();
  if (controls.enableWithdrawals === false) return true;
  if (method === "bank" && !controls.enableBankWithdrawal) return true;
  if (method === "upi" && !controls.enableUpiWithdrawal) return true;
  if (method === "crypto" && !controls.enableCryptoWithdrawal) return true;

  const envHide = parseEnvBool(
    method === "bank"
      ? import.meta.env.VITE_PAYOUT_BANK_HIDE
      : method === "upi"
      ? import.meta.env.VITE_PAYOUT_UPI_HIDE
      : import.meta.env.VITE_PAYOUT_CRYPTO_HIDE
  );
  return envHide;
}

export function getDefaultPayoutMethod(): PayoutMethod {
  const order: PayoutMethod[] = ["bank", "upi", "crypto"];
  return order.find((m) => !isPayoutMethodHidden(m)) ?? "bank";
}
