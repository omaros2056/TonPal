---
name: satsplit-ai
description: Telegram Mini App + bot for AI-powered group expense splitting with TON payments, ENS identity, and conversational receipt parsing
status: backlog
created: 2026-03-18T22:55:58Z
---

# PRD: satsplit-ai

## Executive Summary

SatSplit AI is a Telegram-native group expense splitting tool. Users submit a receipt photo or natural-language message; an AI model extracts the total and line items, proposes a split, and generates individual TON payment requests for each participant. Identity is resolved through Telegram usernames, ENS names, or plain handles. The group sees a live paid / pending / overdue status board inside Telegram or the Mini App.

Built for a hackathon targeting three simultaneous prizes: the **AlphaTON Capital** prize (TON-native Telegram app), the **XRP Ledger Programmability** prize (XRPL Checks as a trustless multi-party settlement layer), and the **ENS Bounty** (identity-first payments with subnames and text records). x402 AgentPay is an additional monetization layer.

---

## Problem Statement

Splitting group expenses today requires:
- manual calculation or an app that nobody in the group has installed
- sharing crypto addresses or bank details out-of-band
- chasing people for payment with no automated reminders

Telegram-native communities (students, friend groups, assos) already organize everything in Telegram. SatSplit meets them where they are: no new app install, AI handles the arithmetic, and TON handles the payments.

---

## User Stories

### Core — Receipt parsing
- **As a group organizer**, I can send a receipt photo to the bot, so that the AI extracts the merchant, total, tax, and line items without manual entry.
  - *Acceptance*: structured `ReceiptScan` returned within 5 s; all fields populated or marked unknown.

### Core — Split creation
- **As a group organizer**, I can define a split (equal or itemized), assign participants, and confirm the amounts, so that everyone knows what they owe.
  - *Acceptance*: split is editable before sending; final amounts sum to total.

### Core — TON payment requests
- **As a participant**, I receive an individual TON payment link / deeplink, so that I can pay directly from Tonkeeper without knowing anyone's wallet address.
  - *Acceptance*: each participant gets a unique `PaymentRequest` with a valid TON deeplink.

### Core — Status board
- **As the group organizer**, I can see in real time who has paid, who is pending, and who is overdue.
  - *Acceptance*: status updates within 10 s of on-chain confirmation; bot posts a summary message on change.

### ENS — Identity resolution
- **As a user**, I can enter an ENS name (e.g. `alice.eth`) instead of a wallet address or Telegram handle, so that payment is identity-first.
  - *Acceptance*: ENS resolves to an EVM address; avatar and display name shown when available.

### ENS — Subname identity (`alice.satsplit.eth`)
- **As a new user**, I am offered a free `alice.satsplit.eth` subname on first interaction, so that I have a payments identity before I own an ENS name.
  - *Acceptance*: subname created gaslessly via NameStone; resolves via standard ENS tools; stores TON address and Telegram handle in text records.

### XRPL — Programmable settlement
- **As a participant**, I can commit to my share of a bill by issuing an XRPL Check on-chain, so that my payment commitment is verifiable without paying immediately.
  - *Acceptance*: CheckCreate signed via Xumm; check visible on XRPL explorer; organizer can cash or participant can cancel; expiry enforced on-chain.

### Bonus — x402 AgentPay (isolated)
- **As an organizer**, I can unlock premium AI parsing (longer receipts, multi-currency) by paying a micro-fee via x402, so that the product has a revenue model.
  - *Acceptance*: x402 paywall gate works; premium route is reached on successful payment; core flow unaffected if x402 is disabled.

---

## Functional Requirements

### FR-1: Telegram entry points
- Telegram bot (`/start`, `/split`, photo message handler)
- Telegram Mini App (full UI, launched from bot inline button)

### FR-2: AI receipt parsing
- Input: receipt image (JPEG/PNG) or natural-language text
- Output: `ReceiptScan { merchant, currency, total, tax?, items[], rawImageUrl }`
- Model routing: primary AlphaTON/Claude → fallback OpenRouter → fallback Ollama
- Manual correction UI for all fields

### FR-3: Split engine
- Modes: equal split, itemized (per-item assignment), custom amounts
- Validation: amounts must sum to total; at least 2 participants

### FR-4: Participant identity
- Sources (in order of preference): ENS name → Telegram userId → plain handle
- `Participant { id, telegramUserId?, displayName, ensName?, satsplitSubname?, handle?, tonAddress?, evmAddress?, xrpAddress? }`
- ENS resolution via wagmi + viem; avatar + text records fetched when available
- Subname creation: `alice.satsplit.eth` via NameStone offchain resolver (gasless, instant)
- Text record schema: `app.satsplit.ton-address`, `app.satsplit.telegram`, `app.satsplit.splits-paid`
- ENS→TON bridge: resolve `app.satsplit.ton-address` text record to route TON payment to ENS users

### FR-5: Payment rails
- **TON rail**: Create `PaymentRequest` per participant with TON deeplink to Tonkeeper; confirm via blockchain polling
- **XRPL rail**: Build `CheckCreate` transaction for participant's XRP address; deliver Xumm sign request (QR + deeplink); poll `/account_objects` for check state (Created / Cashed / Cancelled / Expired); organizer cashes all checks via `CheckCash`; dispute via `CheckCancel` detection
- `PaymentRequest { id, splitSessionId, participantId, amount, amountNative?, status, paymentLink, rail: "ton" | "xrpl" }`
- `PaymentReceipt { id, paymentRequestId, txHash, rail: "ton" | "xrpl", paidAt }`
- Status board: `paid = any PaymentReceipt exists for participant across any rail`

### FR-6: Status board
- Real-time paid / pending / overdue per participant
- Bot pushes update message on status change
- Mini App dashboard auto-refreshes

### FR-7: API surface
```
POST /api/receipts/parse
POST /api/splits
POST /api/splits/:id/participants
POST /api/payment-links
POST /api/payments/confirm
POST /api/telegram/webhook
GET  /api/splits/:id/status
POST /api/xrpl/checks/create       ← XRPL rail
POST /api/xrpl/checks/cash         ← XRPL rail
GET  /api/xrpl/checks/status/:id   ← XRPL rail
POST /api/ens/subnames/create      ← ENS subname
GET  /api/ens/resolve/:name        ← ENS resolution
POST /api/agentpay/premium         ← x402, isolated
```

---

## Non-Functional Requirements

- **Demo fit**: core demo ≤ 90 s; product understandable in ≤ 20 s cold
- **Latency**: receipt parse ≤ 5 s; payment confirmation propagation ≤ 10 s
- **Availability**: Vercel deploy with Supabase; no self-hosted infra required for demo
- **Isolation**: each bonus track (x402, XRPL, Ledger) must be disable-able without breaking core
- **Security**: no private keys in repo; TON Connect handles signing client-side

---

## Success Criteria

| Criterion | Target |
|---|---|
| Receipt photo → split created | ≤ 5 s parse time |
| TON payment link delivered | every participant receives a working deeplink |
| At least 1 payment confirmed end-to-end | on testnet or mainnet |
| Status board updates | within 10 s of confirmation |
| ENS name resolves to avatar + address | 100% of valid .eth names |
| `alice.satsplit.eth` subname created gaslessly | instant, no gas cost |
| XRPL Check created, cashed, and cancelled | demonstrated on XRPL Testnet |
| ENS→TON address bridge via text record | resolves `app.satsplit.ton-address` |
| Core works with all tracks disabled | yes (feature flags) |
| Live demo on Vercel or runnable local demo | shipped |
| README + 5-min pitch deck (3 track versions) | shipped |

---

## Constraints & Assumptions

- **TON is the primary payment rail** — but XRPL is a first-class second rail targeting the $2,500 XRPL prize
- **Telegram-native UX** takes priority over multi-chain ambition
- **Hackathon timeline** — no feature that risks the MVP is acceptable
- **Official challenge not yet received** — plan is built on inferred tracks; will be updated when official brief arrives
- **AlphaTON/Claude availability** — if unavailable, OpenRouter or Ollama fallback; product unchanged
- **No smart contract required** for MVP — standard TON transfers only; Blueprint/Tact only if a contract bonus becomes trivial and isolated
- ENS is a real product feature for the ENS bounty, not decoration

---

## Out of Scope

- Multi-chain payments beyond TON (no Ethereum, Base, Solana payments in MVP)
- Fiat on/off ramp
- In-app wallet (users bring their own Tonkeeper)
- Recurring splits / subscriptions
- Web app outside of Telegram Mini App context
- Pimlico, Safe, SIWE, Request Network, Peanut, Helio/MoonPay — out of scope
- NameStone is IN scope (used for `satsplit.eth` subnames)
- Blueprint / Tact smart contracts unless a bonus demands it and it is provably isolated
- Any reference repo (SuperClaude, agency-agents, AutoGPT, ThinkTank, MiroFish, x1xhlol/system-prompts) as a runtime dependency

---

## Dependencies

### Runtime
| Dependency | Purpose |
|---|---|
| `next` + `typescript` | App framework |
| `@tonconnect/ui-react` | TON wallet connection |
| `ton-core`, `ton-crypto` | TON transaction construction |
| `supabase-js` | DB + auth |
| `vercel/ai` (Vercel AI SDK) | AI model routing |
| `wagmi`, `viem` | ENS resolution in React |
| `@ensdomains/ensjs` | Advanced ENS (optional) |
| `@ensdomains/thorin` | ENS-aligned UI components |
| `shadcn/ui` | UI primitives |
| `grammy` or `telegraf` | Telegram bot SDK |
| `xrpl` | XRPL transaction construction + ledger queries |
| `@xumm/sdk` (optional) | Xumm/Xaman sign request payloads for XRPL |
| `namestone-sdk` or NameStone REST | Offchain ENS subname creation + text records |
| `playwright` | E2E testing |

### Dev / orchestration (not shipped in product)
| Tool | Purpose |
|---|---|
| `ccpm` | Spec → epic → GitHub Issues → parallel agents |
| `claude-mem` | Persistent implementation memory across sessions |
| `OpenClaw` | Telegram/channel ops, reminders, automation, test flows |

### Reference only (no runtime dependency)
SuperClaude_Framework, agency-agents, awesome-ai-agents-and-agentic-ai-apps, ThinkTank, AutoGPT, MiroFish, x1xhlol/system-prompts-and-models-of-ai-tools

---

## Development Phases

### Phase 1 — TON/Telegram MVP (must ship)
1. Telegram bot + Mini App bootstrap
2. Receipt photo/text ingestion
3. AI parsing with manual correction UI
4. Participant assignment (Telegram + handles)
5. TON payment link creation
6. Payment confirmation + status board

### Phase 2 — ENS identity layer (parallel with late Phase 1, targeting $500 ENS prize)
1. ENS name input + resolution (wagmi/viem)
2. Avatar + text record display (@ensdomains/thorin)
3. `alice.satsplit.eth` subname creation via NameStone (gasless)
4. Text record schema: ton-address, telegram, splits-paid
5. ENS→TON bridge: route TON payment via text record
6. Identity-first pay link: `satsplit.xyz/pay/alice`

### Phase 3 — XRPL settlement layer (after Phase 1, targeting $2,500 XRPL prize)
1. XRPL Checks: CheckCreate transaction builder
2. Xumm sign request: QR code + deeplink for participant signing
3. XRPL ledger poller: track check state per split
4. CheckCash: organizer settles all checks in one action
5. Dispute flow: CheckCancel detection → Telegram notification
6. Status board integration: XRPL rail drives same board as TON

### Phase 4 — x402 premium gate (isolated, after Phase 1 is solid)
1. x402 middleware on `/api/receipts/parse?premium=true`
2. Premium UI gate in Mini App
3. Feature flag: `X402_ENABLED=false` bypasses for core demos
