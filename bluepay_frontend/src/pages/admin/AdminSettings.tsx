import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { DollarSign, History, Percent, Save, Shield, ToggleLeft } from "lucide-react";
import { TotpSettingsCard } from "@/components/auth/TotpSettingsCard";
import { AdminPinSettingsCard } from "@/components/auth/AdminPinSettingsCard";
import { PricingHistoryDialog } from "@/components/shared/PricingHistoryDialog";
import {
  feeDecimalToPercentInput,
  feePercentInputToDecimal,
  getGlobalPricing,
  patchGlobalPricing,
  type GlobalPricing,
  getSystemControlSettings,
  saveSystemControlSettings,
  type SystemControlSettings,
} from "@/lib/api-pricing";

interface FormState {
  usdtPrice: string;
  inrPrice: string;
  upiInrPrice: string;
  feePercent: string;
  bankFee: string;
  cryptoFee: string;
  smartToggleMinUsdt: string;
}

function pricingToForm(p: GlobalPricing | null): FormState {
  if (!p) return { usdtPrice: "", inrPrice: "", upiInrPrice: "", feePercent: "", bankFee: "", cryptoFee: "", smartToggleMinUsdt: "" };
  return {
    usdtPrice: String(p.usdtPrice),
    inrPrice: String(p.inrPrice),
    upiInrPrice: String(p.upiInrPrice ?? ""),
    feePercent: feeDecimalToPercentInput(p.feePercent),
    bankFee: feeDecimalToPercentInput(p.bankFee ?? 0),
    cryptoFee: feeDecimalToPercentInput(p.cryptoFee ?? 0),
    smartToggleMinUsdt: String(p.smartToggleMinUsdt ?? 100),
  };
}

type GlobalPricingFields = Pick<
  GlobalPricing,
  "usdtPrice" | "inrPrice" | "upiInrPrice" | "feePercent" | "bankFee" | "cryptoFee" | "smartToggleMinUsdt"
>;

function diffPayload(form: FormState, current: GlobalPricing): Partial<GlobalPricingFields> | null {
  const payload: Partial<GlobalPricingFields> = {};
  const usdt = Number(form.usdtPrice);
  if (Number.isFinite(usdt) && usdt > 0 && usdt !== current.usdtPrice) payload.usdtPrice = usdt;
  const inr = Number(form.inrPrice);
  if (Number.isFinite(inr) && inr > 0 && inr !== current.inrPrice) payload.inrPrice = inr;
  const upiInr = Number(form.upiInrPrice);
  if (Number.isFinite(upiInr) && upiInr > 0 && upiInr !== current.upiInrPrice) payload.upiInrPrice = upiInr;
  const feeDec = feePercentInputToDecimal(form.feePercent);
  if (feeDec !== null && feeDec !== current.feePercent) payload.feePercent = feeDec;
  const bankDec = feePercentInputToDecimal(form.bankFee);
  if (bankDec !== null && bankDec !== (current.bankFee ?? 0)) payload.bankFee = bankDec;
  const cryptoDec = feePercentInputToDecimal(form.cryptoFee);
  if (cryptoDec !== null && cryptoDec !== (current.cryptoFee ?? 0)) payload.cryptoFee = cryptoDec;
  const smartMin = Number(form.smartToggleMinUsdt);
  if (Number.isFinite(smartMin) && smartMin >= 0 && smartMin !== current.smartToggleMinUsdt) payload.smartToggleMinUsdt = smartMin;
  return Object.keys(payload).length === 0 ? null : payload;
}

const AdminSettings = () => {
  const [pricing, setPricing] = useState<GlobalPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>({
    usdtPrice: "",
    inrPrice: "",
    upiInrPrice: "",
    feePercent: "",
    bankFee: "",
    cryptoFee: "",
    smartToggleMinUsdt: "",
  });
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadPricing = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const p = await getGlobalPricing(signal);
      setPricing(p);
      setForm(pricingToForm(p));
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Failed to load pricing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadPricing(controller.signal);
    return () => controller.abort();
  }, [loadPricing]);

  const pendingChanges = useMemo(() => {
    if (!pricing) return null;
    return diffPayload(form, pricing);
  }, [form, pricing]);

  const dirty = pendingChanges !== null;

  const onSave = async () => {
    if (!pricing) return;
    const payload = diffPayload(form, pricing);
    if (!payload) {
      toast.info("No changes to save");
      return;
    }
    // Pre-flight validation
    if (payload.usdtPrice !== undefined && !(payload.usdtPrice > 0)) {
      toast.error("USDT price must be a positive number");
      return;
    }
    if (payload.inrPrice !== undefined && !(payload.inrPrice > 0)) {
      toast.error("Bank Transfer Rate must be a positive number");
      return;
    }
    if (payload.upiInrPrice !== undefined && !(payload.upiInrPrice > 0)) {
      toast.error("UPI Transfer Rate must be a positive number");
      return;
    }
    if (payload.smartToggleMinUsdt !== undefined && !(payload.smartToggleMinUsdt >= 0)) {
      toast.error("Smart Toggle Min USDT must be a non-negative number");
      return;
    }
    const feeFields = [
      { key: "feePercent" as const, label: "UPI withdrawal fee" },
      { key: "bankFee" as const, label: "Bank withdrawal fee" },
      { key: "cryptoFee" as const, label: "Crypto withdrawal fee" },
    ];
    for (const { key, label } of feeFields) {
      const value = payload[key];
      if (value !== undefined && (!(value >= 0) || value >= 1)) {
        toast.error(`${label} must be between 0% and 100% (exclusive)`);
        return;
      }
    }
    setSaving(true);
    try {
      const updated = await patchGlobalPricing(payload);
      setPricing(updated);
      setForm(pricingToForm(updated));
      toast.success("Pricing updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save pricing");
    } finally {
      setSaving(false);
    }
  };

  const [systemControls, setSystemControls] = useState<SystemControlSettings>(getSystemControlSettings());

  const handleToggleSystemControl = async (key: keyof SystemControlSettings, label: string) => {
    const nextVal = !systemControls[key];
    const nextControls = { ...systemControls, [key]: nextVal };
    setSystemControls(nextControls);
    saveSystemControlSettings(nextControls);
    try {
      const updated = await patchGlobalPricing({ [key]: nextVal } as any);
      setPricing(updated);
      toast.success(`${label} ${nextVal ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to save ${label} setting`);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure global pricing and toggle system controls.
        </p>
      </div>

      {/* Global pricing */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card space-y-5 p-4 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" /> Global pricing
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              These rates apply to every user unless overridden on the user's profile. Updates
              are snapshotted onto withdrawals at creation time — changing pricing here does not
              affect pending or paid withdrawals.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs hover:bg-secondary/70"
          >
            <History className="h-3 w-3" /> History
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="usdt-price" className="text-xs font-medium text-muted-foreground">
              USDT price ($)
            </label>
            <input
              id="usdt-price"
              inputMode="decimal"
              value={form.usdtPrice}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) setForm((f) => ({ ...f, usdtPrice: v }));
              }}
              placeholder="1"
              disabled={loading}
              className="mt-2 w-full rounded-lg border border-border bg-secondary px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="inr-price" className="text-xs font-medium text-muted-foreground">
              Bank Transfer Rate (₹)
            </label>
            <input
              id="inr-price"
              inputMode="decimal"
              value={form.inrPrice}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) setForm((f) => ({ ...f, inrPrice: v }));
              }}
              placeholder="90.00"
              disabled={loading}
              className="mt-2 w-full rounded-lg border border-border bg-secondary px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="upi-inr-price" className="text-xs font-medium text-muted-foreground">
              UPI Transfer Rate (₹)
            </label>
            <input
              id="upi-inr-price"
              inputMode="decimal"
              value={form.upiInrPrice}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) setForm((f) => ({ ...f, upiInrPrice: v }));
              }}
              placeholder="95.00"
              disabled={loading}
              className="mt-2 w-full rounded-lg border border-border bg-secondary px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="fee-percent"
              className="text-xs font-medium text-muted-foreground flex items-center gap-1"
            >
             UPI withdrawal fee (%)
            </label>
            <input
              id="fee-percent"
              inputMode="decimal"
              value={form.feePercent}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) setForm((f) => ({ ...f, feePercent: v }));
              }}
              placeholder="1.5"
              disabled={loading}
              className="mt-2 w-full rounded-lg border border-border bg-secondary px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="bank-fee"
              className="text-xs font-medium text-muted-foreground flex items-center gap-1"
            >
              Bank withdrawal fee (%)
            </label>
            <input
              id="bank-fee"
              inputMode="decimal"
              value={form.bankFee}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) setForm((f) => ({ ...f, bankFee: v }));
              }}
              placeholder="0"
              disabled={loading}
              className="mt-2 w-full rounded-lg border border-border bg-secondary px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="crypto-fee"
              className="text-xs font-medium text-muted-foreground flex items-center gap-1"
            >
              Crypto withdrawal fee (%)
            </label>
            <input
              id="crypto-fee"
              inputMode="decimal"
              value={form.cryptoFee}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) setForm((f) => ({ ...f, cryptoFee: v }));
              }}
              placeholder="0"
              disabled={loading}
              className="mt-2 w-full rounded-lg border border-border bg-secondary px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="smart-min-usdt"
              className="text-xs font-medium text-muted-foreground flex items-center gap-1"
            >
              Smart Toggle Min USDT ($)
            </label>
            <input
              id="smart-min-usdt"
              inputMode="decimal"
              value={form.smartToggleMinUsdt}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) setForm((f) => ({ ...f, smartToggleMinUsdt: v }));
              }}
              placeholder="100"
              disabled={loading}
              className="mt-2 w-full rounded-lg border border-border bg-secondary px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>
        </div>

        {pricing && (
          <p className="text-[11px] text-muted-foreground">
            Last updated{" "}
            <span className="font-mono">
              {new Date(pricing.updatedAt).toLocaleString()}
            </span>
            {pricing.updatedBy ? (
              <>
                {" "}
                by {pricing.updatedByType === "staff" ? "staff" : "user"}{" "}
                <span className="font-mono">{pricing.updatedBy.slice(-8)}</span>
              </>
            ) : null}
            .
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || loading || !dirty}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />{" "}
            {saving ? "Saving…" : dirty ? "Save pricing" : "No changes"}
          </button>
        </div>
      </motion.div>

      {/* System Toggles */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card space-y-4 p-4 sm:p-6"
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ToggleLeft className="w-5 h-5 text-primary" /> System Controls
        </h2>
        <p className="text-xs text-muted-foreground">
          Turn individual withdrawal methods on or off across the platform. Disabled options show &quot;Coming soon&quot; and block withdrawal requests.
        </p>

        {[
          {
            key: "enableDeposits" as const,
            label: "Enable Deposits",
            desc: "Allow users to deposit USDT",
            enabled: systemControls.enableDeposits,
          },
          {
            key: "enableWithdrawals" as const,
            label: "Enable Withdrawals",
            desc: "Allow users to withdraw INR globally",
            enabled: systemControls.enableWithdrawals,
          },
          {
            key: "enableBankWithdrawal" as const,
            label: "Bank Transfer Withdrawal",
            desc: "Allow users to withdraw INR to Bank Account",
            enabled: systemControls.enableBankWithdrawal,
          },
          {
            key: "enableUpiWithdrawal" as const,
            label: "UPI Withdrawal",
            desc: "Allow users to withdraw INR via UPI ID",
            enabled: systemControls.enableUpiWithdrawal,
          },
          {
            key: "enableSmartUpiWithdrawal" as const,
            label: "Smart UPI Withdrawal",
            desc: "Allow users to enable auto-liquidation Smart UPI",
            enabled: systemControls.enableSmartUpiWithdrawal,
          },
          {
            key: "enableCryptoWithdrawal" as const,
            label: "Crypto (TRC-20) Withdrawal",
            desc: "Allow users to withdraw USDT via TRC-20 on-chain",
            enabled: systemControls.enableCryptoWithdrawal,
          },
          {
            key: "enableSweep" as const,
            label: "Auto-Sweep Engine (USDT Consolidation)",
            desc: "Automatically consolidate user deposit balances into collection vault",
            enabled: systemControls.enableSweep,
          },
        ].map((toggle) => (
          <div
            key={toggle.key}
            className="flex flex-col gap-3 border-b border-border/40 py-3.5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{toggle.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{toggle.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSystemControl(toggle.key, toggle.label)}
              className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${toggle.enabled ? "bg-primary" : "bg-secondary border border-border"}`}
            >
              <div
                className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${toggle.enabled ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card space-y-2 p-4 sm:p-6"
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Account Security
        </h2>
        <p className="text-sm text-muted-foreground">
          Protect your sign-in with Google Authenticator and your console login PIN.
        </p>
        <TotpSettingsCard />
        <AdminPinSettingsCard />
      </motion.div>

      <PricingHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} scope="global" />
    </div>
  );
};

export default AdminSettings;
