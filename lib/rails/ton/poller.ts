// TON blockchain poller — watches for incoming transfers matching split payments
// Uses TON Center API v2

import { parseSplitComment } from "./payment-link"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { PaymentRequest } from "@/types"

// Resolve base URL from env: supports NEXT_PUBLIC_TON_NETWORK=testnet|mainnet
function getTonCenterBase(): string {
  if (process.env.NEXT_PUBLIC_TON_NETWORK === "testnet") {
    return "https://testnet.toncenter.com/api/v2"
  }
  return "https://toncenter.com/api/v2"
}

// Raw transaction shape returned by TON Center
type TonCenterTx = {
  transaction_id?: { hash?: string; lt?: string }
  utime: number
  in_msg?: {
    source?: string
    destination?: string
    value?: string
    message?: string
  }
}

/**
 * Poll a TON address for incoming transactions since a given logical time.
 */
export async function pollTonAddress(params: {
  address: string
  sinceLogicalTime?: string
  limit?: number
}): Promise<
  Array<{
    txHash: string
    fromAddress: string
    amount: string
    comment: string | null
    logicalTime: string
    timestamp: number
  }>
> {
  const base = getTonCenterBase()
  const limit = params.limit ?? 10
  const url = `${base}/getTransactions?address=${encodeURIComponent(params.address)}&limit=${limit}`

  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) {
    throw new Error(`TON Center error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  const txs: TonCenterTx[] = data.result ?? []

  return txs.flatMap((tx) => {
    const msg = tx.in_msg
    if (!msg?.value) return []

    const lt = tx.transaction_id?.lt ?? "0"
    // Filter by sinceLogicalTime if provided (BigInt comparison)
    if (
      params.sinceLogicalTime &&
      BigInt(lt) <= BigInt(params.sinceLogicalTime)
    ) {
      return []
    }

    return [
      {
        txHash: tx.transaction_id?.hash ?? "",
        fromAddress: msg.source ?? "",
        amount: msg.value,
        comment: msg.message ?? null,
        logicalTime: lt,
        timestamp: tx.utime,
      },
    ]
  })
}

/**
 * Match an incoming transaction to a PaymentRequest using the split comment.
 * Comment format: "SatSplit:<splitId8>:<participantId8>"
 */
export function matchTxToPaymentRequest(
  tx: { comment: string | null; amount: string },
  paymentRequests: PaymentRequest[]
): PaymentRequest | null {
  if (!tx.comment) return null

  const parsed = parseSplitComment(tx.comment)
  if (!parsed) return null

  for (const pr of paymentRequests) {
    // parseSplitComment returns the first 8 chars of each id
    if (
      pr.splitSessionId.startsWith(parsed.splitId) &&
      pr.participantId.startsWith(parsed.participantId)
    ) {
      return pr
    }
  }

  return null
}

/**
 * Main poller: check all pending TON payment requests for a split and confirm
 * any transactions that match.
 *
 * Steps:
 * 1. Load all pending TON payment requests for the split from Supabase
 * 2. Poll the TON_RECEIVER_ADDRESS for recent incoming transactions
 * 3. Match txs to payment requests by comment
 * 4. For each match: update payment_requests.status = 'confirmed', insert payment_receipts row
 * 5. Return list of confirmed payment request IDs + any errors
 */
export async function pollSplitPayments(splitSessionId: string): Promise<{
  confirmed: Array<{ paymentRequestId: string; txHash: string }>
  errors: string[]
}> {
  const confirmed: Array<{ paymentRequestId: string; txHash: string }> = []
  const errors: string[] = []

  const receiverAddress = process.env.TON_RECEIVER_ADDRESS
  if (!receiverAddress) {
    return {
      confirmed: [],
      errors: ["TON_RECEIVER_ADDRESS env var is not set"],
    }
  }

  const supabase = await createServerSupabaseClient()

  // 1. Load all pending TON payment requests for this split
  const { data: prRows, error: prErr } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("split_session_id", splitSessionId)
    .eq("rail", "ton")
    .eq("status", "pending")

  if (prErr) {
    return { confirmed: [], errors: [prErr.message] }
  }

  if (!prRows || prRows.length === 0) {
    return { confirmed: [], errors: [] }
  }

  const paymentRequests: PaymentRequest[] = prRows.map((row: any) => ({
    id: row.id,
    splitSessionId: row.split_session_id,
    participantId: row.participant_id,
    amount: Number(row.amount),
    amountNative: row.amount_native != null ? Number(row.amount_native) : undefined,
    status: row.status,
    paymentLink: row.payment_link,
    rail: row.rail,
    xrplCheckId: row.xrpl_check_id ?? undefined,
  }))

  // 2. Poll the receiver address
  let txList: Awaited<ReturnType<typeof pollTonAddress>>
  try {
    txList = await pollTonAddress({ address: receiverAddress, limit: 50 })
  } catch (e: any) {
    return { confirmed: [], errors: [e.message ?? "Failed to poll TON Center"] }
  }

  // Track already-matched request IDs to avoid double-confirming within this run
  const matchedRequestIds = new Set<string>()

  for (const tx of txList) {
    const match = matchTxToPaymentRequest(tx, paymentRequests)
    if (!match) continue
    if (matchedRequestIds.has(match.id)) continue

    matchedRequestIds.add(match.id)

    try {
      // 4a. Update payment_requests.status = 'confirmed'
      const { error: updateErr } = await supabase
        .from("payment_requests")
        .update({ status: "confirmed" })
        .eq("id", match.id)

      if (updateErr) {
        errors.push(`Failed to update payment request ${match.id}: ${updateErr.message}`)
        continue
      }

      // 4b. Insert payment_receipts row
      const { error: insertErr } = await supabase
        .from("payment_receipts")
        .insert({
          payment_request_id: match.id,
          tx_hash: tx.txHash,
          rail: "ton",
          paid_at: new Date(tx.timestamp * 1000).toISOString(),
        })

      if (insertErr) {
        errors.push(`Failed to insert receipt for ${match.id}: ${insertErr.message}`)
        continue
      }

      confirmed.push({ paymentRequestId: match.id, txHash: tx.txHash })
    } catch (e: any) {
      errors.push(`Unexpected error for ${match.id}: ${e.message}`)
    }
  }

  return { confirmed, errors }
}
