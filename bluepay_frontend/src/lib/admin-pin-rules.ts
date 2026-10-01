/** Mirrors StaffPinService.assertStrongPin() so we fail fast, before the call. */
export function weakPinReason(pin: string): string | null {
  const digits = pin.split("").map(Number);
  const allSame = digits.every((d) => d === digits[0]);
  const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
  const descending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
  if (allSame || ascending || descending) {
    return "Choose a less predictable PIN — no repeated or sequential digits.";
  }
  return null;
}
