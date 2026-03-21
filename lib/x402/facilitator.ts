// ─── x402 Facilitator Client ─────────────────────────────────────────────────
// Calls the BSA facilitator service to verify and settle TON x402 payments.
// Facilitator endpoints:
//   POST /api/facilitator/verify  — offline BOC validation (no blockchain call)
//   POST /api/facilitator/settle  — broadcast to TON + poll for confirmation

import type {
  VerifyRequest,
  VerifyResponse,
  SettleRequest,
  SettlementResponse,
} from "./core"

const FACILITATOR_URL =
  process.env.FACILITATOR_URL ?? "http://localhost:3000/api/facilitator"

// ─── Call Facilitator ─────────────────────────────────────────────────────────

export async function callFacilitator<TReq, TRes>(
  endpoint: "verify" | "settle",
  body: TReq
): Promise<TRes> {
  const url = `${FACILITATOR_URL}/${endpoint}`

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)")
    throw new Error(`Facilitator ${endpoint} failed: ${res.status} ${text}`)
  }

  return res.json() as Promise<TRes>
}

// ─── Verify Payment ───────────────────────────────────────────────────────────

export async function verifyPayment(req: VerifyRequest): Promise<VerifyResponse> {
  return callFacilitator<VerifyRequest, VerifyResponse>("verify", req)
}

// ─── Settle Payment ───────────────────────────────────────────────────────────

export async function settlePayment(req: SettleRequest): Promise<SettlementResponse> {
  return callFacilitator<SettleRequest, SettlementResponse>("settle", req)
}
