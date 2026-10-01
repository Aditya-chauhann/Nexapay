import type { CSSProperties } from "react";

export interface TagColorOption {
  label: string;
  value: string; // hex, e.g. "#00BFFF"
}

export const TAG_COLOR_OPTIONS: TagColorOption[] = [
  { label: "Silver", value: "#C0C0C0" },
  { label: "Gold", value: "#D4AF37" },
  { label: "Diamond", value: "#00BFFF" },
  { label: "Emerald", value: "#10B981" },
  { label: "Rose", value: "#F43F5E" },
  { label: "Violet", value: "#8B5CF6" },
];

const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isValidHex(value: string | null | undefined): boolean {
  return typeof value === "string" && HEX_RE.test(value);
}

export function tagEmoji(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  if (n.includes("diamond")) return "💎";
  if (n.includes("platinum")) return "🏆";
  if (n.includes("gold")) return "🥇";
  if (n.includes("silver")) return "🥈";
  if (n.includes("bronze")) return "🥉";
  return null;
}

export function tagBadgeStyle(color: string | null | undefined): CSSProperties {
  const safe = isValidHex(color) ? (color as string) : "#9CA3AF";
  return {
    backgroundColor: `${safe}33`, // ~20% alpha
    color: safe,
    borderColor: `${safe}55`,
  };
}
