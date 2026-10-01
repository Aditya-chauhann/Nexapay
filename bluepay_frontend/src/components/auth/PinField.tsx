/**
 * 6-digit PIN input, styled to match the withdrawal-PIN prompt in UserWithdraw
 * so every PIN entry in the app looks and behaves the same.
 */
export function PinField({
  label,
  value,
  onChange,
  onEnter,
  invalid,
  disabled,
  autoFocus,
  masked = true,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onEnter: () => void;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  masked?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={masked ? "password" : "text"}
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !disabled) onEnter();
        }}
        placeholder="••••••"
        className={`mt-1 w-full rounded-lg border bg-secondary px-3 py-2 text-sm font-mono tracking-[0.5em] focus:outline-none focus:ring-2 disabled:opacity-50 ${
          invalid
            ? "border-destructive focus:ring-destructive/50"
            : "border-border focus:ring-primary/50"
        }`}
      />
    </label>
  );
}
