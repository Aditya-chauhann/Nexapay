import React from "react";
import { tronscanAddressUrl, tronscanTxUrl } from "@/lib/tronscan";

interface TronLinkProps {
  type: "transaction" | "address";
  value: string | null | undefined;
  truncate?: boolean;
  children?: React.ReactNode;
}

export const TronLink: React.FC<TronLinkProps> = ({ type, value, truncate = true, children }) => {
  if (!value) return <span>-</span>;
  
  const url = type === "transaction" ? tronscanTxUrl(value) : tronscanAddressUrl(value);
  const display = children ?? (
    truncate && value.length > 16
      ? `${value.slice(0, 4)}......${value.slice(-4)}`
      : value
  );

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="text-primary hover:underline hover:text-primary/80 transition-colors font-mono inline-block align-bottom font-semibold"
      title={value}
      onClick={(e) => e.stopPropagation()}
    >
      {display}
    </a>
  );
};
