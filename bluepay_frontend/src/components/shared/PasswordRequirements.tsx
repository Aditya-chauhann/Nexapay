import React from "react";
import { Check, X, Circle, ShieldCheck, ShieldAlert } from "lucide-react";

export interface PasswordValidationResult {
  hasLength: boolean;
  hasCapital: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  hasNoNameOrUsername: boolean;
  matchedForbiddenTerm: string | null;
  score: number;
  isValid: boolean;
}

export function checkPasswordRequirements(
  password: string,
  options?: {
    name?: string | null;
    username?: string | null;
    email?: string | null;
  },
): PasswordValidationResult {
  const pwd = password || "";
  const hasLength = pwd.length >= 8;
  const hasCapital = /[A-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

  // Extract terms to check against name/username
  const forbiddenTerms: string[] = [];
  if (options?.name) {
    const words = options.name
      .toLowerCase()
      .split(/[\s._-]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3);
    forbiddenTerms.push(...words);
    const compactName = options.name.trim().toLowerCase().replace(/\s+/g, "");
    if (compactName.length >= 3) {
      forbiddenTerms.push(compactName);
    }
  }
  if (options?.username) {
    const u = options.username.trim().toLowerCase();
    if (u.length >= 3) forbiddenTerms.push(u);
  }
  if (options?.email) {
    const prefix = options.email.split("@")[0]?.trim().toLowerCase();
    if (prefix && prefix.length >= 3) {
      forbiddenTerms.push(prefix);
    }
  }

  let matchedForbiddenTerm: string | null = null;
  const pwdLower = pwd.toLowerCase();
  for (const term of forbiddenTerms) {
    if (pwdLower.includes(term)) {
      matchedForbiddenTerm = term;
      break;
    }
  }

  const hasNoNameOrUsername = !matchedForbiddenTerm;

  let score = 0;
  if (hasLength) score++;
  if (hasCapital) score++;
  if (hasNumber) score++;
  if (hasSpecial) score++;
  if (hasNoNameOrUsername && pwd.length > 0) score++;

  const isValid =
    hasLength && hasCapital && hasNumber && hasSpecial && hasNoNameOrUsername;

  return {
    hasLength,
    hasCapital,
    hasNumber,
    hasSpecial,
    hasNoNameOrUsername,
    matchedForbiddenTerm,
    score,
    isValid,
  };
}

interface PasswordRequirementsProps {
  password?: string;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  className?: string;
}

export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({
  password = "",
  name,
  username,
  email,
  className = "",
}) => {
  const result = checkPasswordRequirements(password, { name, username, email });
  const hasInput = password.length > 0;

  const items = [
    {
      id: "length",
      label: "At least 8 characters",
      fulfilled: result.hasLength,
    },
    {
      id: "capital",
      label: "At least 1 capital letter (A–Z)",
      fulfilled: result.hasCapital,
    },
    {
      id: "number",
      label: "At least 1 number (0–9)",
      fulfilled: result.hasNumber,
    },
    {
      id: "special",
      label: "At least 1 special character (!@#$%...)",
      fulfilled: result.hasSpecial,
    },
    {
      id: "noName",
      label: result.matchedForbiddenTerm
        ? `Cannot contain your name/username (contains "${result.matchedForbiddenTerm}")`
        : "Cannot contain your name or username",
      fulfilled: result.hasNoNameOrUsername,
      isViolation: Boolean(result.matchedForbiddenTerm),
    },
  ];

  // Calculate strength percentage
  const strengthPercent = (result.score / 5) * 100;
  let strengthLabel = "Too weak";
  let strengthColor = "bg-rose-500 text-rose-400";
  if (result.score >= 5) {
    strengthLabel = "Strong password";
    strengthColor = "bg-emerald-500 text-emerald-400";
  } else if (result.score >= 3) {
    strengthLabel = "Moderate password";
    strengthColor = "bg-amber-500 text-amber-400";
  } else if (result.score >= 2) {
    strengthLabel = "Weak password";
    strengthColor = "bg-orange-500 text-orange-400";
  }

  return (
    <div
      className={`rounded-xl border border-border/70 bg-secondary/30 p-3 text-xs space-y-2.5 transition-all ${className}`}
    >
      {/* Strength Bar Header */}
      <div className="flex items-center justify-between text-[11px] font-medium">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {result.isValid ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span>Password Requirements</span>
        </span>
        {hasInput && (
          <span className={`font-semibold ${strengthColor.split(" ")[1]}`}>
            {strengthLabel}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            strengthColor.split(" ")[0]
          }`}
          style={{ width: hasInput ? `${strengthPercent}%` : "0%" }}
        />
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
        {items.map((item) => {
          const isCheck = hasInput && item.fulfilled;
          const isError = hasInput && !item.fulfilled && (item.id === "noName" ? item.isViolation : false);

          return (
            <div
              key={item.id}
              className={`flex items-center gap-2 py-0.5 text-[11px] transition-colors ${
                isCheck
                  ? "text-emerald-400 font-medium"
                  : isError
                  ? "text-rose-400 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {isCheck ? (
                <div className="h-4 w-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                </div>
              ) : isError ? (
                <div className="h-4 w-4 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <X className="w-2.5 h-2.5 text-rose-400" />
                </div>
              ) : (
                <div className="h-4 w-4 rounded-full bg-secondary/80 border border-border flex items-center justify-center shrink-0">
                  <Circle className="w-1.5 h-1.5 text-muted-foreground/50" />
                </div>
              )}
              <span className="truncate" title={item.label}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
