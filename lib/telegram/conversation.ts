// In-memory conversation session state for the Telegram bot.
// Uses a simple Map keyed by chatId — sufficient for a hackathon demo.
// In production this would be backed by Redis or a DB.

import type { ReceiptScan } from "@/types"

// ─── Session state machine ────────────────────────────────────────────────────

export type ConversationState =
  | "idle"
  | "awaiting_feature"
  | "awaiting_receipt"
  | "awaiting_participant_count"
  | "collecting_handles"
  | "awaiting_split_mode"
  | "assigning_items"
  | "awaiting_participants"
  | "awaiting_participants_for_items"
  | "confirming"

export type SplitMode = "equal" | "items" | "custom"

export interface ParticipantEntry {
  handle: string        // @alice
  amount: number        // fiat amount owed
}

export interface ConversationSession {
  state: ConversationState
  receiptScan?: ReceiptScan
  splitMode?: SplitMode
  /** Items with per-participant assignment (index into participants array) */
  itemAssignments?: Record<number, string>  // itemIndex -> handle
  /** Resolved participants with amounts */
  participants?: ParticipantEntry[]
  /** For item-by-item assignment loop */
  currentItemIndex?: number
  /** Total number of people splitting */
  participantCount?: number
  /** Handles collected so far during one-by-one collection */
  collectedHandles?: string[]
  /** Index of next handle to collect */
  currentHandleIndex?: number
  /** The status board message id for editing in-place */
  statusMessageId?: number
  /** The split session id once persisted */
  splitSessionId?: string
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const sessions = new Map<number, ConversationSession>()

export function getSession(chatId: number): ConversationSession {
  return sessions.get(chatId) ?? { state: "idle" }
}

export function setSession(chatId: number, session: ConversationSession): void {
  sessions.set(chatId, session)
}

export function updateSession(
  chatId: number,
  patch: Partial<ConversationSession>
): ConversationSession {
  const current = getSession(chatId)
  const updated = { ...current, ...patch }
  sessions.set(chatId, updated)
  return updated
}

export function clearSession(chatId: number): void {
  sessions.delete(chatId)
}
