// TON blockchain poller — watches for incoming transfers matching split payments
// Uses TON Center API v2

import { parseSplitComment } from "./payment-link"

const TONCENTER_BASE =
  process.env.TONCENTER_API_URL ?? "https://toncenter.com/api/v2"

export type TonTransfer = {
  txHash: string
  from: string
  to: string
  amount: string  // in nanotons
  comment: string
  timestamp: number
}

export async function fetchRecentTransfers(address: string, limit = 20): Promise<TonTransfer[]> {
  const url = `${TONCENTER_BASE}/getTransactions?address=${address}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TON Center error: ${res.status}`)
  const data = await res.json()

  return (data.result ?? []).flatMap((tx: any) => {
    const msg = tx.in_msg
    if (!msg || !msg.value) return []
    return [{
      txHash: tx.transaction_id?.hash ?? "",
      from: msg.source ?? "",
      to: msg.destination ?? "",
      amount: msg.value,
      comment: msg.message ?? "",
      timestamp: tx.utime,
    }]
  })
}

export async function findMatchingTransfer(
  address: string,
  splitId: string,
  participantId: string
): Promise<TonTransfer | null> {
  const transfers = await fetchRecentTransfers(address, 50)
  for (const t of transfers) {
    const parsed = parseSplitComment(t.comment)
    if (
      parsed &&
      splitId.startsWith(parsed.splitId) &&
      participantId.startsWith(parsed.participantId)
    ) {
      return t
    }
  }
  return null
}
