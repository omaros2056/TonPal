// ─── x402 Payment Gate ────────────────────────────────────────────────────────
// Implements the x402 protocol: server returns 402 with payment details,
// client pays (TON micro-payment), retries with X-Payment proof header.

export interface X402PaymentDetails {
  scheme: "exact"
  network: "ton-mainnet" | "ton-testnet"
  maxAmountRequired: string // in nanotons
  resource: string          // the URL being accessed
  description: string
  mimeType: string
  payTo: string             // TON address to pay
  maxTimeoutSeconds: number
  asset: string             // 'TON'
  extra?: Record<string, string>
}

// ─── Build the WWW-Authenticate header value for a 402 response ──────────────
// Format: x402 <base64(JSON of X402PaymentDetails)>
export function buildX402Header(resource: string, amountTon: number): string {
  const tonAddress =
    process.env.X402_TON_ADDRESS ?? "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFp"

  const nanotons = Math.round(amountTon * 1_000_000_000).toString()

  const details: X402PaymentDetails = {
    scheme: "exact",
    network: "ton-testnet",
    maxAmountRequired: nanotons,
    resource,
    description: `Premium AI receipt parsing — ${amountTon} TON`,
    mimeType: "application/json",
    payTo: tonAddress,
    maxTimeoutSeconds: 300,
    asset: "TON",
    extra: {
      amountTon: amountTon.toString(),
      nanotons,
    },
  }

  const encoded = Buffer.from(JSON.stringify(details)).toString("base64")
  return `x402 ${encoded}`
}

// ─── Decode a WWW-Authenticate header back into payment details ───────────────
export function decodeX402Header(header: string): X402PaymentDetails | null {
  try {
    const parts = header.split(" ")
    if (parts.length !== 2 || parts[0] !== "x402") return null
    const json = Buffer.from(parts[1], "base64").toString("utf-8")
    return JSON.parse(json) as X402PaymentDetails
  } catch {
    return null
  }
}

// ─── Verify an X-Payment header from a client ────────────────────────────────
// For the hackathon: simplified verification — checks header is present and
// well-formed. Full on-chain verification is optional.
export function verifyX402Payment(
  xPaymentHeader: string | null,
  resource: string
): { valid: boolean; reason?: string } {
  if (!xPaymentHeader) {
    return { valid: false, reason: "Missing X-Payment header" }
  }

  // Minimal well-formedness check: must be non-empty string
  const trimmed = xPaymentHeader.trim()
  if (trimmed.length === 0) {
    return { valid: false, reason: "X-Payment header is empty" }
  }

  // For hackathon: accept any non-empty X-Payment header as valid proof
  // In production this would verify the TON transaction on-chain
  return { valid: true }
}

// ─── x402 Gate middleware helper ─────────────────────────────────────────────
// Returns null if payment is valid (allow through).
// Returns 402 Response if payment is required.
export function x402Gate(
  request: Request,
  resource: string,
  amountTon: number
): Response | null {
  // If X402_ENABLED is explicitly 'false' → bypass, always allow
  if (process.env.X402_ENABLED !== "true") {
    return null
  }

  const xPaymentHeader = request.headers.get("X-Payment")
  const { valid, reason } = verifyX402Payment(xPaymentHeader, resource)

  if (valid) {
    return null // Payment verified — allow through
  }

  // Return 402 with payment instructions
  const wwwAuthenticate = buildX402Header(resource, amountTon)

  const body = JSON.stringify({
    success: false,
    error: "Payment required",
    reason,
    x402: {
      amountTon,
      resource,
      instructions: `Send ${amountTon} TON to the address in WWW-Authenticate header, then retry with X-Payment header.`,
    },
  })

  return new Response(body, {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": wwwAuthenticate,
    },
  })
}
