// ─── x402 Core Types & Utilities ─────────────────────────────────────────────
// Based on BSA x TON Hackathon template by Stan & Loris (bsaepfl/bsa-sp-template-x402-2026)
// Adapted for SatSplit AI — Next.js App Router

// ─── Network & Asset Types ────────────────────────────────────────────────────

export type TonNetwork = "testnet" | "mainnet"

export interface PaymentAsset {
  type: "TON" | "JETTON"
  address?: string   // Jetton master address (only for JETTON type)
  decimals: number
}

// ─── BSA USD Stablecoin (official hackathon token) ───────────────────────────
export const BSA_USD_TESTNET: PaymentAsset = {
  type: "JETTON",
  address: "kQCd6G7c_HUBkgwtmGzpdqvHIQoNkYOEE0kSWoc5v57hPPnV",
  decimals: 6,
}

export const TON_ASSET: PaymentAsset = {
  type: "TON",
  decimals: 9,
}

// ─── Payment Config ───────────────────────────────────────────────────────────

export interface PaymentConfig {
  amount: string        // in smallest unit (nanotons or atomic jettons)
  asset: PaymentAsset
  description: string
  payTo: string         // receiving wallet address
  network: TonNetwork
  maxTimeoutSeconds?: number
}

// ─── Protocol Types ───────────────────────────────────────────────────────────

export interface PaymentRequired {
  scheme: "exact"
  network: TonNetwork
  maxAmountRequired: string
  resource: string
  description: string
  mimeType: string
  payTo: string
  maxTimeoutSeconds: number
  asset: PaymentAsset
  extra?: Record<string, string>
}

export interface PaymentPayload {
  x402Version: 1
  scheme: "exact"
  network: TonNetwork
  payload: {
    signature: string    // base64-encoded signed BOC
    queryId: string
  }
}

export interface VerifyRequest {
  paymentPayload: PaymentPayload
  paymentRequired: PaymentRequired
}

export interface VerifyResponse {
  isValid: boolean
  invalidReason?: string
}

export interface SettleRequest {
  paymentPayload: PaymentPayload
  paymentRequired: PaymentRequired
}

export interface SettlementResponse {
  success: boolean
  txHash?: string
  errorReason?: string
}

// ─── Header Constants ─────────────────────────────────────────────────────────

export const HEADER_PAYMENT_REQUIRED = "X-Payment-Required"
export const HEADER_PAYMENT_SIGNATURE = "X-Payment"
export const HEADER_PAYMENT_RESPONSE = "X-Payment-Response"

// ─── Encoding / Decoding Utilities ───────────────────────────────────────────

export function encodePaymentRequired(pr: PaymentRequired): string {
  return Buffer.from(JSON.stringify(pr)).toString("base64")
}

export function decodePaymentRequired(encoded: string): PaymentRequired {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as PaymentRequired
}

export function encodePaymentPayload(pp: PaymentPayload): string {
  return Buffer.from(JSON.stringify(pp)).toString("base64")
}

export function decodePaymentPayload(encoded: string): PaymentPayload {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as PaymentPayload
}

export function encodeSettlementResponse(sr: SettlementResponse): string {
  return Buffer.from(JSON.stringify(sr)).toString("base64")
}

export function decodeSettlementResponse(encoded: string): SettlementResponse {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as SettlementResponse
}

// ─── Unit Conversion Utilities ────────────────────────────────────────────────

export const ONE_TON = 1_000_000_000n

export function tonToNano(ton: number): bigint {
  return BigInt(Math.round(ton * 1_000_000_000))
}

export function nanoToTon(nano: bigint): number {
  return Number(nano) / 1_000_000_000
}

export function jettonToAtomic(amount: number, decimals: number): bigint {
  return BigInt(Math.round(amount * 10 ** decimals))
}

export function atomicToJetton(amount: bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals
}

export function generateQueryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ─── PaymentConfig Builder ────────────────────────────────────────────────────

export function getPaymentConfig(opts: {
  amount: string
  asset: PaymentAsset
  description: string
  decimals?: number
}): PaymentConfig {
  return {
    amount: opts.amount,
    asset: opts.asset,
    description: opts.description,
    payTo: process.env.PAYMENT_ADDRESS ?? "",
    network: (process.env.TON_NETWORK as TonNetwork) ?? "testnet",
    maxTimeoutSeconds: 300,
  }
}
