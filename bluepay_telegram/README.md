# payout-bridge

A small, **project-agnostic** service that bridges payout requests to a Telegram
group and matches payment-proof screenshots back to the requesting app.

It knows nothing about users, withdrawals, or disputes. It only understands
generic **payout requests** (identified by an opaque `referenceId`) and
**payment proofs** (screenshots). All business meaning stays in the calling app
(e.g. TronPay).

## What it does

1. **Caller registers a payout request** — `POST /payout-requests` with
   `{ referenceId, amount, upiId }` (auth via `x-api-key`).
2. **Announce in Telegram** — posts `"Payout needed: ₹<amount> to <upiId> (ref)"`
   in the group so the ops team can assign someone to pay.
3. **Listen for screenshots** — the bot watches the group. An LP posts a
   screenshot with the UPI id typed as the caption.
4. **Store the image** — uploaded to Cloudinary; the URL is kept and sent to the
   caller on match.
5. **Read the screenshot** — local OCR via `tesseract.js` (same engine as
   TronPay's `image-reader` module) reads the raw text; we parse amount / UTR
   out of it. Self-contained, no external OCR API.
6. **Match (FIFO)** — find the **oldest open** request for that `(upiId, amount)`
   and atomically claim it. No match → stored as `unmatched`, nothing happens.
7. **Notify the caller** — signed `POST` to `TRONPAY_CALLBACK_URL`:
   `{ referenceId, amount, upiId, imageUrl, extracted, telegram }`.

The caller (TronPay) then flips its withdrawal, pushes a websocket event to the
user, and opens the dispute modal. **None of that lives here.**

## Design decisions (agreed)

- **Trust the screenshot.** A clean match auto-fires; the caller's dispute flow
  is the fraud safety net.
- **FIFO matching** on `(upiId, amount)` handles shared-UPI / duplicate requests
  deterministically without silent drops.
- **No expiry, no cancel.** Requests stay open until a screenshot clears them
  (the calling app guarantees every request is eventually paid; users can't
  cancel).
- **Unmatched screenshots** are stored and ignored — never auto-guessed.
- **No partial fills** (yet) — one screenshot pays the full amount.

## The two-endpoint contract

| Direction | Endpoint | Auth |
|---|---|---|
| Caller → service | `POST /payout-requests` | `x-api-key` header |
| Service → caller | `POST <TRONPAY_CALLBACK_URL>` | `x-signature` (HMAC-SHA256 of body) |

## Modules

- `payout-requests/` — inbound API + FIFO matching/claiming.
- `telegram/` — telegraf: announce + listen for screenshots.
- `proofs/` — store image (Cloudinary) + OCR + orchestrate match.
- `callbacks/` — signed outbound notify to the caller.

## Setup

```bash
cp .env.example .env   # fill in bot token, cloudinary, OCR, callback url/secret
npm install
npm run start:dev
```

## Still TODO (not yet wired)

- Tune the amount/UTR regexes in `proofs/ocr.service.ts` against real UPI-app
  screenshots — tesseract text is messy and varies by app.
- Verify the bot can read group member messages (privacy mode off / admin).
- Retry/persistence for failed callbacks.
