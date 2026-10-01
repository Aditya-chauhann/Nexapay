# Deploying the payout-bridge (Render)

This turns all the tunnel/BotFather churn into a **one-time** setup: the bridge
gets a permanent HTTPS domain, so BotFather is configured once and never breaks.

The repo already has `render.yaml` (a Render Blueprint) and `npm run start:prod`.

---

## 1. Create the service on Render
1. Push this repo to GitHub (it already has a remote).
2. Render Dashboard → **New → Blueprint** → select this repo. Render reads
   `render.yaml` and creates a **web service** named `payout-bridge`.
   - Build: `npm install && npm run build`
   - Start: `npm run start:prod`
   - Health check: `/miniapp/upload`
3. ⚠️ **Pick a paid plan (Starter or higher), NOT Free.** Free instances **sleep**
   after ~15 min idle — that kills the Telegram bot (long-polling) and the Mini
   App. This service must run 24/7.

## 2. Set the environment variables (in the Render dashboard)
| Var | Value |
|---|---|
| `MONGODB_URI` | Same Atlas cluster as TronPay, DB `payout-bridge` (copy from local `.env`) |
| `TELEGRAM_BOT_TOKEN` | The bot token (copy from local `.env`) |
| `TELEGRAM_BOT_USERNAME` | `newgen_otp_bot` |
| `TELEGRAM_GROUP_CHAT_ID` | Your payout group id (copy from local `.env`) |
| `TELEGRAM_MINIAPP_SHORT_NAME` | `upload` |
| `INBOUND_API_KEY` | A strong secret — **must equal** TronPay's `PAYOUT_BRIDGE_API_KEY` |
| `CALLBACK_SIGNING_SECRET` | A strong secret — **must equal** TronPay's `PAYOUT_BRIDGE_CALLBACK_SECRET` |
| `TRONPAY_CALLBACK_URL` | **TronPay's deployed URL** → `https://<tronpay>.onrender.com/payout-bridge/callback` (NOT localhost) |
| `TELEGRAM_MINIAPP_BASE_URL` | The bridge's own Render URL → `https://payout-bridge.onrender.com` (set after step 3) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Copy from local `.env` |

## 3. First deploy → grab the URL → set TELEGRAM_MINIAPP_BASE_URL
Deploy once. Render assigns a URL like `https://payout-bridge.onrender.com`.
Set **`TELEGRAM_MINIAPP_BASE_URL`** to that value and redeploy.

## 4. The ONE cross-service change on TronPay (don't miss this)
On the **TronPay** service (Render), update its env so it talks to the deployed
bridge instead of `localhost:3005`:

| TronPay var | Set to |
|---|---|
| `PAYOUT_BRIDGE_URL` | `https://payout-bridge.onrender.com` |
| `PAYOUT_BRIDGE_API_KEY` | same value as bridge `INBOUND_API_KEY` |
| `PAYOUT_BRIDGE_CALLBACK_SECRET` | same value as bridge `CALLBACK_SIGNING_SECRET` |

(And the bridge's `TRONPAY_CALLBACK_URL` must point at TronPay's deployed URL —
step 2.) These two services call each other, so both URLs + both shared secrets
must line up.

## 5. BotFather — set ONCE, forever
`@BotFather → /myapps → @newgen_otp_bot → the `upload` app → Edit Web App URL`:
```
https://payout-bridge.onrender.com/miniapp/upload
```
No more updates after this — the domain is permanent.

## 6. Mongo Atlas allowlist
Make sure Atlas Network Access allows Render (either Render's outbound IPs or
`0.0.0.0/0`). TronPay already connects to this cluster from Render, so it's
likely already allowed.

---

## Verify after deploy
- `GET https://payout-bridge.onrender.com/miniapp/upload` → returns the HTML page (200).
- Bridge logs show `Telegram bot launched (long-polling)`.
- Post an offer in the group → "Payout needed" appears → Pay Now shows the
  **📤 Upload screenshot** button → it opens the Mini App (no "server not found").
- A test payout: match → awaiting → upload → "✅ Paid — proof received" +
  TronPay gets the callback.

## Notes
- Rotate `INBOUND_API_KEY` and `CALLBACK_SIGNING_SECRET` away from the
  `change-me-*` dev values before going live (and mirror them on TronPay).
- The bridge uses Telegram **long-polling**, so no webhook/inbound Telegram
  config is needed — it just needs to be always-on (hence the paid plan).
