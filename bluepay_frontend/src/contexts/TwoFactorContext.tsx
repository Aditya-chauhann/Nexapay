import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import TwoFactorModal, { type VerifyResponse } from "@/components/auth/TwoFactorModal";
import { API_BASE_URL } from "@/lib/api-base";

export type TwoFactorMethod = "phone" | "email" | null;

export interface TwoFactorState {
  twoFactorVerified: boolean;
  twoFactorMethod: TwoFactorMethod;
  emailVerified: boolean;
  email: string;
  phone: string;
  phoneVerified: boolean;
}

interface TwoFactorContextValue {
  state: TwoFactorState | null;
  requestReverify: () => void;
  refresh: () => Promise<void>;
  applyUpdate: (updated: VerifyResponse) => void;
}

const TwoFactorContext = createContext<TwoFactorContextValue | null>(null);

export function useTwoFactor() {
  const ctx = useContext(TwoFactorContext);
  if (!ctx) throw new Error("useTwoFactor must be used within TwoFactorProvider");
  return ctx;
}

function normalizeMethod(value: unknown): TwoFactorMethod {
  if (value === "phone" || value === "email") return value;
  return null;
}

export function TwoFactorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TwoFactorState | null>(null);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return;
      setState({
        twoFactorVerified: !!(body?.twoFactorVerified ?? body?.profile?.twoFactorVerified),
        twoFactorMethod: normalizeMethod(body?.twoFactorMethod ?? body?.profile?.twoFactorMethod),
        emailVerified: !!(body?.emailVerified ?? body?.profile?.emailVerified),
        email: body?.profile?.email ?? body?.email ?? "",
        phone: body?.profile?.phone ?? body?.phone ?? "",
        phoneVerified: !!(body?.phoneVerified ?? body?.profile?.phoneVerified),
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestReverify = useCallback(() => {
    setState((s) => (s ? { ...s, twoFactorVerified: false } : s));
  }, []);

  const applyUpdate = useCallback((updated: VerifyResponse) => {
    setState((prev) => ({
      twoFactorVerified: !!updated.twoFactorVerified,
      twoFactorMethod: normalizeMethod(updated.twoFactorMethod),
      emailVerified: !!updated.emailVerified,
      email: updated.email ?? prev?.email ?? "",
      phone: updated.phone ?? prev?.phone ?? "",
      phoneVerified: !!(updated.phoneVerified ?? prev?.phoneVerified),
    }));
  }, []);

  const cancelVerification = useCallback(() => {
    setState(null);
  }, []);

  const showModal = state != null && !state.twoFactorVerified;

  return (
    <TwoFactorContext.Provider value={{ state, requestReverify, refresh, applyUpdate }}>
      {children}
      {showModal && state && (
        <TwoFactorModal
          email={state.email}
          phone={state.phone}
          phoneVerified={state.phoneVerified}
          onSuccess={applyUpdate}
          onCancel={cancelVerification}
        />
      )}
    </TwoFactorContext.Provider>
  );
}
