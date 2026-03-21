# Pending Product Decisions

These are ideas discussed but NOT yet implemented. Review before the official challenge and decide what to build.

---

## 1. Telegram Wallet as primary payment handler

**Decision:** Change the default payment flow to use Telegram's built-in wallet first, Tonkeeper as fallback.

**Why:** Telegram Wallet means zero app install — payment happens without ever leaving Telegram. Much stronger "Telegram-native" pitch for the AlphaTON judges.

**What changes in code:**
- Payment link builder in `lib/rails/ton/` needs to generate a `tg://` deeplink that opens Telegram Wallet first
- Tonkeeper deeplink becomes the fallback if Telegram Wallet is not set up
- UI shows "Pay with Telegram Wallet" as the primary button, "Pay with Tonkeeper" as secondary

**Status:** Not implemented. Current code targets Tonkeeper only.

---

## 2. 1% transaction fee

**Decision:** Add a 1% fee to every payment request, built transparently into the amount.

**Why:** Stronger business model than the per-scan x402 gate. Aligned with product — we only make money when money moves.

**How it works:**
- User owes €18.75 → payment request is generated for €18.94
- €18.75 routes to organizer wallet
- €0.19 routes to SatSplit fee wallet
- Fee is shown transparently in the UI ("includes 1% SatSplit fee")

**What changes in code:**
- `lib/rails/ton/payment-link.ts` needs fee calculation logic
- `SATSPLIT_FEE_WALLET` env var needed for the fee destination address
- `FEE_PERCENTAGE` env var (default `0.01`) so it can be toggled off for demo
- Status board shows net amount received vs gross amount sent

**Pitch line:** *"We take 1% on each transaction — same model as any payment processor. We only make money when money actually moves."*

**Status:** Not implemented.

---

## 3. Pitch framing decisions

These are not code changes — just how to frame things in the pitch:

- **On the wallet barrier:** Be honest. *"Setting up a wallet is a one-time thing — same barrier as any crypto app. We solve everything that comes after that."* Don't pretend it doesn't exist.
- **Core positioning:** *"Not a crypto app on Telegram. A Telegram app that uses crypto."*
- **GTM wedge:** EPFL student associations. 200+ assos, each runs weekly events, each has a treasurer dealing with this exact problem. Target 10 treasurers → viral spread to all members.
- **The reimbursement framing:** Someone always pays first at a restaurant — that's not the problem. The problem is everything after: the chasing, the forgetting, the awkward messages. SatSplit makes the payback instant and automatic.

---

## 4. Fee-free for organizers, fee on payers

**Idea floated:** The 1% fee could be charged only to the people paying back (not the organizer). This feels fairer — the person who paid the bill doesn't get charged, the people reimbursing do.

**Status:** Not decided. Worth discussing before implementation.

---

## 5. "Remind Charlie" button

**Idea:** One-tap button in the status board to send a reminder to anyone who hasn't paid yet. Bot sends them a nudge message in Telegram automatically.

**Why it matters for the pitch:** Very visual, very human moment in the demo. Judges immediately get the product.

**Status:** Not implemented but simple to add — one bot message send triggered by a button.

---

## Things to revisit when official challenge arrives

- Whether 1% fee conflicts with any track rules
- Whether Telegram Wallet API supports the deeplink format we need
- Whether to show the fee to payers or absorb it silently (transparency vs friction)
- Whether to add a "free for first 3 splits" onboarding hook for viral growth
