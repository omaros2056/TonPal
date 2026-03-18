import { NextRequest, NextResponse } from "next/server"
import { createSubname, deriveSubname } from "@/lib/ens/subnames"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { displayName, evmAddress, tonAddress, telegramHandle } = body

    if (!displayName || !evmAddress) {
      return NextResponse.json({ success: false, error: "displayName and evmAddress required" }, { status: 400 })
    }

    const name = deriveSubname(displayName)
    const textRecords: Record<string, string> = {}
    if (tonAddress) textRecords["app.satsplit.ton-address"] = tonAddress
    if (telegramHandle) textRecords["app.satsplit.telegram"] = telegramHandle

    await createSubname({ name, address: evmAddress, textRecords })

    const parent = process.env.ENS_PARENT_NAME ?? "satsplit.eth"
    return NextResponse.json({
      success: true,
      data: { subname: `${name}.${parent}` },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
