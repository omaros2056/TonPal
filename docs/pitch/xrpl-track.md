# SatSplit AI — XRP Ledger Programmability Pitch Script

**Time budget: 5 minutes total. Demo: 90 seconds. Talk: 3.5 minutes.**

---

## Opening (20 seconds)

"Multi-party bill splitting is a trust problem."

"When 8 people owe money and you're the one who paid, you have no on-chain record of who committed. People ghost. People 'forget'. And there's nothing you can do about it."

"XRPL Checks solve this. SatSplit puts them in your Telegram group."

---

## The problem (30 seconds)

"Existing payment rails are binary — either money moved, or it didn't. There's no intermediate state where someone has committed to pay but hasn't executed yet."

"In group expense scenarios, you need exactly that intermediate state: I want to know that Alice has committed her €18.75 share before I consider the bill settled, even if she pays tomorrow."

"XRPL Checks are a native ledger primitive that does exactly this. They're digital checks — signed commitments on-chain, cashable by the recipient, with enforced expiry."

---

## The solution (30 seconds)

"SatSplit uses XRPL Checks as the settlement layer for group expenses:"

→ **START DEMO**

1. Organizer creates a split — 4 people, dinner €84
2. Each participant gets a Xumm sign request — QR code in the Mini App
3. "Alice scans — Xaman opens — she signs the CheckCreate"
4. "The check appears on XRPL explorer immediately — her commitment is on-chain"
5. "When everyone has committed, organizer hits 'Settle' — CheckCash for each check"
6. "If Charlie cancels his check — bot detects CheckCancel, notifies the group"

→ **END DEMO — 90 seconds**

---

## Why this fits the Programmability track (30 seconds)

"XRPL Checks are under-used. Most XRPL apps do simple payments. SatSplit shows a real workflow that requires the Check primitive specifically:"

- "Trustless commitment: Alice's promise is on-chain before money moves"
- "Multi-party coordination: organizer manages N checks, cashes all at once"
- "Built-in dispute resolution: CheckCancel is detectable and actionable"
- "Expiry enforcement: 7-day window, enforced by the ledger, not by us"

"This is XRPL programmability in a product that real people would actually use."

---

## Real users, real problem (20 seconds)

"The target is friend groups and student assos that run recurring events. The XRPL rail is the trust layer — it turns a social obligation into a verifiable commitment."

"No EVM. No smart contracts. Just XRPL primitives, used correctly."

---

## Closing (10 seconds)

"Trustless multi-party settlement. In Telegram. On XRPL."

"SatSplit."

---

## Judge Q&A prep

**Q: Why XRPL over other chains?**
A: CheckCreate/Cash/Cancel is a native XRPL feature — no smart contract deployment, no gas estimation uncertainty, deterministic expiry. No other chain has this as a first-class primitive.

**Q: How does the user sign the Check?**
A: Xumm (Xaman) — the standard XRPL wallet. We generate a sign request payload, display it as a QR code in the Mini App. User scans with Xaman on their phone, signs, done.

**Q: What if a user doesn't have Xaman?**
A: They fall back to the TON rail — same split, different payment method. The status board handles both rails.
