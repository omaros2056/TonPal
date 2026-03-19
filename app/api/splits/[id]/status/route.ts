import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ApiResponse, SplitSession, Participant, PaymentRequest, PaymentReceipt } from "@/types"

type StatusResponse = {
  split: SplitSession
  participants: Participant[]
  paymentRequests: PaymentRequest[]
  receipts: PaymentReceipt[]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<StatusResponse>>> {
  try {
    const { id } = params
    const supabase = await createServerSupabaseClient()

    // Fetch split session
    const { data: sessionRow, error: sessionErr } = await supabase
      .from("split_sessions")
      .select("*")
      .eq("id", id)
      .single()

    if (sessionErr) throw sessionErr
    if (!sessionRow) {
      return NextResponse.json({ success: false, error: "Split not found" }, { status: 404 })
    }

    const split: SplitSession = {
      id: sessionRow.id,
      ownerId: sessionRow.owner_id,
      source: sessionRow.source,
      status: sessionRow.status,
      receiptData: sessionRow.receipt_data ?? undefined,
      createdAt: sessionRow.created_at,
    }

    // Fetch participants
    const { data: participantRows, error: partErr } = await supabase
      .from("participants")
      .select("*")
      .eq("split_session_id", id)

    if (partErr) throw partErr

    const participants: Participant[] = (participantRows ?? []).map((row: any) => ({
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

    // Fetch payment requests
    const { data: prRows, error: prErr } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("split_session_id", id)

    if (prErr) throw prErr

    const paymentRequests: PaymentRequest[] = (prRows ?? []).map((row: any) => ({
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

    // Fetch receipts for all payment requests in this split
    const prIds = paymentRequests.map((pr) => pr.id)
    let receipts: PaymentReceipt[] = []

    if (prIds.length > 0) {
      const { data: receiptRows, error: receiptErr } = await supabase
        .from("payment_receipts")
        .select("*")
        .in("payment_request_id", prIds)

      if (receiptErr) throw receiptErr

      receipts = (receiptRows ?? []).map((row: any) => ({
        id: row.id,
        paymentRequestId: row.payment_request_id,
        txHash: row.tx_hash,
        rail: row.rail,
        paidAt: row.paid_at,
      }))
    }

    return NextResponse.json({
      success: true,
      data: { split, participants, paymentRequests, receipts },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
