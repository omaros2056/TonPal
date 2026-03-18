---
name: satsplit-ai
status: backlog
created: 2026-03-18T23:25:41Z
updated: 2026-03-18T23:25:41Z
progress: 0%
prd: .claude/prds/satsplit-ai.md
github: (will be set on sync)
---

# Epic: satsplit-ai

## Overview

SatSplit AI is a Telegram Mini App + bot for AI-powered group expense splitting. Users send a receipt photo or natural-language message; AI parses it into structured data; participants are assigned via Telegram identity, ENS names, or handles; payment requests are created on TON (primary) and XRPL (secondary); a live status board tracks paid/pending/overdue.

Competing in three hackathon tracks simultaneously:
- **AlphaTON Capital** — Telegram-native TON app with AI and monetization
- **XRP Ledger Programmability** — XRPL Checks as trustless multi-party settlement
- **ENS Bounty** — Identity-first payments with subnames, text records, avatars

## Architecture Decisions

1. **Next.js App Router** — single codebase for both the Mini App frontend and all API routes
2. **Supabase** — hosted Postgres for splits, participants, payment requests, receipts; real-time subscriptions for status board
3. **grammy** — Telegram bot SDK (TypeScript-native, modern API)
4. **TON Connect 2.0** — client-side wallet connection, no private keys on server
5. **xrpl.js** — official XRPL library for CheckCreate/Cash/Cancel and ledger polling
6. **wagmi + viem** — ENS resolution hooks in React; no extra abstraction needed
7. **NameStone REST API** — offchain subname creation for `*.satsplit.eth`; gasless, instant
8. **Vercel AI SDK** — unified interface for Claude/Gemini/OpenRouter/Ollama model routing
9. **Feature flags via env vars** — `XRPL_ENABLED`, `ENS_ENABLED`, `X402_ENABLED` — each track disable-able independently
10. **Multi-rail status board** — `paid = any PaymentReceipt exists for participant` across all rails

## Technical Approach

### Frontend Components
- `ParticipantCard` — renders Telegram/ENS/XRPL identity + payment status + rail badge
- `ReceiptScanForm` — photo upload + text input + manual correction UI
- `SplitBoard` — live status board (paid/pending/overdue per participant)
- `RailSelector` — TON vs XRPL choice per split
- `EnsInput` — ENS name input with live resolution + avatar preview
- `XrplCheckFlow` — Xumm QR code display + check status tracker

### Backend Services
- `lib/ai/parse.ts` — receipt parsing with model routing + fallback chain
- `lib/telegram/bot.ts` — grammy bot handlers (photo, text, commands, webhooks)
- `lib/rails/ton/` — TON payment link builder + confirmation poller
- `lib/rails/xrpl/` — CheckCreate/Cash/Cancel + Xumm sign request + ledger poller
- `lib/ens/resolve.ts` — ENS name resolution, avatar, text records
- `lib/ens/subnames.ts` — NameStone REST wrapper for subname CRUD
- `lib/x402/gate.ts` — x402 middleware for premium AI route

### Infrastructure
- Vercel (frontend + API routes + cron for pollers)
- Supabase (Postgres + real-time)
- XRPL Testnet → Mainnet for demo
- ENS Mainnet (NameStone offchain resolver for `satsplit.eth`)

## Implementation Strategy

Foundation first (task 001) unblocks all parallel streams. Tasks 002, 003, 004, 006 run in parallel after foundation. XRPL (007) starts after split amounts and participant schema are stable. x402 (008) is fully isolated.

## Task Breakdown Preview

| # | Task | Parallel | Depends on |
|---|---|---|---|
| 001 | Foundation: Next.js + Supabase + schema + env | false | — |
| 002 | Telegram bot + Mini App shell + webhook | true | 001 |
| 003 | AI receipt parsing + manual correction UI | true | 001 |
| 004 | Split engine + participant assignment + TON payment links | true | 001 |
| 005 | TON payment confirmation poller + status board | false | 004 |
| 006 | ENS resolution + NameStone subnames + text records | true | 001 |
| 007 | XRPL Checks: CheckCreate/Cash/Cancel + Xumm + poller | true | 004 |
| 008 | x402 premium AI gate | true | 003 |
| 009 | E2E tests (Playwright) + demo seed data + README | false | 005+006+007 |
| 010 | Pitch deck + Vercel deploy + testnet smoke test | false | 009 |

## Dependencies

External: Supabase project, Telegram bot token, Gemini API key, XRPL Testnet wallet, ENS `satsplit.eth` registered, NameStone API key, Vercel account

## Success Criteria (Technical)

- Full TON flow demo in ≤ 90 s
- XRPL Check created + cashed + cancelled on testnet
- `alice.satsplit.eth` resolves with avatar + text records on Mainnet
- All feature flags independently disable-able
- Deployed to Vercel with public URL

## Estimated Effort

Total: ~60–70 hours across all parallel streams
