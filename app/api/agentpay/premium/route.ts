// ─── POST /api/agentpay/premium ───────────────────────────────────────────────
// AgentPay demo endpoint demonstrating AI agent autonomous x402 payment.
// - No payment header → returns 402 with payment details
// - Valid X-Payment header → returns premium AI analysis with confidence scores,
//   suggested tips, and currency conversion

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseReceipt } from "@/lib/ai/parse"
import { x402Gate } from "@/lib/x402/gate"
import type { ApiResponse, ReceiptScan } from "@/types"

// ─── CORS headers ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Payment",
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// ─── Request schema ───────────────────────────────────────────────────────────

const requestSchema = z
  .object({
    imageBase64: z.string().optional(),
    imageUrl: z.string().url().optional(),
    text: z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(data.imageBase64) || Boolean(data.imageUrl) || Boolean(data.text),
    { message: "At least one of imageBase64, imageUrl, or text must be provided." }
  )

// ─── Premium analysis response type ──────────────────────────────────────────

interface PremiumAnalysis {
  receipt: ReceiptScan
  confidenceScores: {
    overall: number
    perItem: Array<{ name: string; confidence: number }>
  }
  suggestedTips: {
    "10%": number
    "15%": number
    "20%": number
  }
  currencyConversions: {
    EUR?: number
    USD?: number
    GBP?: number
  }
  agentPayMeta: {
    paidWith: "x402"
    network: string
    amountTon: number
    parsedAt: string
  }
}

// ─── Approximate exchange rates (demo — in production use a live FX API) ─────

const FX_RATES: Record<string, Record<string, number>> = {
  EUR: { USD: 1.09, GBP: 0.86 },
  USD: { EUR: 0.92, GBP: 0.79 },
  GBP: { EUR: 1.16, USD: 1.27 },
  CHF: { EUR: 1.05, USD: 1.15, GBP: 0.90 },
}

function convertCurrency(
  amount: number,
  from: string
): Record<string, number> {
  const rates = FX_RATES[from.toUpperCase()]
  if (!rates) return {}
  return Object.fromEntries(
    Object.entries(rates).map(([to, rate]) => [to, Math.round(amount * rate * 100) / 100])
  )
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<PremiumAnalysis>>> {
  // ── x402 gate ─────────────────────────────────────────────────────────────
  const gateResponse = x402Gate(req, "/api/agentpay/premium", 0.01)
  if (gateResponse !== null) {
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

  // ── Parse body ────────────────────────────────────────────────────────────
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

  // ── Run premium AI parsing ─────────────────────────────────────────────
  let receipt: ReceiptScan
  try {
    receipt = await parseReceipt({ imageBase64, imageUrl, text, premium: true })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unexpected error during parsing."
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: CORS_HEADERS }
    )
  }

  // ── Build premium analysis ─────────────────────────────────────────────
  // Confidence scores: mock values based on item data completeness
  const perItemScores = receipt.items.map((item) => ({
    name: item.name,
    confidence:
      item.name.length > 3 && item.totalPrice > 0
        ? Math.round((0.85 + Math.random() * 0.14) * 100) / 100
        : Math.round((0.6 + Math.random() * 0.2) * 100) / 100,
  }))

  const overallConfidence =
    perItemScores.length > 0
      ? Math.round(
          (perItemScores.reduce((sum, s) => sum + s.confidence, 0) /
            perItemScores.length) *
            100
        ) / 100
      : 0.8

  // Suggested tips based on total
  const total = receipt.total
  const suggestedTips = {
    "10%": Math.round(total * 0.1 * 100) / 100,
    "15%": Math.round(total * 0.15 * 100) / 100,
    "20%": Math.round(total * 0.2 * 100) / 100,
  }

  // Currency conversions
  const currencyConversions = convertCurrency(total, receipt.currency)

  const analysis: PremiumAnalysis = {
    receipt,
    confidenceScores: {
      overall: overallConfidence,
      perItem: perItemScores,
    },
    suggestedTips,
    currencyConversions,
    agentPayMeta: {
      paidWith: "x402",
      network: "ton-testnet",
      amountTon: 0.01,
      parsedAt: new Date().toISOString(),
    },
  }

  return NextResponse.json(
    { success: true, data: analysis },
    { status: 200, headers: CORS_HEADERS }
  )
}
