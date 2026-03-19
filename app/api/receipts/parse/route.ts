import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseReceipt } from "@/lib/ai/parse"
import type { ApiResponse, ReceiptScan } from "@/types"

// ─── CORS headers for Telegram Mini App cross-origin requests ────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// ─── Request body schema ─────────────────────────────────────────────────────

const requestSchema = z
  .object({
    imageBase64: z.string().optional(),
    imageUrl: z.string().url().optional(),
    text: z.string().optional(),
    premium: z.boolean().optional(),
  })
  .refine(
    (data) =>
      Boolean(data.imageBase64) || Boolean(data.imageUrl) || Boolean(data.text),
    {
      message: "At least one of imageBase64, imageUrl, or text must be provided.",
    }
  )

// ─── POST /api/receipts/parse ─────────────────────────────────────────────────

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<ReceiptScan>>> {
  // Parse + validate body
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const parsed = requestSchema.safeParse(rawBody)
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join("; ")
    return NextResponse.json(
      { success: false, error: message },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const { imageBase64, imageUrl, text, premium } = parsed.data

  try {
    const scan = await parseReceipt({ imageBase64, imageUrl, text, premium })
    return NextResponse.json(
      { success: true, data: scan },
      { status: 200, headers: CORS_HEADERS }
    )
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unexpected error during parsing."
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
