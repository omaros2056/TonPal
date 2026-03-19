import { NextRequest, NextResponse } from "next/server"
import { buildCheckCash } from "@/lib/rails/xrpl/checks"
import { createXummSignRequest } from "@/lib/rails/xrpl/xumm"

// POST /api/xrpl/checks/cash
// Body: { checkId, amountXrp }
// Returns: { xummQrUrl, xummDeeplink, xummWebUrl, xummUuid }
//
// This creates a Xumm sign request for the organizer to cash a committed check.
export async function POST(req: NextRequest) {
  if (process.env.XRPL_ENABLED === "false") {
    return NextResponse.json({ success: false, error: "XRPL not enabled" }, { status: 503 })
  }

  try {
    const body = await req.json()
    const { checkId, amountXrp } = body

    if (!checkId || !amountXrp) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: checkId, amountXrp" },
        { status: 400 }
      )
    }

    const organizerAddress = process.env.XRPL_ORGANIZER_ADDRESS
    if (!organizerAddress) {
      return NextResponse.json(
        { success: false, error: "XRPL_ORGANIZER_ADDRESS env var not set" },
        { status: 500 }
      )
    }

    const txJson = buildCheckCash({
      organizerAddress,
      checkId,
      amountXrp: Number(amountXrp),
    })

    const returnUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/split/xrpl-cash-callback`
      : undefined

    const { uuid, qrUrl, deeplink, webUrl, expiration } = await createXummSignRequest({
      transaction: txJson,
      participantName: "Organizer",
      returnUrl,
    })

    return NextResponse.json({
      success: true,
      data: {
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
