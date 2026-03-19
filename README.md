# SatSplit AI

> Split bills in Telegram. Pay with TON. Settle with XRPL. Identify with ENS.

SatSplit AI is a Telegram Mini App + bot for group expense splitting. Send a receipt photo or a message like *"dinner was €85, split 4 ways"* — the AI parses it, generates payment requests, and tracks who paid.

Built for three hackathon tracks simultaneously:
- **AlphaTON Capital** — Telegram-native TON app with AI and monetization
- **XRP Ledger Programmability** — XRPL Checks as trustless multi-party settlement
- **ENS Bounty** — Identity-first payments with subnames, avatars, and text records

---

## Demo

> Live demo: _link added after Vercel deploy_

**90-second core flow:**
1. Send a receipt photo to the bot in any Telegram group
2. AI extracts merchant, items, total, tax
3. Correct anything wrong in the Mini App
4. Assign participants by Telegram handle, ENS name, or `alice.satsplit.eth`
5. Each person gets a TON payment link or XRPL Check commitment request
6. Status board updates live as payments confirm on-chain

---

## How to run locally

### 1. Clone and install

```bash
git clone https://github.com/omaros2056/satsplit-test
cd satsplit-test
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather on Telegram → `/newbot` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio (free) |
| `ANTHROPIC_API_KEY` | Anthropic console (optional, Gemini is free fallback) |
| `NAMESTONE_API_KEY` | namestone.xyz (free) |
| `XRPL_SEED` | XRPL testnet faucet at faucet.altnet.rippletest.net |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | cloud.walletconnect.com (free) |

### 3. Set up Supabase

Run the schema in your Supabase SQL editor:

```bash
# Copy contents of supabase/schema.sql into Supabase SQL editor and run
```

### 4. Start the dev server

```bash
npm run dev
```

App runs at `http://localhost:3000`

### 5. Start the Telegram bot

```bash
npm run bot
```

---

## Project structure

```
app/
  api/                  # All API routes
    receipts/parse/     # AI receipt parsing
    splits/             # Split CRUD
    payment-links/      # TON payment link generation
    payments/confirm/   # Payment confirmation
    telegram/webhook/   # Telegram bot webhook
    xrpl/checks/        # XRPL CheckCreate/Cash/Status
    ens/                # ENS resolution + subname creation
    agentpay/premium/   # x402 premium gate
  miniapp/              # Telegram Mini App pages
components/             # React UI components
lib/
  ai/                   # Receipt parsing, model routing
  rails/ton/            # TON payment links + poller
  rails/xrpl/           # XRPL Checks + Xumm signing
  ens/                  # ENS resolution + NameStone subnames
  telegram/             # Bot handlers
  x402/                 # Premium gate middleware
types/                  # Shared TypeScript types (frozen contracts)
supabase/               # DB schema
tests/e2e/              # Playwright E2E tests
scripts/                # Demo seed data
```

---

## Track-specific features

### AlphaTON Capital track

- Telegram bot + Mini App — no new app install required
- AI receipt parsing with photo or text input
- TON payment links → opens directly in Tonkeeper
- Live paid/pending/overdue status board
- x402 micro-payment gate for premium AI parsing (monetization angle)
- Viral growth: every split pulls in new users via Telegram

### XRP Ledger Programmability track

- **XRPL Checks** — on-chain digital checks for each bill share
- Participant signs via Xumm/Xaman (QR code or deeplink)
- Commitment is verifiable on XRPL explorer before money moves
- Organizer cashes all checks in one action
- Dispute flow: `CheckCancel` detection → Telegram notification
- 7-day expiry enforced on-chain

### ENS Bounty track

- Enter `alice.eth` instead of a wallet address — it just works
- Avatar loads automatically from ENS profile
- Every user gets a free `alice.satsplit.eth` subname (gasless, via NameStone)
- Text records: `app.satsplit.ton-address`, `app.satsplit.telegram`
- ENS→TON bridge: pay ENS users on TON by resolving their text record
- Pay link: `satsplit.xyz/pay/alice` — works before the user has a wallet

---

## Feature flags

Each track can be disabled independently without breaking the core:

```bash
XRPL_ENABLED=false      # disables XRPL rail entirely
ENS_ENABLED=false       # disables ENS resolution + subnames
X402_ENABLED=false      # disables premium AI gate
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Database | Supabase (Postgres + real-time) |
| Telegram | grammy (bot) + Telegram Mini App |
| TON | @tonconnect/ui-react + ton-core |
| XRPL | xrpl.js + Xumm SDK |
| ENS | wagmi + viem + @ensdomains/ensjs + NameStone |
| AI | Vercel AI SDK → Claude → Gemini Flash → OpenRouter → Ollama |
| UI | shadcn/ui + Tailwind CSS + @ensdomains/thorin |
| Testing | Playwright (E2E) |
| Deploy | Vercel |

---

## Deploying to Vercel

1. Push repo to GitHub
2. Go to vercel.com → New Project → import `satsplit-test`
3. Add all env vars from `.env.example` in the Vercel dashboard
4. Deploy — Vercel auto-detects Next.js
5. Set your Telegram bot webhook:

```bash
curl https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook \
  -d url=https://your-app.vercel.app/api/telegram/webhook
```

---

## Running tests

```bash
npm run test:e2e          # all Playwright tests
npm run test:e2e:core     # core TON flow only
npm run test:e2e:ens      # ENS flow only
npm run test:e2e:xrpl     # XRPL flow only
```

Seed demo data for testing:

```bash
npx tsx scripts/seed-demo.ts
```

---

## License

MIT
