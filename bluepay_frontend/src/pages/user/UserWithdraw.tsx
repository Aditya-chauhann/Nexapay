import {
  AlertTriangle,
  ArrowUpFromLine,
  ArrowUp,
  Banknote,
  Bitcoin,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  FileText,
  HelpCircle,
  IndianRupee,
  Info,
  Landmark,
  Percent,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Smartphone,
  Tag as TagIcon,
  Trash2,
  Wallet,
  X,
  ChevronDown,
  Check,
  Pencil,
  Zap,
  Sparkles,
  Star,
  XCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { getMyPricing, getSystemControlSettings, type MyPricing } from "@/lib/api-pricing";
import { getPinStatus, setupPin, type PinStatus } from "@/lib/api-pin";
import {
  UPI_ID_REGEX,
  createUpiAccount,
  listUpiAccounts,
  updateUpiAccount,
  deleteUpiAccount,
  getSmartUpiSelection,
  setSmartUpiSelection,
  setUpiAccountActive,
  setDefaultUpiAccount,
  type UpiAccount,
  type UpiApprovalStatus,
} from "@/lib/api-upi";
import { tagBadgeStyle, tagEmoji } from "@/lib/tag-colors";
import { API_BASE_URL as API_BASE } from "@/lib/api-base";

interface UserTagInfo {
  id: string;
  name: string;
  rank: number;
  color: string | null;
  benefitInr: number;
}

type BankApprovalStatus = "approved" | "pending" | "rejected";

interface BankAccount {
  id: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName?: string | null;
  isDefault: boolean;
  approvalStatus: BankApprovalStatus;
}

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_REGEX = /^\d{6,20}$/;
const TRC20_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

function maskAccount(account: string) {
  const v = (account ?? "").replace(/\s/g, "");
  if (v.length <= 4) return `****${v}`;
  return `****${v.slice(-4)}`;
}

export default function UserWithdraw() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<"bank" | "upi" | "crypto">("bank");
  const [amount, setAmount] = useState<string>("100");
  const [available, setAvailable] = useState<string>("0.00");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Bank Accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(true);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const [bankSelectorOpen, setBankSelectorOpen] = useState(false);

  // Add Bank Account Form State & Confirmation
  const [showAddForm, setShowAddForm] = useState(false);
  const [bankFormStep, setBankFormStep] = useState<"input" | "confirm">("input");
  const [newHolder, setNewHolder] = useState("");
  const [newAccount, setNewAccount] = useState("");
  const [newIfsc, setNewIfsc] = useState("");
  const [newBankName, setNewBankName] = useState("");
  const [newMakeDefault, setNewMakeDefault] = useState(false);
  const [savingNewAccount, setSavingNewAccount] = useState(false);

  // Edit Bank Account State & Confirmation
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [editBankStep, setEditBankStep] = useState<"input" | "confirm">("input");
  const [editBankHolder, setEditBankHolder] = useState("");
  const [editBankAccount, setEditBankAccount] = useState("");
  const [editBankIfsc, setEditBankIfsc] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editBankDefault, setEditBankDefault] = useState(false);
  const [savingEditBank, setSavingEditBank] = useState(false);

  // Delete Bank Account State
  const [deletingBank, setDeletingBank] = useState<BankAccount | null>(null);
  const [deletingBankLoading, setDeletingBankLoading] = useState(false);

  // UPI Accounts & Confirmation
  const [upiAccounts, setUpiAccounts] = useState<UpiAccount[]>([]);
  const [selectedUpiId, setSelectedUpiId] = useState<string | null>(null);
  const [upiSelectorOpen, setUpiSelectorOpen] = useState(false);
  const [showAddUpiForm, setShowAddUpiForm] = useState(false);
  const [upiFormStep, setUpiFormStep] = useState<"input" | "confirm">("input");
  const [newUpiId, setNewUpiId] = useState("");
  const [newUpiHolder, setNewUpiHolder] = useState("");
  const [savingUpi, setSavingUpi] = useState(false);

  // Edit UPI State & Confirmation
  const [editingUpi, setEditingUpi] = useState<UpiAccount | null>(null);
  const [editUpiStep, setEditUpiStep] = useState<"input" | "confirm">("input");
  const [editUpiId, setEditUpiId] = useState("");
  const [editUpiHolder, setEditUpiHolder] = useState("");
  const [savingEditUpi, setSavingEditUpi] = useState(false);

  // Delete UPI State
  const [deletingUpi, setDeletingUpi] = useState<UpiAccount | null>(null);
  const [deletingUpiLoading, setDeletingUpiLoading] = useState(false);

  // Smart UPI Auto-Routing State
  const [smartUpiEnabled, setSmartUpiEnabled] = useState(false);
  const [smartUpiLoading, setSmartUpiLoading] = useState(true);
  const [pendingSmartUpi, setPendingSmartUpi] = useState(false);
  const [pendingUpiActiveId, setPendingUpiActiveId] = useState<string | null>(null);
  const [pendingUpiDefaultId, setPendingUpiDefaultId] = useState<string | null>(null);

  // Pricing & Tags
  const [myPricing, setMyPricing] = useState<MyPricing | null>(null);
  const [userTag, setUserTag] = useState<UserTagInfo | null>(null);
  const [rateRefreshing, setRateRefreshing] = useState(false);

  // Security PIN & Inline Setup
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [setupPinEntry, setSetupPinEntry] = useState("");
  const [setupConfirmPinEntry, setSetupConfirmPinEntry] = useState("");
  const [isSettingUpPin, setIsSettingUpPin] = useState(false);

  // Info modal
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  // Rate calculations
  const usdtInrRate = method === "upi" ? myPricing?.upiInrPrice ?? 100 : myPricing?.inrPrice ?? 100;
  const feeDecimal =
    method === "upi"
      ? myPricing?.feePercent ?? 0
      : method === "bank"
      ? myPricing?.bankFee ?? 0
      : myPricing?.cryptoFee ?? 0;
  const feePercentDisplay = (feeDecimal * 100).toFixed(0);
  const minUsdt = myPricing?.smartToggleMinUsdt ?? 100;

  const parsedAmount = parseFloat(amount);
  const hasAmount = amount !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const feeApplies = feeDecimal > 0;
  const grossInr = hasAmount ? parsedAmount * usdtInrRate : 0;
  const feeInr = hasAmount && feeApplies ? grossInr * feeDecimal : 0;
  const tierBonusPerUsdt = userTag?.benefitInr ?? 0;
  const tierBonusInr = hasAmount ? parsedAmount * tierBonusPerUsdt : 0;
  const netInr = hasAmount ? Math.max(0, grossInr - feeInr + tierBonusInr) : 0;
  const feeUsdt = hasAmount && feeApplies ? parsedAmount * feeDecimal : 0;

  const authHeaders = (): Record<string, string> | null => {
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  };

  // Fetch Pricing & Balances
  const loadPricingAndBalances = async () => {
    setRateRefreshing(true);
    try {
      const headers = authHeaders();
      if (headers) {
        const resUser = await fetch(`${API_BASE}/user`, { headers });
        const userData = await resUser.json().catch(() => null);
        if (userData?.balances?.available) {
          setAvailable(userData.balances.available);
        }
      }
      const pricing = await getMyPricing();
      if (pricing) setMyPricing(pricing);
    } catch {
      // ignore
    } finally {
      setRateRefreshing(false);
    }
  };

  useEffect(() => {
    loadPricingAndBalances();
    getPinStatus()
      .then((s) => setPinStatus(s))
      .catch(() => {});
  }, []);

  // Load saved bank accounts
  const loadBankAccounts = async () => {
    const headers = authHeaders();
    if (!headers) {
      setBankAccountsLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/user/bank-accounts`, { headers });
      const body = await res.json().catch(() => null);
      if (res.ok && Array.isArray(body)) {
        setBankAccounts(body as BankAccount[]);
        const defaultAcc = body.find((b: BankAccount) => b.isDefault);
        if (defaultAcc) setSelectedBankAccountId(defaultAcc.id);
        else if (body.length > 0) setSelectedBankAccountId(body[0].id);
      }
    } catch {
      // ignore
    } finally {
      setBankAccountsLoading(false);
    }
  };

  // Load saved UPI accounts
  const loadUpiAccountsList = async () => {
    try {
      const list = await listUpiAccounts();
      setUpiAccounts(list);
      const defaultUpi = list.find((u) => u.isDefault);
      if (defaultUpi) setSelectedUpiId(defaultUpi.id);
      else if (list.length > 0) setSelectedUpiId(list[0].id);
    } catch {
      // ignore
    }
  };

  // Load Smart UPI selection setting
  const loadSmartUpi = async (signal?: AbortSignal) => {
    try {
      const enabled = await getSmartUpiSelection(signal);
      setSmartUpiEnabled(enabled);
    } catch {
      // Non-fatal: default to manual mode if setting cannot be fetched
    } finally {
      setSmartUpiLoading(false);
    }
  };

  useEffect(() => {
    loadBankAccounts();
    loadUpiAccountsList();
    const controller = new AbortController();
    void loadSmartUpi(controller.signal);
    return () => controller.abort();
  }, []);

  // Step 1: Validate Bank Account & proceed to Confirmation
  const handleReviewBankAccount = () => {
    if (!newHolder.trim()) return toast.error("Account holder name required");
    if (!ACCOUNT_NUMBER_REGEX.test(newAccount.trim()))
      return toast.error("Invalid account number (6-20 digits)");
    if (!IFSC_REGEX.test(newIfsc.trim().toUpperCase()))
      return toast.error("Invalid IFSC format (e.g. SBIN0001234)");

    setBankFormStep("confirm");
  };

  // Step 2: Actually Save Bank Account after user confirmation
  const handleConfirmSaveBankAccount = async () => {
    setSavingNewAccount(true);
    try {
      const headers = authHeaders();
      const res = await fetch(`${API_BASE}/user/bank-accounts`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHolderName: newHolder.trim(),
          accountNumber: newAccount.trim(),
          ifscCode: newIfsc.trim().toUpperCase(),
          bankName: newBankName.trim() || undefined,
          isDefault: newMakeDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add bank account");
      toast.success("Bank account saved successfully!");
      setShowAddForm(false);
      setBankFormStep("input");
      setNewHolder("");
      setNewAccount("");
      setNewIfsc("");
      setNewBankName("");
      loadBankAccounts();
    } catch (err: any) {
      toast.error(err.message || "Failed to add account");
    } finally {
      setSavingNewAccount(false);
    }
  };

  // Step 1: Validate UPI & proceed to Confirmation
  const handleReviewUpi = () => {
    if (!newUpiHolder.trim()) return toast.error("Holder name required");
    if (!UPI_ID_REGEX.test(newUpiId.trim())) return toast.error("Invalid UPI ID format (e.g. username@bank)");

    setUpiFormStep("confirm");
  };

  // Step 2: Actually Save UPI after user confirmation
  const handleConfirmSaveUpi = async () => {
    setSavingUpi(true);
    try {
      await createUpiAccount({
        upiId: newUpiId.trim(),
        accountHolderName: newUpiHolder.trim(),
        isDefault: true,
      });
      toast.success("UPI ID added successfully!");
      setShowAddUpiForm(false);
      setUpiFormStep("input");
      setNewUpiId("");
      setNewUpiHolder("");
      loadUpiAccountsList();
    } catch (err: any) {
      toast.error(err.message || "Failed to save UPI ID");
    } finally {
      setSavingUpi(false);
    }
  };

  // Start Editing Bank Account
  const startEditBank = (b: BankAccount) => {
    setEditingBank(b);
    setEditBankHolder(b.accountHolderName);
    setEditBankAccount(b.accountNumber);
    setEditBankIfsc(b.ifscCode);
    setEditBankName(b.bankName || "");
    setEditBankDefault(b.isDefault);
    setEditBankStep("input");
  };

  // Review Bank Edit (proceed to confirmation screen)
  const handleReviewEditBank = () => {
    if (!editBankHolder.trim()) return toast.error("Account holder name required");
    if (!ACCOUNT_NUMBER_REGEX.test(editBankAccount.trim()))
      return toast.error("Invalid account number (6-20 digits)");
    if (!IFSC_REGEX.test(editBankIfsc.trim().toUpperCase()))
      return toast.error("Invalid IFSC format (e.g. SBIN0001234)");

    setEditBankStep("confirm");
  };

  // Confirm and Save Edited Bank Account
  const handleConfirmUpdateBank = async () => {
    if (!editingBank) return;
    setSavingEditBank(true);
    try {
      const headers = authHeaders();
      const res = await fetch(`${API_BASE}/user/bank-accounts/${editingBank.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHolderName: editBankHolder.trim(),
          accountNumber: editBankAccount.trim(),
          ifscCode: editBankIfsc.trim().toUpperCase(),
          bankName: editBankName.trim() || undefined,
          isDefault: editBankDefault,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Failed to update bank account");
      toast.success("Bank account updated successfully!");
      setEditingBank(null);
      setEditBankStep("input");
      loadBankAccounts();
    } catch (err: any) {
      toast.error(err.message || "Failed to update account");
    } finally {
      setSavingEditBank(false);
    }
  };

  // Start Delete Bank Account
  const startDeleteBank = (b: BankAccount) => {
    setDeletingBank(b);
  };

  // Confirm Delete Bank Account
  const handleConfirmDeleteBank = async () => {
    if (!deletingBank) return;
    setDeletingBankLoading(true);
    try {
      const headers = authHeaders();
      const res = await fetch(`${API_BASE}/user/bank-accounts/${deletingBank.id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to delete bank account");
      }
      toast.success("Bank account deleted successfully!");
      if (selectedBankAccountId === deletingBank.id) {
        setSelectedBankAccountId(null);
      }
      setDeletingBank(null);
      loadBankAccounts();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
    } finally {
      setDeletingBankLoading(false);
    }
  };

  // Start Editing UPI Account
  const startEditUpi = (u: UpiAccount) => {
    setEditingUpi(u);
    setEditUpiId(u.upiId);
    setEditUpiHolder(u.accountHolderName);
    setEditUpiStep("input");
  };

  // Review UPI Edit (proceed to confirmation screen)
  const handleReviewEditUpi = () => {
    if (!editUpiHolder.trim()) return toast.error("Holder name required");
    if (!UPI_ID_REGEX.test(editUpiId.trim()))
      return toast.error("Invalid UPI ID format (e.g. username@bank)");

    setEditUpiStep("confirm");
  };

  // Confirm and Save Edited UPI Account
  const handleConfirmUpdateUpi = async () => {
    if (!editingUpi) return;
    setSavingEditUpi(true);
    try {
      await updateUpiAccount(editingUpi.id, {
        upiId: editUpiId.trim(),
        accountHolderName: editUpiHolder.trim(),
      });
      toast.success("UPI ID updated successfully!");
      setEditingUpi(null);
      setEditUpiStep("input");
      loadUpiAccountsList();
    } catch (err: any) {
      toast.error(err.message || "Failed to update UPI ID");
    } finally {
      setSavingEditUpi(false);
    }
  };

  // Start Delete UPI Account
  const startDeleteUpi = (u: UpiAccount) => {
    setDeletingUpi(u);
  };

  // Confirm Delete UPI Account
  const handleConfirmDeleteUpi = async () => {
    if (!deletingUpi) return;
    setDeletingUpiLoading(true);
    try {
      await deleteUpiAccount(deletingUpi.id);
      toast.success("UPI ID deleted successfully!");
      if (selectedUpiId === deletingUpi.id) {
        setSelectedUpiId(null);
      }
      setDeletingUpi(null);
      loadUpiAccountsList();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete UPI ID");
    } finally {
      setDeletingUpiLoading(false);
    }
  };

  // Toggle Smart UPI Auto-Routing
  const toggleSmartUpi = async (next: boolean) => {
    if (pendingSmartUpi) return;
    if (next) {
      const availBal = parseFloat(available);
      if (availBal < minUsdt) {
        toast.error(
          `Minimum balance of ${minUsdt} USDT is required to enable Smart UPI. Your available balance is ${availBal.toFixed(2)} USDT.`
        );
        return;
      }
      if (upiAccounts.length === 0) {
        toast.error("Please add at least one UPI ID first before enabling Smart UPI.");
        return;
      }
      const activeApproved = upiAccounts.filter(
        (u) => u.isActive && u.approvalStatus === "approved"
      );
      if (activeApproved.length === 0) {
        toast.error(
          "You need at least one active & approved UPI ID to enable Smart UPI auto-routing."
        );
        return;
      }
    }

    setSmartUpiEnabled(next); // optimistic
    setPendingSmartUpi(true);
    try {
      const updated = await setSmartUpiSelection(next);
      setSmartUpiEnabled(updated);
      if (updated) {
        toast.success("Smart UPI Auto-Routing enabled!", {
          description:
            "Withdrawals are now automatically routed across your active approved UPI IDs.",
        });
      } else {
        toast.info("Smart UPI disabled", {
          description: "Switched back to manual UPI account selection.",
        });
      }
    } catch (err: any) {
      setSmartUpiEnabled(!next); // revert
      toast.error(err?.message || "Failed to update Smart UPI state");
    } finally {
      setPendingSmartUpi(false);
    }
  };

  // Toggle individual UPI account active status in pool
  const toggleUpiActive = async (acc: UpiAccount, next: boolean) => {
    if (acc.isDefault && !next) {
      toast.error("Cannot deactivate default UPI ID. Set another UPI as default first.");
      return;
    }
    setPendingUpiActiveId(acc.id);
    try {
      const updated = await setUpiAccountActive(acc.id, next);
      if (updated) {
        setUpiAccounts((prev) => prev.map((a) => (a.id === acc.id ? updated : a)));
      } else {
        setUpiAccounts((prev) =>
          prev.map((a) => (a.id === acc.id ? { ...a, isActive: next } : a))
        );
      }
      toast.success(`UPI ID ${acc.upiId} ${next ? "activated" : "deactivated"}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to toggle UPI active status");
    } finally {
      setPendingUpiActiveId(null);
    }
  };

  // Make UPI account default
  const makeDefaultUpiAccount = async (id: string) => {
    setPendingUpiDefaultId(id);
    try {
      await setDefaultUpiAccount(id);
      setUpiAccounts((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.id === id }))
      );
      setSelectedUpiId(id);
      toast.success("Default UPI ID updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to set default UPI account");
    } finally {
      setPendingUpiDefaultId(null);
    }
  };

  // Handle Withdrawal Request Trigger - ALWAYS open Confirmation & PIN Modal
  const handleRequestWithdrawal = () => {
    if (!hasAmount) return toast.error("Please enter a valid amount");
    if (parsedAmount < minUsdt)
      return toast.error(`Minimum withdrawal is ${minUsdt} USDT`);
    if (parsedAmount > parseFloat(available))
      return toast.error("Insufficient available balance");

    if (method === "bank" && !selectedBankAccountId && bankAccounts.length === 0) {
      return toast.error("Please select or add a bank account");
    }
    if (method === "upi") {
      if (smartUpiEnabled) {
        return toast.info("Smart UPI is active", {
          description: "Turn off Smart UPI Selection above to make a manual withdrawal.",
        });
      }
      if (!selectedUpiId && upiAccounts.length === 0) {
        return toast.error("Please select or add a UPI ID");
      }
    }
    if (method === "crypto" && !TRC20_ADDRESS_REGEX.test(destinationAddress.trim())) {
      return toast.error("Please enter a valid TRC-20 destination address");
    }

    setPinError(null);
    setPinEntry("");
    setPinPromptOpen(true);
  };

  // Submit Withdrawal with 6-digit PIN
  const submitWithdrawal = async (enteredPin?: string) => {
    if (!enteredPin || enteredPin.length !== 6) {
      setPinError("Please enter your 6-digit Security PIN");
      return;
    }
    setSubmitting(true);
    try {
      const headers = authHeaders();
      const payload: Record<string, any> = {
        amount: parsedAmount,
        method,
        pin: enteredPin,
      };

      if (method === "bank") {
        payload.bankAccountId = selectedBankAccountId || selectedBank?.id;
      } else if (method === "upi") {
        if (!smartUpiEnabled) {
          payload.upiAccountId = selectedUpiId || selectedUpi?.id;
        }
      } else if (method === "crypto") {
        payload.destinationAddress = destinationAddress.trim();
        payload.network = "TRC20";
      }

      const res = await fetch(`${API_BASE}/user/withdrawals`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(data?.message) ? data.message.join(", ") : data?.message || `Withdrawal failed (HTTP ${res.status})`;
        const code = typeof data?.code === "string" ? data.code : typeof data?.errorCode === "string" ? data.errorCode : "";
        if (code === "WITHDRAWAL_PIN_INVALID") {
          const attempts = typeof data?.attemptsRemaining === "number" ? data.attemptsRemaining : null;
          setPinError(attempts !== null ? `Wrong PIN — ${attempts} attempts left` : "Wrong PIN — please try again");
          setPinEntry("");
          return;
        }
        if (code === "WITHDRAWAL_PIN_LOCKED") {
          setPinPromptOpen(false);
          toast.error("PIN locked after too many wrong attempts. Reset it from Profile.");
          return;
        }
        if (code === "WITHDRAWAL_PIN_REQUIRED") {
          setPinStatus({ pinSet: false, locked: false, lockedUntil: null });
          setPinError("Please set up your 6-digit withdrawal PIN below");
          return;
        }
        if (code === "SMART_LIQUIDATION_ACTIVE") {
          setPinPromptOpen(false);
          setSmartUpiEnabled(true);
          toast.error("Turn off Smart UPI Selection to make a manual withdrawal.");
          return;
        }
        throw new Error(msg);
      }

      toast.success("Withdrawal requested successfully!");
      setPinPromptOpen(false);
      setPinEntry("");
      loadPricingAndBalances();
      navigate("/user/transactions?type=Withdrawal");
    } catch (err: any) {
      setPinError(err.message || "Withdrawal failed");
      toast.error(err.message || "Withdrawal failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Setup PIN and submit withdrawal in one step if PIN was not set
  const handleSetupPinAndWithdraw = async () => {
    if (!/^\d{6}$/.test(setupPinEntry)) {
      return setPinError("PIN must be exactly 6 digits");
    }
    if (setupPinEntry !== setupConfirmPinEntry) {
      return setPinError("PIN and confirmation PIN do not match");
    }
    setIsSettingUpPin(true);
    setPinError(null);
    try {
      await setupPin(setupPinEntry, setupConfirmPinEntry);
      toast.success("6-digit PIN created successfully!");
      setPinStatus({ pinSet: true, locked: false, lockedUntil: null });
      await submitWithdrawal(setupPinEntry);
    } catch (err: any) {
      setPinError(err.message || "Failed to set PIN");
      toast.error(err.message || "Failed to set PIN");
    } finally {
      setIsSettingUpPin(false);
    }
  };

  const selectedBank = useMemo(() => {
    return bankAccounts.find((b) => b.id === selectedBankAccountId) ?? bankAccounts[0] ?? null;
  }, [bankAccounts, selectedBankAccountId]);

  const selectedUpi = useMemo(() => {
    return upiAccounts.find((u) => u.id === selectedUpiId) ?? upiAccounts[0] ?? null;
  }, [upiAccounts, selectedUpiId]);

  const activeApprovedUpiCount = useMemo(() => {
    return upiAccounts.filter((u) => u.isActive && u.approvalStatus === "approved").length;
  }, [upiAccounts]);

  const activeApprovedUpis = useMemo(() => {
    return upiAccounts.filter((u) => u.isActive && u.approvalStatus === "approved");
  }, [upiAccounts]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Withdraw to INR</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Convert USDT to INR and receive in your bank account or via UPI
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHowItWorksOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors self-start sm:self-auto"
        >
          <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
          How it works?
        </button>
      </div>

      {/* Row 1: 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Available Balance */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-blue-500/15 hover:border-blue-400 group cursor-pointer">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Available Balance</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {parseFloat(available).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USDT
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">
              ≈ ₹
              {(parseFloat(available) * usdtInrRate).toLocaleString("en-IN", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
          </div>
        </div>

        {/* Exchange Rate */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-emerald-500/15 hover:border-emerald-400 group cursor-pointer">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Exchange Rate</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">₹{usdtInrRate} / USDT</div>
            <div className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Live rate
            </div>
          </div>
        </div>

        {/* Min. Withdrawal */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-sky-500/15 hover:border-sky-400 group cursor-pointer">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Min. Withdrawal</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{minUsdt} USDT</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">
              ≈ ₹{(minUsdt * usdtInrRate).toLocaleString("en-IN")}
            </div>
          </div>
        </div>

        {/* Withdrawal Fee */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-500/15 hover:border-indigo-400 group cursor-pointer">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Withdrawal Fee</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{feePercentDisplay}%</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">
              {feeDecimal === 0 ? "No fee" : `Flat ${feePercentDisplay}%`}
            </div>
          </div>
        </div>
      </div>

      {/* Stepper Header */}
      <div className="flex items-center justify-center gap-3 sm:gap-6 py-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
            1
          </div>
          <span className="text-xs font-bold text-slate-900">Enter Details</span>
        </div>
        <div className="w-12 sm:w-24 h-0.5 bg-slate-200" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-xs font-bold flex items-center justify-center">
            2
          </div>
          <span className="text-xs font-semibold text-slate-400">Confirm</span>
        </div>
        <div className="w-12 sm:w-24 h-0.5 bg-slate-200" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-xs font-bold flex items-center justify-center">
            3
          </div>
          <span className="text-xs font-semibold text-slate-400">Processing</span>
        </div>
      </div>

      {/* Main Content Grid: Left Form (8 cols) & Right Summary (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Form) */}
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
          {/* 1. Enter Amount */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">1. Enter Amount (USDT)</h3>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                className="w-full text-xl font-bold px-4 py-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/40 text-slate-900 pr-24"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <span>USDT</span>
                <span>|</span>
                <button
                  type="button"
                  onClick={() => setAmount(available)}
                  className="text-blue-600 hover:text-blue-700 font-bold"
                >
                  Max
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
              <span>Min: {minUsdt} USDT</span>
              <span>Available: {parseFloat(available).toFixed(2)} USDT</span>
            </div>

            {/* Conversion Preview Box */}
            <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100/80 text-blue-600 flex items-center justify-center font-bold">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">You will receive (INR)</div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">
                    ₹{netInr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs font-bold text-slate-700 justify-end">
                  <span>₹{usdtInrRate} / USDT</span>
                  <button
                    onClick={loadPricingAndBalances}
                    disabled={rateRefreshing}
                    className="p-1 hover:text-blue-600"
                    aria-label="Refresh live rate"
                  >
                    <RefreshCw className={`w-3 h-3 ${rateRefreshing ? "animate-spin" : ""}`} />
                  </button>
                </div>
                <div className="text-[11px] font-semibold text-emerald-600 mt-0.5">• No fee</div>
              </div>
            </div>
          </div>

          {/* 2. Select Payout Method */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-slate-900">2. Select Payout Method</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Bank Transfer */}
              <button
                type="button"
                onClick={() => setMethod("bank")}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all relative ${
                  method === "bank"
                    ? "border-blue-600 bg-blue-50/30 shadow-sm ring-1 ring-blue-600"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Landmark className={`w-6 h-6 ${method === "bank" ? "text-blue-600" : "text-slate-500"}`} />
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      method === "bank" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                    }`}
                  >
                    {method === "bank" && <Check className="w-2.5 h-2.5" />}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-sm font-bold text-slate-900">Bank Transfer</div>
                  <div className="text-xs text-slate-400 mt-0.5 font-medium">1-2 business days</div>
                </div>
              </button>

              {/* UPI */}
              <button
                type="button"
                onClick={() => setMethod("upi")}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all relative ${
                  method === "upi"
                    ? "border-blue-600 bg-blue-50/30 shadow-sm ring-1 ring-blue-600"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Smartphone className={`w-6 h-6 ${method === "upi" ? "text-blue-600" : "text-slate-500"}`} />
                  <div className="flex items-center gap-1.5">
                    {smartUpiEnabled && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 fill-emerald-700 text-emerald-700" /> SMART
                      </span>
                    )}
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        method === "upi" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                      }`}
                    >
                      {method === "upi" && <Check className="w-2.5 h-2.5" />}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-sm font-bold text-slate-900">UPI</div>
                  <div className="text-xs text-slate-400 mt-0.5 font-medium">
                    {smartUpiEnabled ? "Smart Auto-Routing active" : "Instant to UPI ID"}
                  </div>
                </div>
              </button>

              {/* Crypto Transfer */}
              <button
                type="button"
                onClick={() => setMethod("crypto")}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all relative ${
                  method === "crypto"
                    ? "border-blue-600 bg-blue-50/30 shadow-sm ring-1 ring-blue-600"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Bitcoin className={`w-6 h-6 ${method === "crypto" ? "text-blue-600" : "text-slate-500"}`} />
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      method === "crypto" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                    }`}
                  >
                    {method === "crypto" && <Check className="w-2.5 h-2.5" />}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-sm font-bold text-slate-900">Crypto Transfer</div>
                  <div className="text-xs text-slate-400 mt-0.5 font-medium">On-chain payout</div>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Account Selection */}
          {method === "bank" && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">3. Select Bank Account</h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add new account
                </button>
              </div>

              {selectedBank ? (
                <div
                  onClick={() => setBankSelectorOpen(true)}
                  className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 font-bold text-xs flex items-center justify-center">
                      {(selectedBank.bankName || "Bank").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {selectedBank.bankName || "Bank Account"}
                        </span>
                        {selectedBank.isDefault && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {selectedBank.accountHolderName} • {maskAccount(selectedBank.accountNumber)} •{" "}
                        {selectedBank.ifscCode}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditBank(selectedBank);
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit Bank Account"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startDeleteBank(selectedBank);
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Bank Account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="w-full p-4 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs font-medium hover:bg-slate-50 transition-colors"
                >
                  No bank accounts saved. Click here to add one.
                </button>
              )}
            </div>
          )}

          {method === "upi" && (
            <div className="space-y-4 pt-2">
              {/* Smart UPI Control Card */}
              <div
                className={`p-5 rounded-3xl border transition-all duration-300 ${
                  smartUpiEnabled
                    ? "bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-white border-blue-300/80 shadow-md shadow-blue-500/10"
                    : "bg-slate-50/60 border-slate-200/80 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors shadow-sm ${
                        smartUpiEnabled
                          ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-blue-500/25"
                          : "bg-slate-200/80 text-slate-600"
                      }`}
                    >
                      <Zap className={`w-5 h-5 ${smartUpiEnabled ? "fill-white" : ""}`} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">Smart UPI Auto-Routing</h3>
                        {smartUpiEnabled ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100/80 text-emerald-800 border border-emerald-300/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Active & Armed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200/70 text-slate-600">
                            Manual Mode
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-lg">
                        {myPricing?.enableSmartUpiWithdrawal === false ||
                        !getSystemControlSettings().enableSmartUpiWithdrawal
                          ? "Smart UPI is currently disabled by system policy."
                          : upiAccounts.length === 0
                          ? "Add at least one UPI ID first to enable Smart UPI auto-routing."
                          : `Automatically routes payouts across your active approved UPI IDs with instant liquidity matching (min ${minUsdt} USDT).`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-1">
                    <Switch
                      checked={smartUpiEnabled}
                      disabled={
                        myPricing?.enableSmartUpiWithdrawal === false ||
                        !getSystemControlSettings().enableSmartUpiWithdrawal ||
                        smartUpiLoading ||
                        pendingSmartUpi ||
                        upiAccounts.length === 0
                      }
                      onCheckedChange={toggleSmartUpi}
                      aria-label="Toggle Smart UPI"
                    />
                  </div>
                </div>

                {/* When Smart UPI is Enabled: Show Armed Pool & Explanation */}
                {smartUpiEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 pt-4 border-t border-blue-200/60 space-y-3"
                  >
                    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-blue-50/80 border border-blue-200/60 text-xs text-blue-900">
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-bold">Automated Liquidity Active:</span> Your balance is reserved for automated liquidity matching. Payouts arrive automatically to your active UPI IDs below as matches occur. Manual withdrawals are disabled while Smart UPI is active.
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 px-1">
                        <span>Active UPI Pool ({activeApprovedUpiCount} armed)</span>
                        <button
                          type="button"
                          onClick={() => setUpiSelectorOpen(true)}
                          className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
                        >
                          Manage All UPI IDs
                        </button>
                      </div>

                      {activeApprovedUpiCount === 0 ? (
                        <div className="p-3.5 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 text-xs text-amber-800 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>No active approved UPI IDs in pool! Add or activate one to receive automated payouts.</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {activeApprovedUpis.map((acc) => (
                            <div
                              key={acc.id}
                              className="p-3 rounded-2xl bg-white border border-blue-100 flex items-center justify-between shadow-2xs"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-900 truncate">{acc.upiId}</span>
                                  {acc.isDefault && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700">
                                      DEF
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate">{acc.accountHolderName}</div>
                              </div>
                              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Armed
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* When Smart UPI is Disabled: Show Standard Manual UPI Selector */}
              {!smartUpiEnabled && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">3. Select UPI Account</h3>
                    <button
                      type="button"
                      onClick={() => setShowAddUpiForm(true)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add new UPI ID
                    </button>
                  </div>

                  {selectedUpi ? (
                    <div
                      onClick={() => setUpiSelectorOpen(true)}
                      className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center">
                          UPI
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{selectedUpi.upiId}</span>
                            {selectedUpi.isDefault && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                DEFAULT
                              </span>
                            )}
                            {selectedUpi.approvalStatus === "pending" && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                PENDING
                              </span>
                            )}
                            {!selectedUpi.isActive && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                INACTIVE
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{selectedUpi.accountHolderName}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditUpi(selectedUpi);
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit UPI ID"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startDeleteUpi(selectedUpi);
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete UPI ID"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAddUpiForm(true)}
                      className="w-full p-4 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs font-medium hover:bg-slate-50 transition-colors"
                    >
                      No UPI ID saved. Click here to add one.
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {method === "crypto" && (
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-slate-900">3. Enter TRC-20 USDT Address</h3>
              <input
                type="text"
                placeholder="Enter TRC-20 wallet address (starts with T...)"
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                className="w-full font-mono text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/40"
              />
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            {method === "upi" && smartUpiEnabled ? (
              <button
                type="button"
                onClick={() => {
                  toast.info("Smart UPI Auto-Routing is armed", {
                    description: "Turn off the Smart UPI toggle above if you want to request a manual withdrawal to a specific account.",
                  });
                }}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Smart UPI Active (Auto-Liquidating)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRequestWithdrawal}
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                <ArrowUp className="w-4 h-4" />
                {submitting ? "Processing..." : "Request Withdrawal"}
              </button>
            )}
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-3 font-medium">
              <Info className="w-3.5 h-3.5" />
              <span>
                {method === "upi" && smartUpiEnabled
                  ? "To withdraw a specific amount to a chosen account manually, disable Smart UPI above."
                  : "Withdrawals are processed within 24 hours. Large amounts may require admin approval."}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (Summary & Info) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Withdrawal Summary */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Withdrawal Summary</h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-500 font-medium">
                <span>Amount (USDT)</span>
                <span className="text-slate-900 font-bold">
                  {hasAmount ? parsedAmount.toFixed(2) : "0.00"} USDT
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 font-medium">
                <span>Exchange Rate</span>
                <span className="text-slate-900 font-bold">₹{usdtInrRate} / USDT</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 font-medium">
                <span>You will receive (INR)</span>
                <span className="text-slate-900 font-bold">₹{netInr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 font-medium">
                <span>Withdrawal Fee</span>
                <span className="text-slate-900 font-bold">
                  {feePercentDisplay}% ₹{feeInr.toFixed(2)}
                </span>
              </div>
              {method === "upi" && smartUpiEnabled && (
                <div className="flex items-center justify-between text-slate-500 font-medium pt-1">
                  <span>Routing Mode</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <Zap className="w-3 h-3 text-emerald-600 fill-emerald-600" /> Smart Auto-Routing
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">Total Payout (INR)</span>
                <span className="text-2xl font-extrabold text-blue-600">
                  ₹{netInr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-3.5 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                Your amount will be converted at the current live rate. Final amount may vary slightly at the time of processing.
              </p>
            </div>
          </div>

          {/* Card 2: Important Information */}
          <div className="bg-gradient-to-br from-amber-50/60 to-orange-50/30 border border-amber-200/60 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Important Information</span>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  1
                </span>
                <p className="leading-relaxed">Withdrawals are processed within 24 hours.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  2
                </span>
                <p className="leading-relaxed">Ensure your bank/UPI details are correct.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  3
                </span>
                <p className="leading-relaxed">Large amounts may require additional verification.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  4
                </span>
                <p className="leading-relaxed">If you face any issue, contact support.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog: Add Bank Account with Two-step Confirmation */}
      <Dialog
        open={showAddForm}
        onOpenChange={(open) => {
          setShowAddForm(open);
          if (!open) setBankFormStep("input");
        }}
      >
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {bankFormStep === "confirm" ? "Verify Bank Details" : "Add Bank Account"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {bankFormStep === "confirm"
                ? "Please check that all account numbers and IFSC code match your bank records."
                : "Enter your Indian bank account details to receive payouts."}
            </DialogDescription>
          </DialogHeader>

          {bankFormStep === "input" ? (
            <div className="space-y-4 py-2 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Holder Name</label>
                <input
                  type="text"
                  placeholder="Full name as per bank records"
                  value={newHolder}
                  onChange={(e) => setNewHolder(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Number</label>
                <input
                  type="text"
                  placeholder="Bank account number (6 to 20 digits)"
                  value={newAccount}
                  onChange={(e) => setNewAccount(e.target.value.replace(/\s/g, ""))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">IFSC Code</label>
                <input
                  type="text"
                  placeholder="e.g. SBIN0001234"
                  value={newIfsc}
                  onChange={(e) => setNewIfsc(e.target.value.toUpperCase().replace(/\s/g, ""))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono uppercase focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Bank Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. State Bank of India, Axis Bank"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="font-semibold text-slate-700">Set as default account</span>
                <Switch checked={newMakeDefault} onCheckedChange={setNewMakeDefault} />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReviewBankAccount}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
                >
                  Review Details →
                </button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-3">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  Review Linked Account Details
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Account Holder</span>
                    <span className="font-bold text-slate-900 text-xs">{newHolder}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Bank Name</span>
                    <span className="font-bold text-slate-900 text-xs">{newBankName || "As per IFSC"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Account Number</span>
                    <span className="font-mono font-bold text-blue-700 text-xs tracking-wide">{newAccount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">IFSC Code</span>
                    <span className="font-mono font-bold text-slate-900 text-xs uppercase">{newIfsc}</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Please verify that the <strong>Account Number ({newAccount})</strong> and <strong>IFSC ({newIfsc})</strong> match your official bank records. Payouts sent to an incorrect account cannot be reversed.
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-3">
                <button
                  type="button"
                  onClick={() => setBankFormStep("input")}
                  disabled={savingNewAccount}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ← Edit Details
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveBankAccount}
                  disabled={savingNewAccount}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {savingNewAccount ? "Saving..." : "Confirm & Save Account"}
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Select & Manage saved Bank Accounts */}
      <Dialog open={bankSelectorOpen} onOpenChange={setBankSelectorOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Manage Bank Accounts</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Select an account to receive payouts, or edit/delete existing details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[380px] overflow-y-auto">
            {bankAccounts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No bank accounts saved yet.</p>
            ) : (
              bankAccounts.map((b) => (
                <div
                  key={b.id}
                  onClick={() => {
                    setSelectedBankAccountId(b.id);
                    setBankSelectorOpen(false);
                  }}
                  className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between transition-colors ${
                    selectedBankAccountId === b.id
                      ? "border-blue-600 bg-blue-50/40"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {(b.bankName || "Bank").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{b.bankName || "Bank"}</span>
                        {b.isDefault && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {b.accountHolderName} • {maskAccount(b.accountNumber)} • {b.ifscCode}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBankSelectorOpen(false);
                        startEditBank(b);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit Bank Account"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBankSelectorOpen(false);
                        startDeleteBank(b);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Bank Account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {selectedBankAccountId === b.id && <Check className="w-4 h-4 text-blue-600 ml-1" />}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => {
                setBankSelectorOpen(false);
                setShowAddForm(true);
              }}
              className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 hover:text-blue-600 text-xs font-semibold text-slate-600 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Another Bank Account
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Select & Manage saved UPI IDs */}
      <Dialog open={upiSelectorOpen} onOpenChange={setUpiSelectorOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Manage UPI IDs</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Toggle active status for the Smart UPI pool, set defaults, or choose an account for manual payout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[380px] overflow-y-auto">
            {upiAccounts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No UPI IDs saved yet.</p>
            ) : (
              upiAccounts.map((u) => {
                const isSelected = selectedUpiId === u.id;
                const isApproved = u.approvalStatus === "approved";
                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      if (!smartUpiEnabled) {
                        setSelectedUpiId(u.id);
                        setUpiSelectorOpen(false);
                      }
                    }}
                    className={`p-3.5 rounded-2xl border transition-colors ${
                      !smartUpiEnabled ? "cursor-pointer" : "cursor-default"
                    } ${
                      isSelected && !smartUpiEnabled
                        ? "border-blue-600 bg-blue-50/40"
                        : "border-slate-200 hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                          UPI
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-900 truncate">{u.upiId}</span>
                            {u.isDefault && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700">
                                DEFAULT
                              </span>
                            )}
                            {u.approvalStatus === "pending" && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> PENDING
                              </span>
                            )}
                            {u.approvalStatus === "rejected" && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800">
                                REJECTED
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">{u.accountHolderName}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Pool Active Switch */}
                        <div
                          className="flex items-center mr-1"
                          title={
                            u.isDefault
                              ? "Default UPI must stay active"
                              : u.isActive
                              ? "Active in Smart Pool — Click to deactivate"
                              : "Inactive — Click to activate in pool"
                          }
                        >
                          <Switch
                            checked={u.isActive}
                            disabled={u.isDefault || pendingUpiActiveId === u.id || !isApproved}
                            onCheckedChange={(next) => toggleUpiActive(u, next)}
                            aria-label={u.isActive ? "Deactivate UPI" : "Activate UPI"}
                          />
                        </div>

                        {/* Set Default */}
                        {!u.isDefault && isApproved && (
                          <button
                            type="button"
                            onClick={() => makeDefaultUpiAccount(u.id)}
                            disabled={pendingUpiDefaultId === u.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                            title="Set as Default UPI"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => {
                            setUpiSelectorOpen(false);
                            startEditUpi(u);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit UPI ID"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => {
                            setUpiSelectorOpen(false);
                            startDeleteUpi(u);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete UPI ID"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {isSelected && !smartUpiEnabled && (
                          <Check className="w-4 h-4 text-blue-600 ml-0.5" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => {
                setUpiSelectorOpen(false);
                setShowAddUpiForm(true);
              }}
              className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 hover:text-blue-600 text-xs font-semibold text-slate-600 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Another UPI ID
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add UPI ID with Two-step Confirmation */}
      <Dialog
        open={showAddUpiForm}
        onOpenChange={(open) => {
          setShowAddUpiForm(open);
          if (!open) setUpiFormStep("input");
        }}
      >
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {upiFormStep === "confirm" ? "Verify UPI Details" : "Add UPI ID"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {upiFormStep === "confirm"
                ? "Please confirm that your UPI VPA address is active and ready to receive funds."
                : "Enter your UPI ID (e.g. mobile@upi, username@okhdfcbank)"}
            </DialogDescription>
          </DialogHeader>

          {upiFormStep === "input" ? (
            <div className="space-y-4 py-2 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">UPI ID (VPA)</label>
                <input
                  type="text"
                  placeholder="username@bank (e.g. 9876543210@paytm, user@okaxis)"
                  value={newUpiId}
                  onChange={(e) => setNewUpiId(e.target.value.toLowerCase().trim())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Holder Name</label>
                <input
                  type="text"
                  placeholder="Full name as registered with UPI"
                  value={newUpiHolder}
                  onChange={(e) => setNewUpiHolder(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddUpiForm(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReviewUpi}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
                >
                  Review Details →
                </button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-3">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  Review Linked UPI Details
                </div>
                <div className="space-y-2 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">UPI ID (VPA)</span>
                    <span className="font-mono font-bold text-blue-700 text-xs">{newUpiId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Registered Name</span>
                    <span className="font-bold text-slate-900 text-xs">{newUpiHolder}</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Make sure this UPI address is actively connected to your primary bank and accepts instantaneous merchant payouts.
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-3">
                <button
                  type="button"
                  onClick={() => setUpiFormStep("input")}
                  disabled={savingUpi}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ← Edit Details
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveUpi}
                  disabled={savingUpi}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {savingUpi ? "Saving..." : "Confirm & Save UPI"}
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Bank Account with Two-step Confirmation */}
      <Dialog
        open={Boolean(editingBank)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingBank(null);
            setEditBankStep("input");
          }
        }}
      >
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editBankStep === "confirm" ? "Confirm Bank Details Update" : "Edit Bank Account"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {editBankStep === "confirm"
                ? "Please verify that the updated account number and IFSC code are accurate."
                : "Update your bank account information below."}
            </DialogDescription>
          </DialogHeader>

          {editBankStep === "input" ? (
            <div className="space-y-4 py-2 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Holder Name</label>
                <input
                  type="text"
                  placeholder="Full name as per bank records"
                  value={editBankHolder}
                  onChange={(e) => setEditBankHolder(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Number</label>
                <input
                  type="text"
                  placeholder="Bank account number (6 to 20 digits)"
                  value={editBankAccount}
                  onChange={(e) => setEditBankAccount(e.target.value.replace(/\s/g, ""))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">IFSC Code</label>
                <input
                  type="text"
                  placeholder="e.g. SBIN0001234"
                  value={editBankIfsc}
                  onChange={(e) => setEditBankIfsc(e.target.value.toUpperCase().replace(/\s/g, ""))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono uppercase focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. State Bank of India, Axis Bank"
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="font-semibold text-slate-700">Set as default account</span>
                <Switch checked={editBankDefault} onCheckedChange={setEditBankDefault} />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingBank(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReviewEditBank}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
                >
                  Review Changes →
                </button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-3">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  Review Updated Bank Details
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Account Holder</span>
                    <span className="font-bold text-slate-900 text-xs">{editBankHolder}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Bank Name</span>
                    <span className="font-bold text-slate-900 text-xs">{editBankName || "As per IFSC"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Account Number</span>
                    <span className="font-mono font-bold text-blue-700 text-xs tracking-wide">{editBankAccount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">IFSC Code</span>
                    <span className="font-mono font-bold text-slate-900 text-xs uppercase">{editBankIfsc}</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Please verify that Account Number (<strong>{editBankAccount}</strong>) and IFSC (<strong>{editBankIfsc}</strong>) match your records. Payouts sent to incorrect details cannot be recovered.
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-3">
                <button
                  type="button"
                  onClick={() => setEditBankStep("input")}
                  disabled={savingEditBank}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ← Edit Details
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpdateBank}
                  disabled={savingEditBank}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {savingEditBank ? "Saving..." : "Confirm & Save Changes"}
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Delete Bank Account Confirmation */}
      <Dialog open={Boolean(deletingBank)} onOpenChange={(open) => !open && setDeletingBank(null)}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Delete Bank Account?</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Are you sure you want to remove this bank account from your saved payout methods?
            </DialogDescription>
          </DialogHeader>

          {deletingBank && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1 my-2">
              <div className="font-bold text-slate-900">{deletingBank.bankName || "Bank Account"}</div>
              <div className="text-slate-600 font-mono">
                {deletingBank.accountHolderName} • {maskAccount(deletingBank.accountNumber)}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">IFSC: {deletingBank.ifscCode}</div>
            </div>
          )}

          <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-3 text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p>You will need to re-add this bank account if you want to use it again in the future.</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <button
              type="button"
              onClick={() => setDeletingBank(null)}
              disabled={deletingBankLoading}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteBank}
              disabled={deletingBankLoading}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              {deletingBankLoading ? "Deleting..." : "Delete Account"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit UPI ID with Two-step Confirmation */}
      <Dialog
        open={Boolean(editingUpi)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingUpi(null);
            setEditUpiStep("input");
          }
        }}
      >
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editUpiStep === "confirm" ? "Confirm UPI ID Update" : "Edit UPI ID"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {editUpiStep === "confirm"
                ? "Please verify that the updated UPI address is active and accepting payouts."
                : "Update your UPI ID details below."}
            </DialogDescription>
          </DialogHeader>

          {editUpiStep === "input" ? (
            <div className="space-y-4 py-2 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">UPI ID (VPA)</label>
                <input
                  type="text"
                  placeholder="username@bank (e.g. 9876543210@paytm, user@okaxis)"
                  value={editUpiId}
                  onChange={(e) => setEditUpiId(e.target.value.toLowerCase().trim())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Holder Name</label>
                <input
                  type="text"
                  placeholder="Full name as registered with UPI"
                  value={editUpiHolder}
                  onChange={(e) => setEditUpiHolder(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUpi(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReviewEditUpi}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
                >
                  Review Changes →
                </button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-3">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  Review Updated UPI Details
                </div>
                <div className="space-y-2 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">UPI ID (VPA)</span>
                    <span className="font-mono font-bold text-blue-700 text-xs">{editUpiId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Registered Name</span>
                    <span className="font-bold text-slate-900 text-xs">{editUpiHolder}</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Make sure this UPI address (<strong>{editUpiId}</strong>) is active on UPI and able to receive payouts instantly.
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-3">
                <button
                  type="button"
                  onClick={() => setEditUpiStep("input")}
                  disabled={savingEditUpi}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ← Edit Details
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpdateUpi}
                  disabled={savingEditUpi}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {savingEditUpi ? "Saving..." : "Confirm & Save Changes"}
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Delete UPI Confirmation */}
      <Dialog open={Boolean(deletingUpi)} onOpenChange={(open) => !open && setDeletingUpi(null)}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Delete UPI ID?</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Are you sure you want to remove this UPI address from your saved payout methods?
            </DialogDescription>
          </DialogHeader>

          {deletingUpi && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1 my-2">
              <div className="font-mono font-bold text-slate-900">{deletingUpi.upiId}</div>
              <div className="text-slate-600">{deletingUpi.accountHolderName}</div>
            </div>
          )}

          <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-3 text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p>This UPI ID will be removed from your saved list.</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <button
              type="button"
              onClick={() => setDeletingUpi(null)}
              disabled={deletingUpiLoading}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteUpi}
              disabled={deletingUpiLoading}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              {deletingUpiLoading ? "Deleting..." : "Delete UPI ID"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Withdrawal Confirmation & 6-digit Security PIN */}
      <Dialog open={pinPromptOpen} onOpenChange={setPinPromptOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Confirm Withdrawal</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Review transaction payout details and authenticate with your 6-digit PIN.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Payout Details Summary Box */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Withdrawal Amount:</span>
                <span className="font-bold text-slate-900">{parsedAmount.toFixed(2)} USDT</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Payout Method:</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {method === "bank" ? "Bank Transfer (NEFT/IMPS)" : method === "upi" ? "UPI Instant" : "Crypto (TRC-20)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Destination:</span>
                <span className="font-mono font-semibold text-blue-700 text-right truncate max-w-[220px]">
                  {method === "bank"
                    ? `${selectedBank?.bankName || "Bank"} (${maskAccount(selectedBank?.accountNumber || "")})`
                    : method === "upi"
                    ? selectedUpi?.upiId || "UPI ID"
                    : `${destinationAddress.slice(0, 8)}...${destinationAddress.slice(-6)}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Exchange Rate:</span>
                <span className="font-semibold text-slate-800">₹{usdtInrRate} / USDT</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-900">Total Net Payout:</span>
                <span className="text-base font-extrabold text-blue-700">
                  ₹{netInr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* PIN Entry or Inline PIN Setup */}
            {pinStatus && !pinStatus.pinSet ? (
              <div className="space-y-3 pt-1">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-950 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Create your 6-digit Security PIN</span>
                    <span>You haven't set a withdrawal PIN yet. Create one now to secure this and all future payouts:</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">New 6-digit PIN</label>
                    <input
                      type="password"
                      maxLength={6}
                      value={setupPinEntry}
                      onChange={(e) => {
                        setSetupPinEntry(e.target.value.replace(/\D/g, ""));
                        setPinError(null);
                      }}
                      placeholder="••••••"
                      className="w-full text-center text-lg font-mono tracking-widest px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Confirm PIN</label>
                    <input
                      type="password"
                      maxLength={6}
                      value={setupConfirmPinEntry}
                      onChange={(e) => {
                        setSetupConfirmPinEntry(e.target.value.replace(/\D/g, ""));
                        setPinError(null);
                      }}
                      placeholder="••••••"
                      className="w-full text-center text-lg font-mono tracking-widest px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                {pinError && <p className="text-xs text-rose-500 font-semibold text-center mt-1">{pinError}</p>}

                <DialogFooter className="gap-2 sm:gap-0 pt-2">
                  <button
                    type="button"
                    onClick={() => setPinPromptOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSetupPinAndWithdraw}
                    disabled={isSettingUpPin || setupPinEntry.length !== 6 || setupConfirmPinEntry.length !== 6}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                  >
                    {isSettingUpPin ? "Setting PIN..." : "Set PIN & Request Payout"}
                  </button>
                </DialogFooter>
              </div>
            ) : (
              <div className="pt-2">
                <label className="text-xs font-semibold text-slate-700 block text-center mb-2">
                  Enter your 6-digit Security PIN
                </label>
                <div className="flex justify-center">
                  <input
                    type="password"
                    maxLength={6}
                    value={pinEntry}
                    onChange={(e) => {
                      setPinEntry(e.target.value.replace(/\D/g, ""));
                      setPinError(null);
                    }}
                    placeholder="••••••"
                    autoFocus
                    className="w-48 text-center text-3xl font-mono tracking-[0.3em] px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {pinError && <p className="text-xs text-rose-500 font-semibold text-center mt-2">{pinError}</p>}

                <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2 px-2">
                  <span>Authorized for current session</span>
                  <Link to="/user/profile" className="text-blue-600 hover:underline">
                    Forgot PIN?
                  </Link>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-4">
                  <button
                    type="button"
                    onClick={() => setPinPromptOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => submitWithdrawal(pinEntry)}
                    disabled={submitting || pinEntry.length !== 6}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                  >
                    {submitting ? "Processing..." : "Confirm & Send Payout"}
                  </button>
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: How it works */}
      <Dialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">How USDT to INR Off-Ramp Works</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs text-slate-600 leading-relaxed">
            <p>
              1. <strong>Enter Amount:</strong> Specify the USDT amount you want to off-ramp. Rates update in real-time.
            </p>
            <p>
              2. <strong>Select Destination:</strong> Choose your saved bank account (IMPS/NEFT) or UPI ID.
            </p>
            <p>
              3. <strong>Instant Matching:</strong> Payout is queued and transferred directly to your bank account or UPI within the indicated timeline.
            </p>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setHowItWorksOpen(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold"
            >
              Got it
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
