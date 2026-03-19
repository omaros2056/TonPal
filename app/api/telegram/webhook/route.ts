import { NextRequest, NextResponse } from "next/server"
import { handleWebhook } from "@/lib/telegram/bot"

// Always return 200 to Telegram — even on error — to prevent retry storms
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    return await handleWebhook(req) as NextResponse
  } catch (err) {
    console.error("[webhook] Unhandled error:", err)
    // Return 200 so Telegram does not keep retrying
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}
