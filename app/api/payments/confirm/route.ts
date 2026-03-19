import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { pollSplitPayments } from "@/lib/rails/ton/poller"
import type { ApiResponse } from "@/types"

type ConfirmResponse = {
  confirmed: string[]
  total: number
}

/**
 * POST /api/payments/confirm
 *
 * Two modes:
 *  - Manual: { paymentRequestId, txHash, rail, splitSessionId } — directly mark as paid
 *  - Poll:   { splitSessionId, rail: 'ton' }                    — run poller and return results
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<ConfirmResponse>>> {
  try {
    const body = await req.json()
    const {
      splitSessionId,
      paymentRequestId,
      txHash,
      rail,
    }: {
      splitSessionId: string
      paymentRequestId?: string
      txHash?: string
      rail: "ton" | "xrpl"
    } = body

    if (!splitSessionId) {
      return NextResponse.json(
        { success: false, error: "splitSessionId is required" },
        { status: 400 }
      )
    }

    // ── Manual mode ────────────────────────────────────────────────────────
    if (paymentRequestId && txHash) {
      const supabase = await createServerSupabaseClient()

      // Update payment_requests status to 'confirmed'
      const { error: updateErr } = await supabase
        .from("payment_requests")
        .update({ status: "confirmed" })
        .eq("id", paymentRequestId)

      if (updateErr) {
        return NextResponse.json(
          { success: false, error: updateErr.message },
          { status: 500 }
        )
      }

      // Insert payment receipt
      const { error: insertErr } = await supabase
        .from("payment_receipts")
        .insert({
          payment_request_id: paymentRequestId,
          tx_hash: txHash,
          rail,
          paid_at: new Date().toISOString(),
        })

      if (insertErr) {
        return NextResponse.json(
          { success: false, error: insertErr.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: { confirmed: [paymentRequestId], total: 1 },
      })
    }

    // ── Poll mode ──────────────────────────────────────────────────────────
    if (rail !== "ton") {
      return NextResponse.json(
        { success: false, error: "Polling is only supported for rail=ton" },
        { status: 400 }
      )
    }

    const { confirmed, errors } = await pollSplitPayments(splitSessionId)

    if (errors.length > 0 && confirmed.length === 0) {
      return NextResponse.json(
        { success: false, error: errors.join("; ") },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        confirmed: confirmed.map((c) => c.paymentRequestId),
        total: confirmed.length,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message ?? "Internal server error" },
      { status: 500 }
    )
  }
}
