import { NextRequest, NextResponse } from "next/server"
import { buildCheckCreate } from "@/lib/rails/xrpl/checks"
import { createXummPayload } from "@/lib/rails/xrpl/xumm"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  if (process.env.XRPL_ENABLED === "false") {
    return NextResponse.json({ success: false, error: "XRPL not enabled" }, { status: 503 })
  }

  try {
    const body = await req.json()
    const { splitSessionId, participantId, participantXrpAddress, xrpAmount } = body

    const organizerXrpAddress = process.env.XRPL_ORGANIZER_ADDRESS!
    const invoiceId = `${splitSessionId}-${participantId}`.replace(/-/g, "").slice(0, 32)

    const txJson = buildCheckCreate({
      participantXrpAddress,
      organizerXrpAddress,
      xrpAmount,
      invoiceId,
    })

    const { uuid, qrUrl, deeplink } = await createXummPayload(txJson)

    const supabase = await createClient()
    await supabase.from("xrpl_checks").insert({
      split_session_id: splitSessionId,
      participant_id: participantId,
      xrp_amount: xrpAmount,
      state: "created",
      xumm_payload_uuid: uuid,
      xumm_qr_url: qrUrl,
      xumm_deeplink: deeplink,
    })

    return NextResponse.json({ success: true, data: { uuid, qrUrl, deeplink } })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
