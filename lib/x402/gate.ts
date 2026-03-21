// ─── x402 Gate (compatibility shim) ──────────────────────────────────────────
// Re-exports from BSA-aligned middleware and core modules.
// BSA x TON Hackathon template: bsaepfl/bsa-sp-template-x402-2026

export { paymentGate, paymentGate as x402Gate } from "./middleware"

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
