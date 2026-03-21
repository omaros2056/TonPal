import { NextRequest, NextResponse } from "next/server"
import { handleWebhook } from "@/lib/telegram/bot"

// Extend timeout to 60s — Gemini vision + image download can take 15-30s
export const maxDuration = 60

// Always return 200 to Telegram — even on error — to prevent retry storms.
// grammy's webhookCallback handles both `message` and `callback_query` update
// types transparently; no special routing is needed here.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    return (await handleWebhook(req)) as NextResponse
  } catch (err) {
    console.error("[webhook] Unhandled error:", err)
    // Return 200 so Telegram does not keep retrying
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}
