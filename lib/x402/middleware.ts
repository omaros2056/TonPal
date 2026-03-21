// ─── x402 Payment Gate Middleware ─────────────────────────────────────────────
// Wraps Next.js App Router route handlers with BSA x402 payment verification.
// Pattern matches BSA's paymentGate from bsa-sp-template-x402-2026.
//
// Usage:
//   export const GET = paymentGate(handler, {
//     config: getPaymentConfig({ amount: "10000", asset: BSA_USD_TESTNET, description: "..." })
//   })

import { NextRequest, NextResponse } from "next/server"
import {
  type PaymentConfig,
  type PaymentRequired,
  type PaymentPayload,
  HEADER_PAYMENT_REQUIRED,
  HEADER_PAYMENT_SIGNATURE,
  HEADER_PAYMENT_RESPONSE,
  encodePaymentRequired,
  decodePaymentPayload,
  encodeSettlementResponse,
} from "./core"
import { verifyPayment, settlePayment } from "./facilitator"

type RouteHandler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse>

interface PaymentGateOptions {
  config: PaymentConfig
}

// ─── Build PaymentRequired from config ───────────────────────────────────────

function buildPaymentRequired(req: NextRequest, config: PaymentConfig): PaymentRequired {
  return {
    scheme: "exact",
    network: config.network,
    maxAmountRequired: config.amount,
    resource: req.nextUrl.pathname,
    description: config.description,
    mimeType: "application/json",
    payTo: config.payTo,
    maxTimeoutSeconds: config.maxTimeoutSeconds ?? 300,
    asset: config.asset,
  }
}

// ─── paymentGate ─────────────────────────────────────────────────────────────

export function paymentGate(
  handler: RouteHandler,
  { config }: PaymentGateOptions
): RouteHandler {
  return async (req: NextRequest, ctx?: unknown): Promise<NextResponse> => {
    // Feature flag — bypass gate entirely if x402 is disabled
    if (process.env.X402_ENABLED !== "true") {
      return handler(req, ctx)
    }

    const paymentRequired = buildPaymentRequired(req, config)
    const signatureHeader = req.headers.get(HEADER_PAYMENT_SIGNATURE)

    // ── No payment header → return 402 ──────────────────────────────────────
    if (!signatureHeader) {
      const encoded = encodePaymentRequired(paymentRequired)
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Payment required",
          x402: { description: config.description, amount: config.amount, asset: config.asset },
        }),
        {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            [HEADER_PAYMENT_REQUIRED]: encoded,
          },
        }
      )
    }

    // ── Decode payment payload ───────────────────────────────────────────────
    let paymentPayload: PaymentPayload
    try {
      paymentPayload = decodePaymentPayload(signatureHeader)
    } catch {
      return new NextResponse(
        JSON.stringify({ success: false, error: "Malformed payment signature header" }),
        {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            [HEADER_PAYMENT_REQUIRED]: encodePaymentRequired(paymentRequired),
          },
        }
      )
    }

    // ── Verify via facilitator ───────────────────────────────────────────────
    let verifyResult: Awaited<ReturnType<typeof verifyPayment>>
    try {
      verifyResult = await verifyPayment({ paymentPayload, paymentRequired })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Facilitator verify failed"
      return new NextResponse(
        JSON.stringify({ success: false, error: message }),
        {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            [HEADER_PAYMENT_REQUIRED]: encodePaymentRequired(paymentRequired),
          },
        }
      )
    }

    if (!verifyResult.isValid) {
      return new NextResponse(
        JSON.stringify({ success: false, error: verifyResult.invalidReason ?? "Invalid payment" }),
        {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            [HEADER_PAYMENT_REQUIRED]: encodePaymentRequired(paymentRequired),
          },
        }
      )
    }

    // ── Settle via facilitator ───────────────────────────────────────────────
    let settlementResult: Awaited<ReturnType<typeof settlePayment>>
    try {
      settlementResult = await settlePayment({ paymentPayload, paymentRequired })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Facilitator settle failed"
      return new NextResponse(
        JSON.stringify({ success: false, error: message }),
        {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            [HEADER_PAYMENT_REQUIRED]: encodePaymentRequired(paymentRequired),
          },
        }
      )
    }

    if (!settlementResult.success) {
      return new NextResponse(
        JSON.stringify({ success: false, error: settlementResult.errorReason ?? "Settlement failed" }),
        {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            [HEADER_PAYMENT_REQUIRED]: encodePaymentRequired(paymentRequired),
          },
        }
      )
    }

    // ── Payment confirmed — run the actual handler ────────────────────────────
    const response = await handler(req, ctx)

    // Attach settlement proof to response headers
    response.headers.set(
      HEADER_PAYMENT_RESPONSE,
      encodeSettlementResponse(settlementResult)
    )

    return response
  }
}
