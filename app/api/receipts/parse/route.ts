import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseReceipt } from "@/lib/ai/parse"
import { x402Gate } from "@/lib/x402/gate"
import type { ApiResponse, ReceiptScan } from "@/types"

// ─── CORS headers for Telegram Mini App cross-origin requests ────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Payment",
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
// Free tier: max 5 items, basic model chain
// Premium tier (?premium=true): full parsing, no item limit, multi-currency
//   — gated by x402 micro-payment when X402_ENABLED=true

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<ReceiptScan>>> {
  // Determine premium intent from query param
  const isPremiumRequest = req.nextUrl.searchParams.get("premium") === "true"

  // ── x402 gate: only for premium requests ─────────────────────────────────
  if (isPremiumRequest) {
    const gateResponse = x402Gate(req, "/api/receipts/parse", 0.01)
    if (gateResponse !== null) {
      // 402 Payment Required — add CORS headers and return
      const body = await gateResponse.text()
      return new NextResponse(body, {
        status: gateResponse.status,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "WWW-Authenticate": gateResponse.headers.get("WWW-Authenticate") ?? "",
        },
      })
    }
  }

  // ── Parse + validate body ────────────────────────────────────────────────
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

  const { imageBase64, imageUrl, text } = parsed.data

  // Pass premium flag to parseReceipt — unlocks better model + no item cap
  const premiumUnlocked = isPremiumRequest

  try {
    const scan = await parseReceipt({
      imageBase64,
      imageUrl,
      text,
      premium: premiumUnlocked,
    })

    // Free tier: truncate items to 5 to encourage premium upgrade
    if (!premiumUnlocked && scan.items.length > 5) {
      scan.items = scan.items.slice(0, 5)
    }

    return NextResponse.json(
      {
        success: true,
        data: scan,
        ...(premiumUnlocked ? { tier: "premium" } : { tier: "free", itemsCapped: scan.items.length >= 5 }),
      },
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
