import { NextRequest, NextResponse } from "next/server"
import { handleWebhook } from "@/lib/telegram/bot"

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    return await handleWebhook(req)
  } catch (e: any) {
    console.error("Telegram webhook error:", e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
