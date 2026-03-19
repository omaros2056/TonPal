import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { calculateEqualSplit, calculateItemizedSplit, equalSplit } from "@/lib/split/engine"
import { buildTonPaymentLink, buildSplitComment } from "@/lib/rails/ton/payment-link"
import type { ApiResponse, SplitSession, Participant, PaymentRequest, ReceiptItem } from "@/types"

type CreateSplitBody = {
  ownerId: string
  source: "bot" | "miniapp"
  totalAmount: number
  currency: string
  merchant?: string
  receiptScanId?: string
  receiptItems?: ReceiptItem[]
  participants: Array<{
    displayName: string
    telegramUserId?: string
    tonAddress?: string
    evmAddress?: string
    xrpAddress?: string
    ensName?: string
    satsplitSubname?: string
    handle?: string
    avatarUrl?: string
  }>
  splitMode: "equal" | "itemized"
  // For itemized: { participantId: [itemName, ...] } — populated after participant creation
  // For itemized via index: array assignments handled separately
  itemAssignments?: Record<string, string[]>
}

type CreateSplitResponse = {
  split: SplitSession
  participants: Participant[]
  paymentRequests: PaymentRequest[]
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<CreateSplitResponse>>> {
  try {
    const body: CreateSplitBody = await req.json()

    const { ownerId, source, totalAmount, currency, merchant, participants, splitMode } = body

    if (!ownerId || !source) {
      return NextResponse.json(
        { success: false, error: "ownerId and source are required" },
        { status: 400 }
      )
    }
    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "totalAmount must be a positive number" },
        { status: 400 }
      )
    }
    if (!participants || participants.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one participant is required" },
        { status: 400 }
      )
    }
    if (!["equal", "itemized"].includes(splitMode)) {
      return NextResponse.json(
        { success: false, error: "splitMode must be 'equal' or 'itemized'" },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // 1. Create split session
    const receiptData = merchant || body.receiptScanId || body.receiptItems
      ? {
          merchant: merchant ?? "",
          currency: currency ?? "EUR",
          total: totalAmount,
          items: body.receiptItems ?? [],
        }
      : undefined

    const { data: sessionRow, error: sessionErr } = await supabase
      .from("split_sessions")
      .insert({
        owner_id: ownerId,
        source,
        status: "active",
        receipt_data: receiptData ?? null,
      })
      .select()
      .single()

    if (sessionErr) throw sessionErr

    const split: SplitSession = {
      id: sessionRow.id,
      ownerId: sessionRow.owner_id,
      source: sessionRow.source,
      status: sessionRow.status,
      receiptData: sessionRow.receipt_data ?? undefined,
      createdAt: sessionRow.created_at,
    }

    // 2. Create participants
    const participantInserts = participants.map((p) => ({
      split_session_id: split.id,
      display_name: p.displayName,
      telegram_user_id: p.telegramUserId ?? null,
      ton_address: p.tonAddress ?? null,
      evm_address: p.evmAddress ?? null,
      xrp_address: p.xrpAddress ?? null,
      ens_name: p.ensName ?? null,
      satsplit_subname: p.satsplitSubname ?? null,
      handle: p.handle ?? null,
      avatar_url: p.avatarUrl ?? null,
    }))

    const { data: participantRows, error: partErr } = await supabase
      .from("participants")
      .insert(participantInserts)
      .select()

    if (partErr) throw partErr

    const createdParticipants: Participant[] = participantRows.map((row: any) => ({
      id: row.id,
      splitSessionId: row.split_session_id,
      telegramUserId: row.telegram_user_id ?? undefined,
      displayName: row.display_name,
      ensName: row.ens_name ?? undefined,
      satsplitSubname: row.satsplit_subname ?? undefined,
      handle: row.handle ?? undefined,
      tonAddress: row.ton_address ?? undefined,
      evmAddress: row.evm_address ?? undefined,
      xrpAddress: row.xrp_address ?? undefined,
      avatarUrl: row.avatar_url ?? undefined,
    }))

    // 3. Calculate amounts per participant
    let amountMap: Record<string, number> = {}

    if (splitMode === "equal") {
      const amounts = equalSplit(totalAmount, createdParticipants.length)
      createdParticipants.forEach((p, i) => {
        amountMap[p.id] = amounts[i]
      })
    } else {
      // itemized — requires itemAssignments keyed by participantId
      const assignments = body.itemAssignments ?? {}
      const items = body.receiptItems ?? []
      if (items.length > 0 && Object.keys(assignments).length > 0) {
        amountMap = calculateItemizedSplit(items, assignments)
      } else {
        // Fallback to equal split if no itemized data provided
        const amounts = equalSplit(totalAmount, createdParticipants.length)
        createdParticipants.forEach((p, i) => {
          amountMap[p.id] = amounts[i]
        })
      }
    }

    // 4. Build payment requests for participants with a TON address
    const receiverAddress = process.env.TON_RECEIVER_ADDRESS ?? ""
    const paymentRequestInserts: any[] = []

    for (const participant of createdParticipants) {
      const amount = amountMap[participant.id] ?? 0
      if (amount <= 0) continue

      const hasTonAddress = Boolean(participant.tonAddress || receiverAddress)
      if (!hasTonAddress) continue

      const toAddress = receiverAddress || participant.tonAddress!
      const comment = buildSplitComment(split.id, participant.id)
      // Placeholder: 1 TON ≈ 5 EUR/USD for demo — real conversion would use an oracle
      const amountTon = amount / 5

      const paymentLink = buildTonPaymentLink({
        toAddress,
        amountTon,
        comment,
      })

      paymentRequestInserts.push({
        split_session_id: split.id,
        participant_id: participant.id,
        amount,
        amount_native: amountTon,
        status: "pending",
        payment_link: paymentLink,
        rail: "ton",
      })
    }

    let createdPaymentRequests: PaymentRequest[] = []

    if (paymentRequestInserts.length > 0) {
      const { data: prRows, error: prErr } = await supabase
        .from("payment_requests")
        .insert(paymentRequestInserts)
        .select()

      if (prErr) throw prErr

      createdPaymentRequests = prRows.map((row: any) => ({
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
    }

    return NextResponse.json({
      success: true,
      data: {
        split,
        participants: createdParticipants,
        paymentRequests: createdPaymentRequests,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
