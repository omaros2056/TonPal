import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { parseJettonNotification } from "@/lib/rails/ton/payment-link"

/**
 * GET /api/cron/poll-payments
 *
 * Vercel cron job — polls the TON blockchain for incoming mUSD Jetton payments
 * to each active split's organizer wallet. Detects Jetton transfer_notification
 * messages, matches them by TonPal-XXXXXXXX memo, marks participants as paid,
 * and sends a Telegram notification to the group chat.
 *
 * Triggered daily via vercel.json cron config.
 */
export async function GET(req: Request) {
  // Verify cron secret (Vercel sets this header for cron invocations)
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const isTestnet = (process.env.TON_NETWORK ?? "testnet") === "testnet"
  const tonBase = isTestnet
    ? "https://testnet.toncenter.com/api/v2"
    : "https://toncenter.com/api/v2"

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return NextResponse.json({ error: "No bot token" }, { status: 500 })
  }

  // Fetch recent splits (last 24 hours)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: rows } = await db
    .from("tonpal_splits")
    .select("id, data, created_at")
    .gte("created_at", since)

  if (!rows || rows.length === 0) {
    return NextResponse.json({ checked: 0, confirmed: 0 })
  }

  let totalConfirmed = 0

  for (const row of rows) {
    const splitId = row.id as string
    const splitData = row.data as {
      merchant: string
      currency: string
      total: number
      organizer_wallet?: string
      chat_id?: number
      splits: Array<{
        handle: string
        amount: number
        paid: boolean
        tx_hash: string | null
      }>
    }

    // Skip if no wallet, no chat_id, or all already paid
    if (!splitData.organizer_wallet || !splitData.chat_id) continue
    const unpaid = splitData.splits.filter((s) => !s.paid)
    if (unpaid.length === 0) continue

    // Poll organizer's TON wallet for incoming Jetton transfer_notification messages
    const expectedComment = `TonPal-${splitId.slice(-8)}`
    let txs: Array<{
      in_msg?: {
        source?: string
        value?: string
        message?: string
        msg_data?: { type?: string; body?: string; text?: string }
      }
      transaction_id?: { hash?: string }
    }> = []

    try {
      const res = await fetch(
        `${tonBase}/getTransactions?address=${encodeURIComponent(splitData.organizer_wallet)}&limit=50`,
        { cache: "no-store" }
      )
      const data = await res.json()
      txs = data.result ?? []
    } catch {
      continue
    }

    // Match Jetton transfer_notification transactions by comment
    // The organizer's wallet receives an internal notification from their Jetton wallet
    // with a transfer_notification body containing the mUSD amount and forward_payload (comment).
    const matchingTxs = txs.filter((tx) => {
      const msg = tx.in_msg
      if (!msg) return false

      // Case 1: Jetton notification with binary body — parse it
      if (msg.msg_data?.type === "msg.dataRaw" && msg.msg_data.body) {
        const parsed = parseJettonNotification(msg.msg_data.body)
        return parsed?.comment?.includes(expectedComment) ?? false
      }

      // Case 2: Fallback — plain text comment (legacy / test transfers)
      return msg.message?.includes(expectedComment) ?? false
    })

    const newlyPaid: Array<{ handle: string; amount: number }> = []

    for (const tx of matchingTxs) {
      const msg = tx.in_msg
      const txHash = tx.transaction_id?.hash ?? ""

      let amountMusd: number

      if (msg?.msg_data?.type === "msg.dataRaw" && msg.msg_data.body) {
        const parsed = parseJettonNotification(msg.msg_data.body)
        amountMusd = parsed?.amountMusd ?? 0
      } else {
        // Fallback: treat value as nanotons for legacy native TON transfers
        amountMusd = Number(BigInt(msg?.value ?? "0")) / 1_000_000_000
      }

      const match = splitData.splits.find(
        (s) =>
          !s.paid &&
          !newlyPaid.some((p) => p.handle === s.handle) &&
          Math.abs(s.amount - amountMusd) < 0.01
      )

      if (match) {
        match.paid = true
        match.tx_hash = txHash
        newlyPaid.push({ handle: match.handle, amount: match.amount })
      }
    }

    if (newlyPaid.length === 0) continue

    // Save to DB
    await db
      .from("tonpal_splits")
      .update({ data: splitData })
      .eq("id", splitId)

    totalConfirmed += newlyPaid.length

    // Send Telegram notification
    const totalPaidCount = splitData.splits.filter((s) => s.paid).length
    const totalParticipants = splitData.splits.length
    const paidLines = newlyPaid.map(
      (p) => `✅ ${p.handle} paid <b>${p.amount.toFixed(2)} mUSD</b>`
    )

    let message =
      `🎉 <b>Payment detected!</b> — <b>${splitData.merchant}</b>\n\n` +
      `${paidLines.join("\n")}\n\n` +
      `📊 <b>${totalPaidCount}/${totalParticipants}</b> payments confirmed`

    if (totalPaidCount === totalParticipants) {
      message += `\n\n🏆 <b>All payments received!</b> This split is fully settled.`
    }

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: splitData.chat_id,
          text: message,
          parse_mode: "HTML",
        }),
      })
    } catch (err) {
      console.error(`[cron] Failed to notify chat ${splitData.chat_id}:`, err)
    }
  }

  return NextResponse.json({
    checked: rows.length,
    confirmed: totalConfirmed,
  })
}
