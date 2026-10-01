const TRONSCAN_BASE = "https://tronscan.org";

/** Public explorer page for a wallet, opened on its transactions tab. */
export const tronscanAddressUrl = (address: string) =>
  `${TRONSCAN_BASE}/address/${address}/transactions`;

export const tronscanTxUrl = (hash: string) => `${TRONSCAN_BASE}/transaction/${hash}/overview`;
