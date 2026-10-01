import { useState } from "react";
import { ShieldCheck, Loader2, Smartphone, Mail, Pencil, LogOut, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export interface VerifyResponse {
  twoFactorVerified: boolean;
  twoFactorMethod?: "phone" | "email" | string;
  phoneVerified?: boolean;
  emailVerified: boolean;
  phone?: string;
  email: string;
}

interface SendResponse {
  otpId: string;
  channel: "phone" | "email";
  contact: string;
  expiresAt: string;
}

type Channel = "phone" | "email";

import { API_BASE_URL as API_BASE } from "@/lib/api-base";

interface Props {
  email: string;
  phone: string;
  phoneVerified: boolean;
  onSuccess: (updated: VerifyResponse) => void;
  onCancel?: () => void;
}

function maskContact(contact: string, channel: Channel) {
  if (!contact) return "";
  if (channel === "phone") {
    const tail = contact.slice(-4);
    return `•••• ${tail}`;
  }
  const [name, domain] = contact.split("@");
  if (!domain) return contact;
  const visible = name.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(name.length - 2, 0))}@${domain}`;
}

function extractMessage(json: unknown): string {
  if (json && typeof json === "object") {
    const m = (json as { message?: unknown }).message;
    if (Array.isArray(m)) return m.filter((x) => typeof x === "string").join(", ");
    if (typeof m === "string") return m;
  }
  return "";
}

const TwoFactorModal = ({ email, phone, phoneVerified, onSuccess, onCancel }: Props) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleBackOrLogout = () => {
    if (onCancel) {
      onCancel();
    }
    logout();
    const isStaff =
      window.location.pathname.startsWith("/core-control") ||
      window.location.pathname.startsWith("/admin");
    navigate(isStaff ? "/core-control/signin" : "/auth/login", { replace: true });
  };

  const hasPhone = !!phone;
  const hasEmail = !!email;
  // Phone is captured at signup and immutable here, so default to it whenever
  // it's present; only fall back to email if there is literally no phone.
  const [channel, setChannel] = useState<Channel>(hasPhone ? "phone" : "email");
  // Editable copies of the on-file contacts so a user can correct a wrong
  // number/address before requesting the code. Sent in the /2fa/send body.
  const [phoneValue, setPhoneValue] = useState(phone);
  const [emailValue, setEmailValue] = useState(email);
  const [otpId, setOtpId] = useState<string | null>(null);
  const [contactSentTo, setContactSentTo] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const send = async () => {
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    const trimmedPhone = phoneValue.trim();
    const trimmedEmail = emailValue.trim();
    if (channel === "phone" && !trimmedPhone) {
      toast.error("Enter a mobile number to receive the code.");
      return;
    }
    if (channel === "email" && !trimmedEmail) {
      toast.error("Enter an email address to receive the code.");
      return;
    }
    setSending(true);
    try {
      // Send the (possibly edited) contact so the backend can update it on file
      // before dispatching the code.
      const body =
        channel === "phone"
          ? { channel, phone: trimmedPhone }
          : { channel, email: trimmedEmail };
      const res = await fetch(`${API_BASE}/auth/2fa/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as SendResponse | null;
      if (!res.ok) {
        const raw = extractMessage(json);
        let msg = raw || `Request failed (HTTP ${res.status})`;
        if (res.status === 429 && !raw) {
          msg = "Too many requests. Try again in a few minutes.";
        }
        toast.error(msg);
        return;
      }
      if (!json?.otpId) {
        toast.error("Could not start verification");
        return;
      }
      setOtpId(json.otpId);
      setContactSentTo(json.contact ?? "");
      const masked = maskContact(json.contact ?? "", json.channel);
      toast.success(`Code sent to ${masked || (json.channel === "phone" ? "your mobile" : "your email")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (!otpId) return;
    if (!/^\d{4,8}$/.test(code)) {
      toast.error("Enter the code from the message");
      return;
    }
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otpId, code }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = extractMessage(json) || `Request failed (HTTP ${res.status})`;
        toast.error(msg);
        if (/too many failed/i.test(msg) || /expired/i.test(msg) || /already used/i.test(msg)) {
          setOtpId(null);
          setCode("");
        }
        return;
      }
      toast.success("Two-factor authentication enabled");
      onSuccess(json as VerifyResponse);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setVerifying(false);
    }
  };

  const switchChannel = (next: Channel) => {
    if (next === channel) return;
    setChannel(next);
    setOtpId(null);
    setCode("");
    setContactSentTo("");
  };

  const channelLabel = channel === "phone" ? "mobile" : "email";
  const sendButtonLabel = channel === "phone" ? "SMS" : "email";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Verify your {channelLabel}</h2>
              <p className="text-xs text-muted-foreground">Required to continue using TrustO</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleBackOrLogout}
            title="Go back / Log out"
            aria-label="Go back or log out"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-secondary/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground hover:border-border shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Log out</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-secondary p-1">
          <button
            type="button"
            onClick={() => switchChannel("phone")}
            disabled={!hasPhone}
            className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-medium transition-colors disabled:opacity-40 ${
              channel === "phone"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" /> Mobile
            {phoneVerified && <span className="ml-1 text-[10px]">✓</span>}
          </button>
          <button
            type="button"
            onClick={() => switchChannel("email")}
            disabled={!hasEmail}
            className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-medium transition-colors disabled:opacity-40 ${
              channel === "email"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mail className="h-3.5 w-3.5" /> Email
          </button>
        </div>

        {!otpId ? (
          <div className="space-y-4 mt-5">
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="contactInput" className="text-xs text-muted-foreground">
                  {channel === "phone" ? "Mobile number" : "Email address"}
                </label>
                <span className="text-[11px] text-muted-foreground">A code will be sent here</span>
              </div>
              <div className="relative mt-1.5">
                <input
                  id="contactInput"
                  value={channel === "phone" ? phoneValue : emailValue}
                  onChange={(e) =>
                    channel === "phone"
                      ? setPhoneValue(e.target.value)
                      : setEmailValue(e.target.value)
                  }
                  type={channel === "phone" ? "tel" : "email"}
                  inputMode={channel === "phone" ? "tel" : "email"}
                  autoComplete={channel === "phone" ? "tel" : "email"}
                  placeholder={channel === "phone" ? "+14155551234" : "you@example.com"}
                  className="w-full rounded-lg border border-border bg-secondary px-4 py-3 pr-10 font-mono text-foreground break-all placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <Pencil className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {channel === "phone"
                  ? "Entered the wrong number? Edit it above — use international format, e.g. +14155551234."
                  : "Entered the wrong address? Edit it above before sending the code."}
              </p>
            </div>
            <button
              onClick={send}
              disabled={
                sending ||
                (channel === "phone" && !phoneValue.trim()) ||
                (channel === "email" && !emailValue.trim())
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              {sending ? "Sending…" : `Send code via ${sendButtonLabel}`}
            </button>
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleBackOrLogout}
                className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Go back / Log out</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-5">
            <div className="rounded-lg bg-secondary p-3 text-sm">
              <p className="text-xs text-muted-foreground">Code sent to</p>
              <p className="font-mono mt-0.5 break-all">{maskContact(contactSentTo, channel) || contactSentTo}</p>
            </div>
            <div>
              <label htmlFor="otpInput" className="text-sm font-medium text-muted-foreground">
                Enter the code
              </label>
              <input
                id="otpInput"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                className="mt-2 w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-center text-lg tracking-widest"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setOtpId(null);
                  setCode("");
                }}
                className="flex-1 rounded-lg border border-border bg-secondary py-3 text-sm font-medium hover:bg-secondary/80"
              >
                Back
              </button>
              <button
                onClick={verify}
                disabled={verifying || code.length < 4}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                {verifying ? "Verifying…" : "Verify"}
              </button>
            </div>
            <button
              onClick={send}
              disabled={sending}
              className="block w-full text-center text-xs text-primary hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleBackOrLogout}
                className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Go back / Log out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TwoFactorModal;
