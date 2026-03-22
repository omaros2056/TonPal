// mUSD Jetton payment link builder (TON blockchain)
// mUSD is a stablecoin Jetton on TON. 1 mUSD = 1_000_000 atomic units (6 decimals).

import type { PaymentRequest } from "@/types"

/** @deprecated kept for legacy callers — use musdToAtomic instead */
const TON_TO_NANO = 1_000_000_000

const MUSD_DECIMALS = 1_000_000  // 6 decimal places

/**
 * Convert mUSD to its atomic (minimal) units (1 mUSD = 1_000_000 units).
 */
export function musdToAtomic(amount: number): bigint {
  return BigInt(Math.round(amount * MUSD_DECIMALS))
}

/** @deprecated alias kept for backward compat */
export function tonToNano(ton: number): bigint {
  return BigInt(Math.round(ton * TON_TO_NANO))
}

/**
 * Server-side helper: resolves the owner's Jetton wallet address for a given
 * Jetton master contract by calling TON Center's runGetMethod.
 * Uses ton-core (server-only — not safe to call client-side).
 */
export async function getJettonWalletAddress(
  jettonMaster: string,
  ownerAddress: string,
  tonBase: string
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { beginCell, Address, Cell } = require("ton-core")
  const addrCell = beginCell().storeAddress(Address.parse(ownerAddress)).endCell()
  const addrBoc = (addrCell.toBoc() as Buffer).toString("base64")

  const res = await fetch(`${tonBase}/runGetMethod`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: jettonMaster,
      method: "get_wallet_address",
      stack: [["tvm.Slice", addrBoc]],
    }),
  })
  const data = await res.json()
  const cellBoc = data.result?.stack?.[0]?.[1]?.bytes
  if (!cellBoc) throw new Error("get_wallet_address returned no data")
  return (Cell.fromBase64(cellBoc) as ReturnType<typeof Cell.fromBase64>)
    .beginParse()
    .loadAddress()
    .toString({ bounceable: true })
}

/**
 * Parse an incoming TON transaction's message body for a Jetton transfer_notification.
 * Returns { amountMusd, comment } or null if this is not a Jetton notification.
 *
 * Transfer_notification op: 0x7362d09c
 * Structure: op(32) query_id(64) amount(coins) sender(addr) forward_payload(Either Cell ^Cell)
 */
export function parseJettonNotification(msgDataBody: string): {
  amountMusd: number
  comment: string | null
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Cell } = require("ton-core")
    const cell = Cell.fromBase64(msgDataBody) as ReturnType<typeof Cell.fromBase64>
    const slice = cell.beginParse()

    const op = slice.loadUint(32)
    if (op !== 0x7362d09c) return null  // not transfer_notification

    slice.loadUint(64)        // query_id
    const atomicAmount = slice.loadCoins() as bigint
    slice.loadAddress()       // sender (skip)

    let comment: string | null = null
    try {
      const hasRef = slice.loadBit()
      const fps = hasRef ? slice.loadRef().beginParse() : slice
      if (fps.remainingBits >= 32) {
        const payloadOp = fps.loadUint(32)
        if (payloadOp === 0) comment = fps.loadStringTail()
      }
    } catch { /* no forward payload */ }

    return {
      amountMusd: Number(atomicAmount) / MUSD_DECIMALS,
      comment,
    }
  } catch {
    return null
  }
}

/**
 * Build a Tonkeeper HTTPS payment link with pre-filled recipient, amount, and memo.
 * Includes the mUSD Jetton master address so Tonkeeper loads the correct token.
 * Works as a URL button in Telegram (no app install detection needed).
 */
export function buildTonkeeperPaymentLink(params: {
  toAddress: string   // recipient TON address
  amountTon: number   // amount in mUSD (1:1 with fiat)
  comment?: string
}): string {
  const atomicAmount = musdToAtomic(params.amountTon).toString()
  const jettonMaster =
    process.env.NEXT_PUBLIC_MUSD_JETTON_MASTER ??
    process.env.MUSD_JETTON_MASTER ?? ""
  const urlParams = new URLSearchParams({ amount: atomicAmount })
  if (params.comment) urlParams.set("text", params.comment)
  if (jettonMaster) urlParams.set("jetton", jettonMaster)
  return `https://app.tonkeeper.com/transfer/${params.toAddress}?${urlParams.toString()}`
}

/**
 * Build the Telegram Wallet inline payment link for mUSD.
 */
export function buildTelegramWalletLink(
  amount: number,
  splitId: string,
  _memo: string
): string {
  const atomicAmount = musdToAtomic(amount).toString()
  const params = new URLSearchParams({
    startattach: "pay",
    amount: atomicAmount,
    currency: "mUSD",
    comment: `TonPal-${splitId.slice(-8)}`,
  })
  return `https://t.me/wallet?${params.toString()}`
}

/**
 * Build a PaymentRequest record (without id) for a mUSD Jetton payment.
 */
export function buildPaymentRequest(params: {
  splitSessionId: string
  participantId: string
  amount: number       // in fiat (EUR/USD) — equals mUSD amount (1:1)
  amountTon: number    // in mUSD (kept as amountTon for interface compat)
  toAddress: string
  comment?: string
}): Omit<PaymentRequest, "id"> {
  const paymentLink = buildTonkeeperPaymentLink({
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
