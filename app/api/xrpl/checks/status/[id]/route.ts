import { NextRequest, NextResponse } from "next/server"
import { getXummPayloadStatus } from "@/lib/rails/xrpl/xumm"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// GET /api/xrpl/checks/status/:paymentRequestId
// Returns: { status, checkId, txHash?, xummSigned }
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentRequestId } = await params
    if (!paymentRequestId) {
      return NextResponse.json(
        { success: false, error: "Missing paymentRequestId" },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Look up the xrpl_checks record for this payment request
    const { data: xcRow, error: xcError } = await supabase
      .from("xrpl_checks")
      .select("*")
      .eq("payment_request_id", paymentRequestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (xcError || !xcRow) {
      return NextResponse.json(
        { success: false, error: "XRPL check record not found" },
        { status: 404 }
      )
    }

    const uuid: string = xcRow.xumm_payload_uuid
    const { signed, txHash, resolvedAddress, cancelled } = await getXummPayloadStatus(uuid)

    let status: string = xcRow.state // 'created' | 'cashed' | 'cancelled' | 'expired'

    // If cancelled in Xumm and not yet reflected in DB
    if (cancelled && status === "created") {
      status = "cancelled"
      await supabase
        .from("xrpl_checks")
        .update({ state: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", xcRow.id)
      await supabase
        .from("payment_requests")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", paymentRequestId)
    }

    // If Xumm signed and we have a txHash — mark as committed and create receipt
    if (signed && txHash && status === "created") {
      status = "signed"

      // Update xrpl_checks state
      await supabase
        .from("xrpl_checks")
        .update({ state: "cashed", updated_at: new Date().toISOString() })
        .eq("id", xcRow.id)

      // Update payment_request status to 'committed'
      await supabase
        .from("payment_requests")
        .update({ status: "committed", updated_at: new Date().toISOString() })
        .eq("id", paymentRequestId)

      // Insert payment receipt
      await supabase.from("payment_receipts").insert({
        payment_request_id: paymentRequestId,
        tx_hash: txHash,
        rail: "xrpl",
        paid_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        status,
        checkId: xcRow.check_id ?? null,
        txHash: signed ? txHash : null,
        xummSigned: signed,
        xummCancelled: cancelled,
        resolvedAddress,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
