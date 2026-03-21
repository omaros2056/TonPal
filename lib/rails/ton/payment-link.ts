// TON payment deeplink builder
// Format: ton://transfer/<address>?amount=<nanotons>&text=<comment>

import type { PaymentRequest } from "@/types"

const TON_TO_NANO = 1_000_000_000

/**
 * Convert TON to nanotons (1 TON = 1_000_000_000 nanotons).
 */
export function tonToNano(ton: number): bigint {
  return BigInt(Math.round(ton * TON_TO_NANO))
}

/**
 * Build a TON deeplink payment URL.
 * Format: ton://transfer/<address>?amount=<nanotons>&text=<comment>
 */
export function buildTonPaymentLink(params: {
  toAddress: string   // recipient TON address (raw or user-friendly)
  amountTon: number   // amount in TON (not nanotons)
  comment?: string    // optional comment (e.g. "SatSplit: Dinner - Alice")
}): string {
  const nanotons = tonToNano(params.amountTon).toString()
  const parts = [`ton://transfer/${params.toAddress}?amount=${nanotons}`]
  if (params.comment) {
    parts.push(`text=${encodeURIComponent(params.comment)}`)
  }
  return parts.join("&")
}

/**
 * Build a PaymentRequest record (without id) for a TON payment.
 */
export function buildPaymentRequest(params: {
  splitSessionId: string
  participantId: string
  amount: number      // in fiat (EUR/USD)
  amountTon: number   // in TON
  toAddress: string
  comment?: string
}): Omit<PaymentRequest, "id"> {
  const paymentLink = buildTonPaymentLink({
    toAddress: params.toAddress,
    amountTon: params.amountTon,
    comment: params.comment,
  })

  return {
    splitSessionId: params.splitSessionId,
    participantId: params.participantId,
    amount: params.amount,
    amountNative: params.amountTon,
    status: "pending",
    paymentLink,
    rail: "ton",
  }
}

/**
 * Legacy helper — kept for backward compat with poller.ts.
 */
export function buildSplitComment(splitId: string, participantId: string): string {
  return `SatSplit:${splitId.slice(0, 8)}:${participantId.slice(0, 8)}`
}

// Parse a transfer comment to identify the split and participant
export function parseSplitComment(comment: string): { splitId: string; participantId: string } | null {
  const match = comment.match(/^SatSplit:([a-f0-9-]{8}):([a-f0-9-]{8})$/)
  if (!match) return null
  return { splitId: match[1], participantId: match[2] }
}

/**
 * Build a Telegram Wallet payment link.
 * Opens the @wallet bot in Telegram with a pre-filled payment request.
 * Format: https://t.me/wallet?startattach=pay&amount={amount}&currency=TON&comment=SatSplit-{splitId}
 *
 * Note: `amount` here is in TON (the wallet bot interprets the amount field).
 */
export function buildTelegramWalletLink(
  amount: number,
  splitId: string,
  memo: string
): string {
  const params = new URLSearchParams({
    startattach: "pay",
    amount: String(amount),
    currency: "TON",
    comment: `SatSplit-${splitId}`,
  })
  // memo is appended as extra context (non-standard, for logging/display)
  if (memo) {
    params.set("text", memo)
  }
  return `https://t.me/wallet?${params.toString()}`
}
