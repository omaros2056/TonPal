import { NextRequest, NextResponse } from "next/server"
import { buildCheckCreate } from "@/lib/rails/xrpl/checks"
import { createXummSignRequest } from "@/lib/rails/xrpl/xumm"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// POST /api/xrpl/checks/create
// Body: { splitSessionId, participantId, participantXrpAddress, amountXrp, participantName }
// Returns: { paymentRequestId, xummQrUrl, xummDeeplink, xummWebUrl, xummUuid }
export async function POST(req: NextRequest) {
  if (process.env.XRPL_ENABLED === "false") {
    return NextResponse.json({ success: false, error: "XRPL not enabled" }, { status: 503 })
  }

  try {
    const body = await req.json()
    const {
      splitSessionId,
      participantId,
      participantXrpAddress,
      amountXrp,
      participantName = "Participant",
    } = body

    if (!splitSessionId || !participantId || !participantXrpAddress || !amountXrp) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: splitSessionId, participantId, participantXrpAddress, amountXrp" },
        { status: 400 }
      )
    }

    const organizerXrpAddress = process.env.XRPL_ORGANIZER_ADDRESS
    if (!organizerXrpAddress) {
      return NextResponse.json(
        { success: false, error: "XRPL_ORGANIZER_ADDRESS env var not set" },
        { status: 500 }
      )
    }

    // Build invoice ID from session + participant (stripped UUIDs, 32 chars max)
    const invoiceId = `${splitSessionId}-${participantId}`.replace(/-/g, "").slice(0, 32)

    const txJson = buildCheckCreate({
      senderAddress: participantXrpAddress,
      destinationAddress: organizerXrpAddress,
      amountXrp: Number(amountXrp),
      expireAfterDays: 7,
      invoiceId,
    })

    const returnUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/split/xrpl-callback`
      : undefined

    const { uuid, qrUrl, deeplink, webUrl, expiration } = await createXummSignRequest({
      transaction: txJson,
      participantName,
      returnUrl,
    })

    const supabase = await createServerSupabaseClient()

    // Upsert payment_request record
    const { data: prData, error: prError } = await supabase
      .from("payment_requests")
      .insert({
        split_session_id: splitSessionId,
        participant_id: participantId,
        amount: 0,                            // fiat amount — caller should pass; default 0
        amount_native: Number(amountXrp),
        status: "pending",
        payment_link: deeplink,
        rail: "xrpl",
      })
      .select("id")
      .single()

    if (prError || !prData) {
      throw new Error(`Failed to create payment_request: ${prError?.message}`)
    }

    const paymentRequestId = prData.id

    // Insert xrpl_checks record
    const { error: xcError } = await supabase.from("xrpl_checks").insert({
      split_session_id: splitSessionId,
      participant_id: participantId,
      payment_request_id: paymentRequestId,
      xrp_amount: amountXrp.toString(),
      state: "created",
      xumm_payload_uuid: uuid,
      xumm_qr_url: qrUrl,
      xumm_deeplink: deeplink,
    })

    if (xcError) {
      throw new Error(`Failed to create xrpl_checks record: ${xcError.message}`)
    }

    return NextResponse.json({
      success: true,
      data: {
        paymentRequestId,
        xummQrUrl: qrUrl,
        xummDeeplink: deeplink,
        xummWebUrl: webUrl,
        xummUuid: uuid,
        expiration,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
