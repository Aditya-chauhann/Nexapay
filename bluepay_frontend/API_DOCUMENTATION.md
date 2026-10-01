# NexoPay — Frontend API Reference

This document lists **every backend API the frontend calls**, extracted directly from the code. For each endpoint you'll find the HTTP method, path, auth requirement, the **request payload the frontend sends**, and the **response fields the frontend reads** (so you know the minimum shape it depends on).

> **Backend team:** please fill in the **"Expected response"** column / confirm the request payloads for each endpoint. The "Frontend reads" notes tell you which fields must exist in the response for the UI to work.

## Conventions

- **Base URL:** all paths below are relative to the backend root. Configured in `src/lib/api-base.ts` via `VITE_API_BASE_URL`, default `https://nexopay-backend-cdvb.onrender.com`.
- **Auth:** endpoints marked 🔒 require header `Authorization: Bearer <token>`. The token is stored in `localStorage["gamezvault_api_token_v1"]`. Endpoints marked 🌐 are public (no token).
- **Content-Type:** every request with a JSON body sends `Content-Type: application/json`.
- **Error shape (all endpoints):** on any non-2xx, the frontend reads `body.message` — accepts **either a `string` or a `string[]`** (array is joined with `, `). Some endpoints also read `body.code` (machine-readable) and `body.attemptsRemaining`. Please return errors in this shape.
- **List pagination convention:** most list endpoints return `{ items: [...], total, page, limit }` and the frontend derives page count from `total`. **Exception:** `/admin/deposits` returns a **bare JSON array** (no envelope). Standardizing everything on `{ items, total, page, limit }` would be safest.
- **Envelope tolerance:** many list responses are parsed leniently — the code accepts `{ items: [...] }` **or** a bare array, and accepts `id` **or** `_id` for entity IDs.

---

# 1. Authentication

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 1.1 | POST | `/auth/login` | 🌐 | Customer login (email or phone) |
| 1.2 | POST | `/auth/register` | 🌐 | Register new customer |
| 1.3 | GET | `/agents` | 🌐 | List agents (registration dropdown) |
| 1.4 | POST | `/admin/auth/login` | 🌐 | Staff / admin login |
| 1.5 | POST | `/admin/auth/change-password` | 🔒 | Forced/first-time admin password change |
| 1.6 | POST | `/auth/2fa/send` | 🔒 | Send 2FA OTP |
| 1.7 | POST | `/auth/2fa/verify` | 🔒 | Verify 2FA OTP |
| 1.8 | GET | `/auth/me` | 🔒 | Current user (assigned-agent info) |

### 1.1 · POST `/auth/login` 🌐
- **Request body:** `{ identifier: string, password: string }` — `identifier` is email or phone (trimmed). Customer-only; staff emails return `403` with `errorCode: "STAFF_USE_ADMIN_LOGIN"`.
- **Frontend reads (success):** `accessToken: string`, `user: { id, email, name, role, emailVerified }`. TOTP: `requiresTotp`, `loginChallenge`, then `POST /auth/login/totp`.
- **Frontend reads (error):** `message`, `errorCode` / `code` (`STAFF_USE_ADMIN_LOGIN`, `ACCOUNT_BLOCKED`), HTTP 403 handled specially.

### 1.2 · POST `/auth/register` 🌐
- **Request body:** `{ name: string, email: string, phone: string, password: string, confirmPassword: string, assignedAgentId?: string }` — `phone` is Indian format `+91XXXXXXXXXX`; `assignedAgentId` omitted when empty.
- **Frontend reads:** success = `response.ok` only. Error = `message`.

### 1.3 · GET `/agents` 🌐
- **Request:** none. **Purpose:** populate optional "Assigned agent" dropdown on register + admin assignment.
- **Frontend reads:** `items: [...]` OR bare array. Each: `{ id | _id, agentCode, role? }` (admin detail also reads `fullName`).

### 1.4 · POST `/admin/auth/login` 🌐
- **Frontend route:** `/auth/admin/login` (legacy `/auth/staff-login` redirects here).
- **Request body:** `{ email: string, password: string }` — `email` is the login identifier: **email or username** (trimmed + lowercased).
- **Frontend reads:** `accessToken: string`, `staff: object`, `staff.mustChangePassword: boolean`, or legacy super-admin `user` object with `role: "superadmin"`. TOTP: `requiresTotp`, `loginChallenge`, `staff` or `user` preview. Error = `message`, `errorCode` (`STAFF_INACTIVE`).

### 1.5 · POST `/admin/auth/change-password` 🔒
- **Request body:** `{ currentPassword: string, newPassword: string }` (confirm is validated client-side only, not sent).
- **Frontend reads:** success = `response.ok` only. Error = `message`.

### 1.6 · POST `/auth/2fa/send` 🔒
- **Request body:** `{ channel: "phone" | "email" }` (no phone/email sent — use contact on file).
- **Frontend reads:** `{ otpId: string, contact: string, channel: "phone"|"email", expiresAt?: string }`. HTTP 429 handled specially (rate limit). Error = `message`.

### 1.7 · POST `/auth/2fa/verify` 🔒
- **Request body:** `{ otpId: string, code: string }` (code is 4–8 digits).
- **Frontend reads:** `{ twoFactorVerified: boolean, twoFactorMethod?: "phone"|"email", phoneVerified?: boolean, emailVerified: boolean, phone?: string, email: string }`. Error `message` text is matched for `too many failed` / `expired` / `already used`.

### 1.8 · GET `/auth/me` 🔒
- **Request:** none. **Frontend reads:** `assignedAgent: { id|_id, fullName, email }`, `assignedAgentSource: "signup"|"admin"`.

---

# 2. User — Profile & Account

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 2.1 | GET | `/user` | 🔒 | Current user profile, balances, wallet, 2FA state |
| 2.2 | PATCH | `/user` | 🔒 | Update profile / change password |

### 2.1 · GET `/user` 🔒
Called from dashboard, profile, deposit, withdraw, and the 2FA context. The frontend reads a **superset** of these fields across pages:
- `profile: { id, name, email, referralCode, createdAt, assignedAgent, assignedAgentSource }`
- `walletAddress: string`, `qrImageDataUrl: string` (deposit page)
- `balances: { totalDeposits, totalWithdrawals, totalWithdrawalsInr?, available, referralEarnings, currency }` — **all string values**
- `assignedAgent`, `assignedAgentSource` (also read at top level)
- 2FA: `twoFactorVerified`, `twoFactorMethod`, `emailVerified`, `phoneVerified`, `email`, `phone` — **each is also read from a nested `profile.*`** (accepts flat or nested)
- Freeze state: `isFrozen`, `frozenReason` (read at top level or nested `user`/`profile`)

### 2.2 · PATCH `/user` 🔒
- **Request body (only changed fields sent):** profile save → `{ name?, email? }`; password save → `{ currentPassword?, newPassword? }`.
- **Frontend reads:** updated `{ name, email, walletAddress, referralCode }`. Error = `message`.

---

# 3. User — Transactions & Deposits

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 3.1 | GET | `/user/transactions?limit={n}` | 🔒 | Unified deposit+withdrawal history |
| 3.2 | GET | `/user/deposits` | 🔒 | Deposit list (deposit page) |
| 3.3 | POST | `/webhook/simulate/{walletAddress}` | 🌐 | **Test-only** simulate deposit |

### 3.1 · GET `/user/transactions?limit={n}` 🔒
- **Query:** `limit` — dashboard uses `50`, transactions page uses `200`.
- **Frontend reads:** a **bare JSON array** of `UnifiedTransaction`: `{ id, type: "deposit"|"withdrawal", amount: number, currency, status, inrAmount: number|null, walletAddress: string|null, transactionId: string|null, txHash: string|null, destination: object|null, timestamp: string|null, createdAt, userId? }`.

### 3.2 · GET `/user/deposits` 🔒
- **Frontend reads:** a **bare JSON array** of `{ id, transactionId, userId, walletAddress, amount: number, currency, timestamp, createdAt }`. Error = `message`.

### 3.3 · POST `/webhook/simulate/{walletAddress}` 🌐
- **Path param:** `walletAddress` (URL-encoded). **No auth, no body.** Triggered by the "Test: simulate deposit" button.
- **Frontend reads:** `res.ok` only. ⚠️ This is a dev/test utility — confirm whether it should exist in production.

---

# 4. User — Withdrawals

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 4.1 | POST | `/user/withdrawals` | 🔒 | Submit a withdrawal |

### 4.1 · POST `/user/withdrawals` 🔒
- **Request body (varies by `method`):**
  - bank → `{ pin: string, method: "bank", amount: number, bankAccountId: string }`
  - upi (smart-selection ON) → `{ pin, method: "upi", amount: number }` (backend auto-picks a UPI)
  - upi (manual) → `{ pin, method: "upi", amount: number, upiAccountId: string }`
  - crypto → `{ pin, method: "crypto", amount: number, network: "TRC-20", destinationAddress: string }`
- **Frontend reads (success):** `netUsdt: number` (used to decrement local balance).
- **Frontend reads (error):** `message`, `code` — handled codes: `WITHDRAWAL_PIN_INVALID` (+ `attemptsRemaining`), `WITHDRAWAL_PIN_LOCKED`, `WITHDRAWAL_PIN_REQUIRED`, `USER_FROZEN`.

---

# 5. User — Bank Accounts

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 5.1 | GET | `/user/bank-accounts` | 🔒 | List saved bank accounts |
| 5.2 | POST | `/user/bank-accounts` | 🔒 | Add a bank account |
| 5.3 | PATCH | `/user/bank-accounts/{id}` | 🔒 | Edit a bank account |
| 5.4 | DELETE | `/user/bank-accounts/{id}` | 🔒 | Delete a bank account |
| 5.5 | PATCH | `/user/bank-accounts/{id}/default` | 🔒 | Set default bank account |
| 5.6 | GET | `/user/bank-accounts/pending-approvals` | 🔒 | Shared-account requests awaiting my decision |
| 5.7 | POST | `/user/bank-accounts/pending-approvals/{id}/{action}` | 🔒 | Approve/reject a shared-account request |

- **5.1 reads:** array OR `{items}`; each `{ id|_id, accountHolderName, accountNumber, ifscCode, bankName, isDefault, approvalStatus: "approved"|"pending"|"rejected", approvalRequiredFrom }`.
- **5.2 / 5.3 body:** `{ accountHolderName: string, accountNumber: string, ifscCode: string, bankName?: string, isDefault?: true }`. Reads back `approvalStatus` (to detect pending); HTTP **409** = duplicate.
- **5.4 / 5.5:** no body. Error = `message`.
- **5.6 reads:** array OR `{items}`; each `{ id|_id, accountHolderName, accountNumber, ifscCode, bankName, createdAt }` + requester as `requester`/`requestedBy` object (`fullName`/`name`, `email`) or flat `requesterName`/`requesterEmail`. **404 treated as empty.**
- **5.7:** `{action}` = `approve` | `reject`; no body. Error = `message`.

---

# 6. User — UPI Accounts

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 6.1 | GET | `/user/upi-accounts` | 🔒 | List saved UPI IDs |
| 6.2 | POST | `/user/upi-accounts` | 🔒 | Add a UPI ID |
| 6.3 | PATCH | `/user/upi-accounts/{id}` | 🔒 | Edit a UPI ID |
| 6.4 | DELETE | `/user/upi-accounts/{id}` | 🔒 | Delete a UPI ID |
| 6.5 | PATCH | `/user/upi-accounts/{id}/default` | 🔒 | Set default UPI |
| 6.6 | PATCH | `/user/upi-accounts/{id}/active` | 🔒 | Activate/deactivate a UPI |
| 6.7 | GET | `/user/upi-accounts/smart-selection` | 🔒 | Read smart-selection toggle |
| 6.8 | PATCH | `/user/upi-accounts/smart-selection` | 🔒 | Set smart-selection toggle |
| 6.9 | GET | `/user/upi-accounts/pending-approvals` | 🔒 | Shared-UPI requests awaiting my decision |
| 6.10 | POST | `/user/upi-accounts/pending-approvals/{id}/{action}` | 🔒 | Approve/reject a shared-UPI request |

- **6.1 reads:** array OR `{items}`; each `{ id|_id, upiId|vpa, accountHolderName, isDefault, isActive, approvalStatus: "approved"|"pending"|"rejected", approvalRequiredFrom }`. **404 → empty.**
- **6.2 / 6.3 body:** `{ upiId: string, accountHolderName: string, isDefault?: true }`. **409** = duplicate.
- **6.4 / 6.5:** no body.
- **6.6 body:** `{ isActive: boolean }` (backend rejects deactivating default / toggling not-yet-approved UPI).
- **6.7 reads:** `{ enabled: boolean }`. **404 → false.**
- **6.8 body:** `{ enabled: boolean }` → reads back `{ enabled }`.
- **6.9 reads:** array OR `{items}`; each `{ id|_id, upiId|vpa, accountHolderName, createdAt }` + requester (same shape as 5.6).
- **6.10:** `{action}` = `approve` | `reject`; no body.

---

# 7. User — Withdrawal PIN

All 🔒. On error these read `body.message`, `body.code`, and `body.attemptsRemaining`. Handled codes: `WITHDRAWAL_PIN_INVALID`, `WITHDRAWAL_PIN_LOCKED`, `PIN_RESET_OTP_EXHAUSTED`, `PIN_RESET_OTP_INVALID`.

| # | Method | Path | Request body | Purpose |
|---|--------|------|--------------|---------|
| 7.1 | GET | `/user/withdrawal-pin/status` | — | Reads `{ pinSet\|isSet\|exists, locked\|isLocked, lockedUntil: string\|null }` |
| 7.2 | POST | `/user/withdrawal-pin/set` | `{ pin, confirmPin }` | Set up PIN |
| 7.3 | POST | `/user/withdrawal-pin/change` | `{ currentPin, newPin, confirmNewPin }` | Change PIN |
| 7.4 | POST | `/user/withdrawal-pin/reset/request` | — | Send reset OTP |
| 7.5 | POST | `/user/withdrawal-pin/reset/confirm` | `{ otp, newPin, confirmNewPin }` | Confirm reset |

---

# 8. User — Support Tickets & Disputes

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 8.1 | POST | `/user/tickets` | 🔒 | Raise a ticket |
| 8.2 | GET | `/user/tickets` | 🔒 | List own tickets |
| 8.3 | GET | `/user/tickets/{id}` | 🔒 | Fetch one ticket |
| 8.4 | POST | `/user/withdrawal-disputes` | 🔒 | Raise a withdrawal dispute |
| 8.5 | GET | `/user/withdrawal-disputes` | 🔒 | List own disputes |
| 8.6 | GET | `/user/withdrawal-disputes/{id}` | 🔒 | Fetch one dispute |

- **8.1 body:** `{ title: string, description: string }`. **Ticket shape read:** `{ id|_id, userId, userName?, userEmail?, title, description, team: "support"|"tech", assignmentStatus: "unassigned"|"assigned", assignee: { id, fullName, email }|null, assignedAt, resolutionStatus: "pending"|"resolved", resolvedAt, resolvedBy, createdAt, updatedAt }`.
- **8.4 body:** `{ withdrawalId: string, reason?: "not_received"|"wrong_amount"|"other", description: string }`. **Dispute shape read:** ticket fields above **plus** `{ withdrawalId, reason, amount: number|null, upiId: string|null, utr: string|null, resolutionNotes: string|null }`.

---

# 9. User — Notifications, Tags & Pricing

| # | Method | Path | Auth | Request body | Purpose |
|---|--------|------|------|--------------|---------|
| 9.1 | GET | `/user/notification-preference` | 🔒 | — | Reads `{ channel: "sms"\|"email" }` |
| 9.2 | PATCH | `/user/notification-preference` | 🔒 | `{ channel: "sms"\|"email" }` | Set notification channel |
| 9.3 | GET | `/user/me/tag` | 🔒 | — | Current tier tag |
| 9.4 | GET | `/pricing/me` | 🔒 | — | Effective pricing for this user |

- **9.3 reads:** tag object OR `{ tag: {...} }`; fields `{ id|_id, name, rank, color, benefitInr }`. **404 → no tag.**
- **9.4 reads:** `{ usdtPrice: number, inrPrice: number, feePercent: number, hasOverride: boolean }`. **Note:** `feePercent` is a **decimal** (0.015 = 1.5%).

---

# 10. Admin — Dashboard & Users

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 10.1 | GET | `/admin/users?page={n}&limit={l}` | 🔒 | List users (paginated) |
| 10.2 | GET | `/admin/users/{userId}` | 🔒 | Fetch one user |
| 10.3 | POST | `/admin/users/{userId}/{action}` | 🔒 | Block/freeze/watch a user |
| 10.4 | GET | `/admin/deposits[?userId=&limit=]` | 🔒 | List deposits |
| 10.5 | GET | `/admin/withdrawals?page={n}&limit={l}[&userId=]` | 🔒 | List withdrawals (paginated) |

### 10.1 · GET `/admin/users` 🔒
- **Query:** `page` (1-based), `limit` (100 in list, 200 in detail-fallback, 1000 elsewhere). Frontend paginates via `total`.
- **Reads:** `{ items: [...], total }`. Each user: `{ id, name, email, role, walletAddress, referralCode, phone, emailVerified, phoneVerified, isBlocked, blockedAt, blockedBy, blockedReason, isFrozen, frozenAt, frozenBy, frozenReason, isOnWatch, watchedAt, watchedBy, watchedReason, createdAt }`.

### 10.2 · GET `/admin/users/{userId}` 🔒
- Detail page unwraps `{ data|user|result }` / `profile` envelopes and accepts `id`|`_id`. Reads all of 10.1's fields **plus** `{ twoFactorVerified, twoFactorMethod, customUsdtCap, customInrRate, assignedAgent: { id, fullName, email }, assignedAgentAt, assignedAgentSource }`. **On 404, frontend falls back to 10.1** and finds the user by id.

### 10.3 · POST `/admin/users/{userId}/{action}` 🔒
- **`{action}`** ∈ `block | unblock | freeze | unfreeze | watch | unwatch` (`watch`/`unwatch` super-admin only).
- **Body (optional):** `{ reason: string }` (trimmed, ≤500 chars) — **omitted entirely when no reason**; `Content-Type` sent only when body present.
- **Reads:** success body not used; error = `message`.

### 10.4 · GET `/admin/deposits` 🔒
- **Query (optional):** `userId`, `limit` (used on the user-detail page).
- ⚠️ **Returns a bare JSON array** (no `{items}` envelope). Each: `{ id, transactionId, userId, walletAddress, amount: number, currency, timestamp, createdAt, visibleToUser }`. Error = `message`.

### 10.5 · GET `/admin/withdrawals` 🔒
- **Query:** `page`, `limit` (200; user-detail uses `limit=200&userId=`; users page uses `limit=1000`). Reads `{ items, total, page, limit }`.
- **Withdrawal shape:** `{ id, userId, method: "bank"|"upi"|"crypto", amount, feeRate, fxRate, feeUsdt, netUsdt, grossInr, feeInr, netInr, currency, accountNumber, ifscCode, upiId, network, destinationAddress, status: "pending"|"processing"|"paid"|"failed", txHash, utr, notes, processedBy, processedAt, decisionReason, createdAt, updatedAt }`.

---

# 11. Admin — Withdrawals Actions

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 11.1 | POST | `/admin/withdrawals/{id}/{action}` | 🔒 | Approve/reject a withdrawal |

- **`{action}`** ∈ `approve | reject`.
- **Body:** always `{ reason: string }` (required, 3–500 chars). Plus conditionally:
  - approve + crypto → `{ ..., txHash: string }` (required).
  - approve + bank/upi → `{ ..., utr: string }` (required, regex `/^[A-Z0-9]{8,25}$/`).
  - reject → only `reason`.
- **Reads:** `{ status, decisionReason, processedBy, processedAt, txHash, utr }`. Error = `message`.

---

# 12. Admin — Deposits page

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 12.1 | GET | `/admin/deposits` | 🔒 | All deposits (see 10.4 — bare array) |
| 12.2 | GET | `/admin/users?page={n}&limit=100` | 🔒 | Map userId → name/email/phone |

---

# 13. Admin — Alerts

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 13.1 | GET | `/admin/alerts?page={n}&limit={l}[&resolved=&severity=]` | 🔒 | List alerts |
| 13.2 | POST | `/admin/alerts/{id}/resolve` | 🔒 | Resolve an alert |

### 13.1 · GET `/admin/alerts` 🔒
- **Query:** `page`, `limit` (5 on dashboard, 25 on alerts page); `resolved=true|false` (omitted for "all"); `severity=critical|high|medium|low` (omitted for "all").
- **Reads:** `{ items, total, unresolvedCount, page }`. Each alert: `{ id, type, severity, title, message, primaryUserId, secondaryUserId, metadata: { accountNumber, ifscCode, originalAccountWasDeleted, originalAccountDeletedAt }, isResolved, resolvedAt, resolvedBy, resolutionNotes, resolution: "cleared"|"confirmed", createdAt, updatedAt }`.

### 13.2 · POST `/admin/alerts/{id}/resolve` 🔒
- **Body:** `{ action: "cleared" | "confirmed", notes?: string }` (notes ≤500, sent only if non-empty). `cleared` = false alarm (unfreezes user / restores bank acct); `confirmed` = fraud. Error = `message`.

---

# 14. Admin — Roles, Staff & Permissions

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 14.1 | GET | `/admin/permissions` | 🔒 | Permission catalog |
| 14.2 | GET | `/admin/roles` | 🔒 | List roles |
| 14.3 | POST | `/admin/roles` | 🔒 | Create role |
| 14.4 | PATCH | `/admin/roles/{id}` | 🔒 | Update role |
| 14.5 | DELETE | `/admin/roles/{id}` | 🔒 | Delete role |
| 14.6 | GET | `/admin/staff` | 🔒 | List staff |
| 14.7 | POST | `/admin/staff` | 🔒 | Create staff |
| 14.8 | PATCH | `/admin/staff/{id}` | 🔒 | Update staff |
| 14.9 | POST | `/admin/staff/{id}/{action}` | 🔒 | Activate/deactivate staff |
| 14.10 | DELETE | `/admin/staff/{id}` | 🔒 | Delete staff |
| 14.11 | POST | `/admin/staff/{id}/reset-password` | 🔒 | Reset staff password |

- **14.1 reads:** array OR `{items}`; each `{ key, label, description }`.
- **14.2 reads:** each role `{ id|_id, name, description, permissions: string[], isActive }`.
- **14.3 / 14.4 body:** `{ name: string, description: string, permissions: string[], isActive: boolean }`.
- **14.5:** no body (only if no staff assigned). Success = ok/204.
- **14.6 reads:** each staff `{ id|_id, username, email, fullName, roleId (or role: {id|_id}), isActive, mustChangePassword, lastLoginAt, createdAt }`.
- **14.7 body (create):** `{ username: string, email: string, password: string, fullName: string, roleId: string }` (username lowercased ≥3, password ≥8).
- **14.8 body (edit):** `{ fullName: string, roleId: string }` only.
- **14.9:** `{action}` ∈ `activate | deactivate`; no body.
- **14.10:** no body (not super-admins / self). Success = ok/204.
- **14.11 body:** `{ newPassword: string }` (≥8; forces change on next login).

---

# 15. Admin — User Tags (tiers)

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 15.1 | GET | `/admin/user-tags` | 🔒 | List tier tags |
| 15.2 | POST | `/admin/user-tags` | 🔒 | Create tag |
| 15.3 | PATCH | `/admin/user-tags/{id}` | 🔒 | Update tag |
| 15.4 | POST | `/admin/user-tags/{id}/{action}` | 🔒 | Enable/disable tag |
| 15.5 | DELETE | `/admin/user-tags/{id}` | 🔒 | Delete tag |
| 15.6 | GET | `/admin/users/{userId}/tag` | 🔒 | User's current tag assignment |
| 15.7 | POST | `/admin/users/{userId}/tag` | 🔒 | Apply/replace user's tag |
| 15.8 | DELETE | `/admin/users/{userId}/tag` | 🔒 | Remove user's tag |
| 15.9 | GET | `/admin/users/{userId}/tag-history` | 🔒 | Tag change audit log |

- **15.1 reads:** each tag `{ id|_id, name, rank, thresholdAmount, thresholdPeriod: "day"|"week"|"month", isActive, color, benefitInr, createdAt, updatedAt }`.
- **15.2 / 15.3 body:** `{ name: string, rank: number, thresholdAmount: number, thresholdPeriod: "day"|"week"|"month", isActive: boolean, color: string, benefitInr: number }`.
- **15.4:** `{action}` ∈ `enable | disable`; no body.
- **15.6 reads:** `{ userId, tag: { id|_id, name, rank, color }|null, assignedAt, assignedBy, source: "auto"|"manual" }`.
- **15.7 body:** `{ tagId: string, reason?: string }`. **15.8 body (optional):** `{ reason: string }`.
- **15.9 reads:** each `{ id|_id, userId, fromTagId, toTagId, source: "auto"|"manual", actorId, reason, createdAt }`.

---

# 16. Admin — Assigned Agent & Pricing

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 16.1 | PATCH | `/admin/users/{userId}/assigned-agent` | 🔒 | Assign/unassign an agent |
| 16.2 | GET | `/admin/pricing` | 🔒 | Global pricing |
| 16.3 | PATCH | `/admin/pricing` | 🔒 | Update global pricing |
| 16.4 | GET | `/admin/users/{userId}/pricing` | 🔒 | Per-user pricing override |
| 16.5 | PUT | `/admin/users/{userId}/pricing` | 🔒 | Set per-user override |
| 16.6 | DELETE | `/admin/users/{userId}/pricing` | 🔒 | Clear per-user override |
| 16.7 | GET | `/admin/pricing/overrides?page=&limit=` | 🔒 | List all overrides |
| 16.8 | GET | `/admin/pricing/history?scope=global&page=&limit=` | 🔒 | Global pricing history |
| 16.9 | GET | `/admin/users/{userId}/pricing/history?scope=user&userId=&page=&limit=` | 🔒 | Per-user pricing history |

- **16.1 body:** `{ agentId: string | null }` (null = unassign). Reads back `assignedAgent`, `assignedAgentAt`, `assignedAgentSource`.
- **16.2 / 16.3:** Global pricing `{ usdtPrice: number, inrPrice: number, feePercent: number, updatedAt, updatedBy, updatedByType: "user"|"staff"|null }`. **16.3 body (partial):** any of `{ usdtPrice?, inrPrice?, feePercent? }`.
- **16.4 reads:** `{ override: { usdtPrice, inrPrice, feePercent }|null (each number|null), effective: { usdtPrice, inrPrice, feePercent } }`.
- **16.5 body:** `{ usdtPrice: number|null, inrPrice: number|null, feePercent: number|null }` (null = fall back to global).
- **16.7 reads:** `{ items: [{ userId, name?, email?, override, updatedAt }], total, page, limit }`.
- **16.8 / 16.9 reads:** `{ items: [{ id, scope: "global"|"user", userId?, changes: [{ field, oldValue, newValue }], changedAt, changedBy, changedByType }], total, page, limit }`.
- **Note:** `feePercent` everywhere is a **decimal** (0.015 = 1.5%).

---

# 17. Admin — Support Tickets & Disputes

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 17.1 | GET | `/admin/tickets?[team&assignmentStatus&resolutionStatus&assigneeId&userId&page&limit]` | 🔒 | List ticket queue |
| 17.2 | POST | `/admin/tickets` | 🔒 | Create a ticket |
| 17.3 | POST | `/admin/tickets/{id}/assign-to-me` | 🔒 | Claim a ticket |
| 17.4 | POST | `/admin/tickets/{id}/transfer` | 🔒 | Transfer to other team |
| 17.5 | POST | `/admin/tickets/{id}/resolve` | 🔒 | Resolve a ticket |
| 17.6 | GET | `/admin/withdrawal-disputes?[same filters]` | 🔒 | List dispute queue |
| 17.7 | GET | `/admin/withdrawal-disputes/{id}` | 🔒 | Fetch one dispute |
| 17.8 | POST | `/admin/withdrawal-disputes/{id}/assign-to-me` | 🔒 | Claim a dispute |
| 17.9 | POST | `/admin/withdrawal-disputes/{id}/transfer` | 🔒 | Transfer to other team |
| 17.10 | POST | `/admin/withdrawal-disputes/{id}/resolve` | 🔒 | Resolve a dispute |

- **List filters (17.1 / 17.6):** `team: "support"|"tech"`, `assignmentStatus: "unassigned"|"assigned"`, `resolutionStatus: "pending"|"resolved"`, `assigneeId`, `userId`, `page`, `limit`. Response `{ items, total, page, limit }`. (Backend filters to caller's role team; super-admin sees all.)
- **17.2 body:** `{ title: string, description: string, team: "support"|"tech" }`.
- **17.4 / 17.9 body:** `{ team: "support"|"tech" }`.
- **17.5 (ticket resolve):** no body. **17.10 (dispute resolve) body (optional):** `{ resolutionNotes: string }`.
- Entity shapes: see §8 (ticket / dispute shapes are shared).

---

# 18. Admin — Reports (XLSX export)

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 18.1 | GET | `/admin/reports/{path}[?filters]` | 🔒 | Download an .xlsx report |

- **`{path}`** ∈ `customers | deposits | withdrawals | pending-withdrawals | customer-ledger | customer-balances | tier-users | active-customers | inactive-customers | tickets`.
- **Query:** arbitrary filter key/values (empty/null skipped). **Response:** an **`.xlsx` blob**; frontend honors the `Content-Disposition` filename. Super-admin only.

---

# 19. Real-time (Socket.io)

Not REST, but the backend must support these. Socket connects to the **same base URL** as the REST API.

- **Shared app socket** (`src/lib/socket.ts`): `io(BASE, { auth: { token } })` — JWT passed in the handshake as `handshake.auth.token`; rebuilt on token change, torn down on logout. Server→client event the app listens for: **`withdrawal:payment_initiated`** (per-user; opens the withdrawal-dispute modal).
- **Page-local sockets** (UserDashboard, UserDeposit): `io(BASE, { transports: ["websocket","polling"], reconnection: true, ... })` — ⚠️ **currently connect WITHOUT the JWT in the handshake.** Events: `connect`, `disconnect`, `connect_error`, and business event **`new_transaction`**.
  - **`new_transaction` payload read by frontend:** `amount` (number|string; ignored if ≤ 10), `id`, `transactionId`, `userId`, `walletAddress`|`address`, `currency` (default "TRX"), `timestamp`, `createdAt`.

---

## ⚠️ Flags for the backend team

1. **`/admin/deposits` returns a bare array** while every other list returns `{ items, total, page, limit }`. Consider standardizing.
2. **`POST /webhook/simulate/{walletAddress}`** is an unauthenticated dev/test endpoint — confirm it's disabled in production.
3. **Page-local sockets** (dashboard/deposit) connect **without** the JWT handshake token, unlike the shared socket. Decide whether `new_transaction` should be authenticated/scoped per-user.
4. **`id` vs `_id`:** frontend tolerates both. Pick one convention.
5. **`feePercent` is a decimal** (0.015 = 1.5%) everywhere in pricing.
6. **Error responses** must return `{ message: string | string[], code?: string, attemptsRemaining?: number }`.
