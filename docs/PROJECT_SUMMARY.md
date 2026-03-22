# TonPal — Project Summary

> **Purpose:** Reference document for session handoff. Use this to onboard a new Claude session with full project context.

---

## What is TonPal?

TonPal is a **Telegram-native group expense splitting bot** built for a hackathon. Users photograph a receipt, an AI parses it, the group splits the bill, and participants pay via TON blockchain — all without leaving Telegram.

**Hackathon tracks targeted:**
1. **AlphaTON Capital** ($3,000 + 2,000 TON) — Telegram-native TON app, AI agents
2. **XRP Ledger Programmability** ($2,500) — smart escrow, conditional payments
3. **ENS Bounty** ($500) — group payment coordination with ENS identity

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS, Radix UI |
| Database | Supabase (PostgreSQL + Realtime) |
| Telegram Bot | Grammy |
| Blockchain (primary) | TON (ton-core, @tonconnect/ui-react) |
| Blockchain (secondary) | XRPL (xrpl.js) |
| Identity | ENS + NameStone offchain resolver |
| AI | Anthropic Claude, Google Gemini (fallback), OpenRouter (fallback) |
| Hosting | Vercel |

---

## Core User Flow

1. **Group chat:** Someone sends a receipt photo to the bot
2. **AI parses** the receipt → extracts merchant, items, prices, total
3. **Organizer chooses split mode:** equal, item-based, or custom amounts
4. **Bot confirms split** → posts a single message with a "Pay now" button
5. **Each participant taps "Pay now"** → opens Telegram Mini App
6. **Mini App identifies the user** via `Telegram.WebApp.initDataUnsafe.user.username`
7. **Mini App shows their share** + TON Connect wallet button
8. **User connects wallet and sends TON** with a memo comment (`TonPal-XXXXXXXX`)
9. **On-chain confirmation** via polling (manual `/checkpayments` command or daily Vercel cron)
10. **Bot announces** payment confirmations in the group chat

---

## Database Schema

### Primary Tables (Supabase)

**`tonpal_splits`** — Flat document store for quick split lookups
```
id: uuid
data: jsonb {
  merchant: string
  currency: string
  total: number
  organizer_wallet: string
  chat_id: number (Telegram group chat ID)
  splits: Array<{
    handle: string (Telegram @username)
    amount: number
    paid: boolean
    tx_hash: string | null
  }>
}
created_at: timestamp
```

**`user_wallets`** — Organizer wallet registration
```
user_id: text (Telegram user ID)
username: text
ton_address: text
updated_at: timestamp
```

### Structured Tables (for multi-rail support)

**`split_sessions`** — id, owner_id, source (bot/miniapp), status (draft/active/settled/cancelled), receipt_data (jsonb)

**`participants`** — id, split_session_id, telegram_user_id, display_name, ens_name, satsplit_subname, handle, ton_address, evm_address, xrp_address

**`payment_requests`** — id, split_session_id, participant_id, amount, amount_native, status (pending/committed/confirmed/overdue/cancelled), payment_link, rail (ton/xrpl), xrpl_check_id

**`payment_receipts`** — id, payment_request_id, tx_hash, rail, paid_at

**`xrpl_checks`** — id, split_session_id, participant_id, check_id, xrp_amount, state (created/cashed/cancelled/expired), xumm_payload_uuid, sender_address, destination_address

---

## Key Files

### Bot & API
| File | Purpose |
|---|---|
| `lib/telegram/bot.ts` | Core Grammy bot (1100+ lines): /start, /setwallet, /mywallet, /checkpayments, /tonpal, receipt parsing, split modes, payment DMs |
| `app/api/telegram/webhook/route.ts` | Telegram webhook handler |
| `app/api/cron/poll-payments/route.ts` | Vercel cron: polls TON blockchain, matches payments by memo, updates DB, notifies group |
| `app/api/receipts/parse/route.ts` | AI receipt parsing endpoint |
| `app/api/payments/confirm/route.ts` | Manual + poll-based payment confirmation |
| `app/api/splits/route.ts` | Split CRUD |

### Mini App (TON Connect)
| File | Purpose |
|---|---|
| `app/miniapp/pay/page.tsx` | Main payment page — reads splitId from Telegram start_param, identifies user, shows TON Connect |
| `app/miniapp/pay/[splitId]/page.tsx` | Direct-access payment page (URL param fallback) |
| `app/miniapp/layout.tsx` | Telegram WebApp SDK loader + type declarations |

### Blockchain Libraries
| File | Purpose |
|---|---|
| `lib/rails/ton/payment-link.ts` | TON payment link builders (Tonkeeper, Tonhub, native ton://, Telegram Wallet) |
| `lib/rails/ton/poller.ts` | TON Center API poller: fetches transactions, matches by comment memo, confirms payments |
| `lib/xrpl/checks.ts` | XRPL CheckCreate/Cash/Cancel (secondary rail) |

### Identity
| File | Purpose |
|---|---|
| `lib/ens/subnames.ts` | NameStone wrapper for `*.satsplit.eth` subnames |

### Config
| File | Purpose |
|---|---|
| `vercel.json` | Vercel config: cron job (daily poll-payments), region cdg1 |
| `public/tonconnect-manifest.json` | TON Connect manifest for wallet pairing |
| `.env.local` | Environment variables (gitignored) |
| `supabase/schema.sql` | Full database schema |

---

## Domain Types (types/index.ts)

```typescript
type PaymentRail = "ton" | "xrpl"

type ReceiptScan = {
  merchant: string
  currency: string
  items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }>
  subtotal?: number
  tax?: number
  tip?: number
  total: number
  rawText?: string
}

type SplitSession = {
  id: string
  ownerId: string
  source: "bot" | "miniapp"
  status: "draft" | "active" | "settled" | "cancelled"
  receiptData: ReceiptScan
  createdAt: string
  updatedAt: string
}

type Participant = {
  id: string
  splitSessionId: string
  telegramUserId?: string
  displayName: string
  ensName?: string
  satsplitSubname?: string  // alice.satsplit.eth
  handle?: string
  tonAddress?: string
  evmAddress?: string
  xrpAddress?: string
}

type PaymentRequest = {
  id: string
  splitSessionId: string
  participantId: string
  amount: number
  amountNative?: number
  status: "pending" | "committed" | "confirmed" | "overdue" | "cancelled"
  paymentLink: string
  rail: PaymentRail
  xrplCheckId?: string
}

type PaymentReceipt = {
  id: string
  paymentRequestId: string
  txHash: string
  rail: PaymentRail
  paidAt: string
}
```

---

## Payment Confirmation Flow

### On-chain memo format
Each payment includes a comment/memo: `TonPal-{splitId.slice(-8)}`

### Manual check (`/checkpayments` bot command)
1. User replies to a split message with `/checkpayments`
2. Bot reads organizer wallet from `user_wallets` table
3. Polls TON Center API: `getTransactions?address={wallet}&limit=50`
4. Filters transactions where `in_msg.message` contains `TonPal-XXXXXXXX`
5. Matches by amount tolerance (±0.01 TON)
6. Updates `tonpal_splits` data: marks `paid: true`, stores `tx_hash`
7. Announces results in group chat

### Automated (Vercel cron — daily)
- Endpoint: `/api/cron/poll-payments`
- Fetches all splits from last 24 hours
- Same matching logic as manual
- Sends Telegram notification to group via Bot API
- Protected by `CRON_SECRET` header

---

## Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://uvsehyrxqqxtjqutgjts.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Telegram
TELEGRAM_BOT_TOKEN=...
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=satsplittestbot
NEXT_PUBLIC_MINIAPP_SHORT_NAME=app
NEXT_PUBLIC_TONCONNECT_MANIFEST_URL=https://ton-pal.vercel.app/tonconnect-manifest.json

# AI
ANTHROPIC_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
OPENROUTER_API_KEY=...

# TON
TON_COLLECTION_ADDRESS=  (empty — organizer wallet used instead)
TON_NETWORK=testnet
NEXT_PUBLIC_TON_NETWORK=testnet

# XRPL
XRPL_NETWORK=testnet
XRPL_ORGANIZER_SECRET=...

# ENS
NAMESTONE_API_KEY=...
ENS_PARENT_NAME=satsplit.eth

# Feature Flags
ENS_ENABLED=true
XRPL_ENABLED=true
X402_ENABLED=false
```

---

## Deployment

- **Vercel project:** `ton-pal.vercel.app`
- **Region:** cdg1 (Paris)
- **Cron:** Daily at midnight UTC (`0 0 * * *`) — Hobby plan limit
- **BotFather Mini App short name:** `app`
- **Mini App URL:** `https://ton-pal.vercel.app/miniapp/pay`
- **Telegram deep link format:** `https://t.me/satsplittestbot/app?startapp={splitId}`

---

## Current Status

### Working
- AI receipt parsing (photo + text)
- Split creation (equal, item-based, custom)
- Organizer wallet registration (`/setwallet`)
- Split confirmation with universal "Pay now" link
- Mini App: user identification, split lookup, TON Connect wallet connection
- Mini App: transaction signing with BOC-encoded comment payload
- `/checkpayments` command for manual on-chain verification
- Vercel cron for automated payment detection

### Needs Testing
- End-to-end testnet TON payment flow
- Cron job execution on Vercel
- XRPL Check flow (built but not tested end-to-end)
- ENS subname creation

### Not Yet Built
- x402 premium AI gate (feature-flagged off)
- Pitch deck (3 versions for 3 tracks)
- E2E tests (Playwright)

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/telegram/webhook` | Telegram bot webhook |
| POST | `/api/receipts/parse` | AI receipt parsing |
| POST | `/api/splits` | Create split session |
| POST | `/api/splits/confirm` | Confirm split |
| GET | `/api/splits/[id]/status` | Split status |
| POST | `/api/splits/[id]/participants` | Add participants |
| POST | `/api/payments/confirm` | Confirm payment (manual or poll) |
| GET | `/api/cron/poll-payments` | Cron: poll blockchain |
| GET | `/api/ens/resolve/[name]` | Resolve ENS name |
| POST | `/api/ens/subnames/create` | Create satsplit.eth subname |
| POST | `/api/xrpl/checks/create` | Create XRPL Check |
| POST | `/api/xrpl/checks/cash` | Cash XRPL Check |
| GET | `/api/xrpl/checks/status/[id]` | XRPL Check status |
| POST | `/api/agentpay/premium` | x402 premium gate |

---

## Git Repository

- **Remote:** https://github.com/omaros2056/satsplit-test
- **Branch:** main
- **Last known uncommitted change:** `vercel.json` cron schedule fix, `lib/telegram/bot.ts` modifications
