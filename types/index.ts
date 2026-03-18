// ─── Frozen shared types ──────────────────────────────────────────────────────
// DO NOT change these types without updating all consumers (API routes, DB, components)

export type ReceiptItem = {
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export type ReceiptScan = {
  merchant: string
  currency: string
  total: number
  tax?: number
  items: ReceiptItem[]
  rawImageUrl?: string
}

export type SplitSession = {
  id: string
  ownerId: string
  source: "bot" | "miniapp"
  status: "draft" | "active" | "settled" | "cancelled"
  receiptData?: ReceiptScan
  createdAt: string
}

export type Participant = {
  id: string
  splitSessionId: string
  telegramUserId?: string
  displayName: string
  ensName?: string          // e.g. alice.eth
  satsplitSubname?: string  // e.g. alice.satsplit.eth
  handle?: string           // plain @handle
  tonAddress?: string       // UQ...
  evmAddress?: string       // 0x...
  xrpAddress?: string       // r...
  avatarUrl?: string
}

export type PaymentRail = "ton" | "xrpl"

export type PaymentStatus = "pending" | "committed" | "confirmed" | "overdue" | "cancelled"

export type PaymentRequest = {
  id: string
  splitSessionId: string
  participantId: string
  amount: number            // fiat amount (EUR/USD)
  amountNative?: number     // TON or XRP amount
  status: PaymentStatus
  paymentLink: string       // TON deeplink or Xumm link
  rail: PaymentRail
  xrplCheckId?: string      // XRPL check object ID
}

export type PaymentReceipt = {
  id: string
  paymentRequestId: string
  txHash: string
  rail: PaymentRail
  paidAt: string
}

// ─── API response types ───────────────────────────────────────────────────────

export type ApiSuccess<T> = { success: true; data: T }
export type ApiError = { success: false; error: string }
export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── ENS types ────────────────────────────────────────────────────────────────

export type EnsProfile = {
  name: string
  address?: string
  avatarUrl?: string
  tonAddress?: string       // app.satsplit.ton-address text record
  telegramHandle?: string   // app.satsplit.telegram text record
  splitsPaid?: number       // app.satsplit.splits-paid text record
}

// ─── XRPL types ───────────────────────────────────────────────────────────────

export type XrplCheckState = "created" | "cashed" | "cancelled" | "expired"

export type XrplCheck = {
  checkId: string
  splitSessionId: string
  participantId: string
  xrpAmount: string
  state: XrplCheckState
  xummPayloadUuid?: string
  xummQrUrl?: string
  xummDeeplink?: string
}
