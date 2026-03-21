# SatSplit — Ideas Backlog

These ideas came up during planning. None are implemented yet.
Add to the codebase when the official challenge is confirmed and the foundation is tested.

---

## Payment

- **Telegram Wallet as primary payment handler** (not Tonkeeper)
  - Payment happens inside Telegram natively, zero friction, user never leaves the app
  - Tonkeeper becomes a secondary option for users who prefer a separate wallet
  - Update the payment link builder to target Telegram Wallet first
  - Much stronger pitch for the AlphaTON track ("fully inside Telegram")

- **1% transaction fee built into payment amounts**
  - If someone owes €20.00, generate a payment request for €20.20
  - €20.00 routes to the organizer's wallet, €0.20 routes to SatSplit fee wallet
  - Transparent — shown in the UI before the user pays
  - Non-custodial — SatSplit never holds anyone's money
  - Stronger business model than per-scan fees — only earn when money actually moves
  - Better pitch line: "We only make money when money moves"

---

## UX

- **"Remind Charlie" one-tap button on the status board**
  - Organizer taps button next to any pending participant
  - Bot sends them a nudge message in Telegram automatically
  - No awkward manual messages needed

---

## Pitch framing notes

- Lead with Telegram Wallet in the TON pitch — "payment happens without leaving Telegram"
- Lead with the trust problem in the XRPL pitch — "XRPL Checks turn a promise into a verifiable on-chain commitment"
- Lead with identity in the ENS pitch — "alice.eth instead of 0x742d..."
- The 1% fee is the business model answer — rehearse it clearly
- "We only earn when money moves" is the one-liner for monetization
