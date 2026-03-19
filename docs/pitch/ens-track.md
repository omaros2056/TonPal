# SatSplit AI — ENS Bounty Pitch Script

**Time budget: 5 minutes total. Demo: 90 seconds. Talk: 3.5 minutes.**

---

## Opening (20 seconds)

"Her wallet address is 0x742d35Cc6634C0532925a3b8D4C9E4F1c8b4f1c8."

"Her ENS name is alice.eth."

"One of those is a human identity. The other is an accident of cryptography."

"SatSplit makes payments identity-first — starting with the name, not the address."

---

## The problem (30 seconds)

"Crypto payments have an onboarding problem. Before someone can receive money, they need a wallet, an address, and they need to share it with you out-of-band. That's three friction points before a single euro moves."

"ENS solves the address problem. But most apps treat ENS as a display name — they resolve it to an address and then forget it ever existed."

"SatSplit goes further. We use ENS as a real identity layer — avatar, text records, cross-app data, and subnames."

---

## The solution (30 seconds)

"Here's what happens when you add alice.eth to a SatSplit:"

→ **START DEMO**

1. "I type alice.eth in the participant field"
2. "Her avatar loads instantly — pulled from her ENS profile"
3. "Her display name appears: Alice M."
4. "SatSplit resolves her `app.satsplit.ton-address` text record → gets her TON wallet"
5. "Payment goes to her TON wallet, addressed to her ENS name, not her address"
6. "New user who doesn't have ENS? We create `charlie.satsplit.eth` for free — gasless, instant"
7. "Charlie's subname has his Telegram handle and TON address in text records"
8. "Pay link: satsplit.xyz/pay/charlie — works before he has a wallet"

→ **END DEMO — 90 seconds**

---

## ENS features used (30 seconds)

"We're not just resolving names. We're using ENS as a full identity stack:"

- **Primary name resolution** — `alice.eth` → EVM address
- **Avatar** — profile picture from ENS profile, shown in participant card
- **Text records** — `app.satsplit.ton-address` bridges ENS identity to TON payments
- **Subnames** — `alice.satsplit.eth` via NameStone offchain resolver, gasless, instant
- **Cross-app identity** — any app that reads ENS text records can see SatSplit data

"This is the ENS bounty criteria: subnames, resolvers, avatars, text records, and cross-app identity. All five."

---

## The onboarding angle (20 seconds)

"The hardest part of crypto onboarding is the first step. SatSplit removes it."

"New user joins a split. We create `charlie.satsplit.eth` for him. He has a human-readable identity, a payment address, and a profile — before he's ever touched a wallet."

"That's account abstraction in spirit: identity first, infrastructure second."

---

## Closing (10 seconds)

"Identity-first payments. ENS as the bridge between people and money."

"SatSplit."

---

## Judge Q&A prep

**Q: Why NameStone for subnames?**
A: NameStone is the standard offchain ENS subname resolver. Gasless, instant, ENS-compatible. `alice.satsplit.eth` resolves in any ENS-aware app without us ever touching mainnet gas.

**Q: How does the ENS→TON bridge work?**
A: We write a custom text record key `app.satsplit.ton-address` to the user's ENS name (or their satsplit.eth subname). When routing a TON payment to an ENS user, we resolve that text record. Standard ENS resolution, custom key.

**Q: What if someone's ENS has no avatar?**
A: We show a colored placeholder (like WhatsApp's initials fallback). The subname we create for new users gets a default avatar from their Telegram profile picture if available.
