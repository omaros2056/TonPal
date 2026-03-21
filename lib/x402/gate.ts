// ─── x402 Gate (compatibility shim) ──────────────────────────────────────────
// Re-exports from BSA-aligned middleware and core modules.
// BSA x TON Hackathon template: bsaepfl/bsa-sp-template-x402-2026

import { NextRequest, NextResponse } from "next/server"
import { HEADER_PAYMENT_REQUIRED, HEADER_PAYMENT_SIGNATURE, encodePaymentRequired, TON_ASSET } from "./core"

/**
 * Inline gate for use inside route handlers.
 * Returns a 402 NextResponse if payment is required, or null if the request may proceed.
 *
 * Usage:
 *   const gate = x402Gate(req, "/api/route", 0.01)
 *   if (gate !== null) return gate
 */
export function x402Gate(
  req: NextRequest,
  _path: string,
  _amountTon: number
): NextResponse | null {
  if (process.env.X402_ENABLED !== "true") return null
  if (req.headers.get(HEADER_PAYMENT_SIGNATURE)) return null
  const paymentRequired = encodePaymentRequired({
    scheme: "exact",
    network: process.env.XRPL_NETWORK === "mainnet" ? "mainnet" : "testnet",
    maxAmountRequired: String(Math.round(_amountTon * 1e9)),
    resource: _path,
    description: "Premium AI receipt parsing",
    mimeType: "application/json",
    payTo: process.env.PAYMENT_ADDRESS ?? "",
    maxTimeoutSeconds: 300,
    asset: TON_ASSET,
  })
  return new NextResponse(
    JSON.stringify({ success: false, error: "Payment required" }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        [HEADER_PAYMENT_REQUIRED]: paymentRequired,
      },
    }
  )
}

export { paymentGate } from "./middleware"

export {
  getPaymentConfig,
  BSA_USD_TESTNET,
  TON_ASSET,
  tonToNano,
  nanoToTon,
  jettonToAtomic,
  atomicToJetton,
  generateQueryId,
  HEADER_PAYMENT_REQUIRED,
  HEADER_PAYMENT_SIGNATURE,
  HEADER_PAYMENT_RESPONSE,
  encodePaymentRequired,
  decodePaymentRequired,
  encodePaymentPayload,
  decodePaymentPayload,
  encodeSettlementResponse,
  decodeSettlementResponse,
} from "./core"
