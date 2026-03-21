import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { buildTonPaymentLink, buildSplitComment, tonToNano } from "@/lib/rails/ton/payment-link"
import { equalSplit } from "@/lib/split/engine"
import type { ApiResponse, Participant, PaymentRequest } from "@/types"

type ParticipantInput = {
  displayName: string
  tonAddress?: string
  ensName?: string
  handle?: string
  xrpAddress?: string
}

type AddParticipantsResponse = {
  participants: Participant[]
  paymentRequests: PaymentRequest[]
}

/**
 * POST /api/splits/:id/participants
 *
 * Body: { participants: ParticipantInput[] }
 *
 * - Adds participants to an existing split
 * - Calculates equal share of the split total
 * - Creates payment requests for each new participant
 * - Returns updated participants + payment requests
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<AddParticipantsResponse>>> {
  try {
    const { id: splitId } = await params
    const body = await req.json()
    const inputs: ParticipantInput[] = body.participants ?? []

    if (!inputs.length) {
      return NextResponse.json(
        { success: false, error: "No participants provided" },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // 1. Fetch the split session to get total amount
    const { data: sessionRow, error: sessionErr } = await supabase
      .from("split_sessions")
      .select("*")
      .eq("id", splitId)
      .single()

    if (sessionErr) throw sessionErr
    if (!sessionRow) {
      return NextResponse.json(
        { success: false, error: "Split session not found" },
        { status: 404 }
      )
    }

    // Determine total — prefer receipt_data.total, fall back to 0
    const total: number = sessionRow.receipt_data?.total ?? 0

    // 2. Fetch existing participants to compute correct equal share
    const { data: existingRows, error: existErr } = await supabase
      .from("participants")
      .select("id")
      .eq("split_session_id", splitId)

    if (existErr) throw existErr
    const existingCount = existingRows?.length ?? 0
    const newTotal = existingCount + inputs.length

    // Calculate per-person shares using the split engine
    // equalSplit returns an array of amounts (first element absorbs rounding remainder)
    const allShares = total > 0 ? equalSplit(total, newTotal) : Array(newTotal).fill(0)
    // New participants get the base share (last element is unaffected by remainder)
    const baseShare: number = allShares[allShares.length - 1]
    // First new participant may absorb rounding if they are actually the "first" overall
    // We assign the remainder-adjusted first share to new participants index 0 if there
    // are no existing participants; otherwise everyone gets baseShare.
    const getShare = (index: number): number => {
      if (existingCount === 0 && index === 0) {
        return allShares[0]
      }
      return baseShare
    }

    // Receiver address for TON payment links
    const receiverAddress = process.env.TON_RECEIVER_ADDRESS ?? ""

    // 3. Insert participants + create payment requests
    const insertedParticipants: Participant[] = []
    const insertedRequests: PaymentRequest[] = []

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]
      const share = getShare(i)

      // Insert participant
      const { data: partRow, error: partErr } = await supabase
        .from("participants")
        .insert({
          split_session_id: splitId,
          display_name: input.displayName,
          ton_address: input.tonAddress ?? null,
          ens_name: input.ensName ?? null,
          handle: input.handle ?? null,
          xrp_address: input.xrpAddress ?? null,
        })
        .select()
        .single()

      if (partErr) throw partErr

      const participant: Participant = {
        id: partRow.id,
        splitSessionId: partRow.split_session_id,
        displayName: partRow.display_name,
        tonAddress: partRow.ton_address ?? undefined,
        ensName: partRow.ens_name ?? undefined,
        handle: partRow.handle ?? undefined,
        xrpAddress: partRow.xrp_address ?? undefined,
      }
      insertedParticipants.push(participant)

      // Build payment request for TON rail (if receiver address is available)
      if (receiverAddress) {
        const comment = buildSplitComment(splitId, partRow.id)

        // Estimate TON amount — use a placeholder rate if not specified.
        // The actual rate conversion (fiat → TON) is left to the caller or a future task.
        // We store amount_native = null when rate is unknown.
        const paymentLink = buildTonPaymentLink({
          toAddress: receiverAddress,
          amountTon: 0, // placeholder — real conversion handled separately
          comment,
        })

        const { data: prRow, error: prErr } = await supabase
          .from("payment_requests")
          .insert({
            split_session_id: splitId,
            participant_id: partRow.id,
            amount: share,
            amount_native: null,
            status: "pending",
            payment_link: paymentLink,
            rail: "ton",
          })
          .select()
          .single()

        if (prErr) throw prErr

        const paymentRequest: PaymentRequest = {
          id: prRow.id,
          splitSessionId: prRow.split_session_id,
          participantId: prRow.participant_id,
          amount: Number(prRow.amount),
          amountNative: prRow.amount_native != null ? Number(prRow.amount_native) : undefined,
          status: prRow.status,
          paymentLink: prRow.payment_link,
          rail: prRow.rail,
        }
        insertedRequests.push(paymentRequest)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        participants: insertedParticipants,
        paymentRequests: insertedRequests,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message ?? "Internal server error" },
      { status: 500 }
    )
  }
}
