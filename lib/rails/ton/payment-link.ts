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
 * Build a native TON deeplink (wallet-agnostic).
 * Opens any installed TON wallet app with pre-filled transfer.
 * Format: ton://transfer/<address>?amount=<nanotons>&text=<comment>
 */
export function buildTonPaymentLink(params: {
  toAddress: string   // recipient TON address (raw or user-friendly)
  amountTon: number   // amount in TON (not nanotons)
  comment?: string    // optional memo
}): string {
  const nanotons = tonToNano(params.amountTon).toString()
  const parts = [`ton://transfer/${params.toAddress}?amount=${nanotons}`]
  if (params.comment) {
    parts.push(`text=${encodeURIComponent(params.comment)}`)
  }
  return parts.join("&")
}

/**
 * Build a Tonkeeper HTTPS payment link with pre-filled recipient, amount, and memo.
 * Works as a URL button in Telegram (no app install detection needed).
 *
 * For testnet: the user must have Tonkeeper in testnet mode (Settings → Dev tools).
 * For mainnet: works out of the box.
 *
 * Format: https://app.tonkeeper.com/transfer/<address>?amount=<nanotons>&text=<comment>
 */
export function buildTonkeeperPaymentLink(params: {
  toAddress: string   // recipient TON address
  amountTon: number   // amount in TON (used as-is; fiat treated as TON for demo)
  comment?: string
}): string {
  const nanotons = tonToNano(params.amountTon).toString()
  const urlParams = new URLSearchParams({ amount: nanotons })
  if (params.comment) urlParams.set("text", params.comment)
  return `https://app.tonkeeper.com/transfer/${params.toAddress}?${urlParams.toString()}`
}

/**
 * Build the Telegram Wallet inline payment link (mainnet only, no recipient address).
 * Falls back to this when no TON_COLLECTION_ADDRESS is set.
 */
export function buildTelegramWalletLink(
  amount: number,
  splitId: string,
  _memo: string
): string {
  const nanotons = tonToNano(amount).toString()
  const params = new URLSearchParams({
    startattach: "pay",
    amount: nanotons,
    currency: "TON",
    comment: `TonPal-${splitId.slice(-8)}`,
  })
  return `https://t.me/wallet?${params.toString()}`
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
