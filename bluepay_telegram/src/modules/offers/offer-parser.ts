// Parses the amount from a buyer-offer message. By rule, the FIRST token of the
// message is always the amount. Supports:
//   - absolute:   "50000 upi"        -> 50000
//   - k / thousand: "50k upi", "40K" -> 50000, 40000
//   - w / 万 (10k): "5w", "5W", "5万" -> 50000
// Returns null when the first token isn't a recognisable amount (i.e. the
// message is chatter, not an offer).
export function parseOfferAmount(text: string): number | null {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return null;

  // First whitespace-delimited token.
  const firstToken = trimmed.split(/\s+/)[0].toLowerCase();

  // number + optional unit suffix (k / w / 万), with optional commas/decimal.
  const m = firstToken.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(k|w|万)?$/);
  if (!m) return null;

  const base = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(base) || base <= 0) return null;

  const unit = m[2];
  let multiplier = 1;
  if (unit === 'k') multiplier = 1000;
  else if (unit === 'w' || unit === '万') multiplier = 10000;

  return Math.round(base * multiplier);
}
