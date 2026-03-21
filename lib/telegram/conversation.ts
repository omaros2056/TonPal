// In-memory conversation session state for the Telegram bot.
// Uses a simple Map keyed by chatId — sufficient for a hackathon demo.
// In production this would be backed by Redis or a DB.

import type { ReceiptScan } from "@/types"

// ─── Session state machine ────────────────────────────────────────────────────

export type ConversationState =
  | "idle"
  | "awaiting_receipt"
  | "awaiting_split_mode"
  | "awaiting_participant_count"
  | "assigning_items"
  | "awaiting_participants"
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
  /** Total number of people when doing equal split */
  participantCount?: number
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
