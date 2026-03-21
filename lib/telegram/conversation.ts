// Supabase-backed conversation session state for the Telegram bot.
// Each session is stored as a JSONB row in bot_sessions, keyed by chat_id.
// This survives Vercel cold starts / multiple function instances.

import { createClient } from "@supabase/supabase-js"
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
  | "split_active"

export type SplitMode = "equal" | "items" | "custom"

export interface ParticipantEntry {
  handle: string   // @alice
  amount: number   // fiat amount owed
}

export interface ConversationSession {
  state: ConversationState
  receiptScan?: ReceiptScan
  splitMode?: SplitMode
  itemAssignments?: Record<number, string>
  participants?: ParticipantEntry[]
  currentItemIndex?: number
  participantCount?: number
  collectedHandles?: string[]
  currentHandleIndex?: number
  statusMessageId?: number
  splitSessionId?: string
}

// ─── Supabase admin client (no cookies needed) ───────────────────────────────

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── In-memory cache (warm-instance optimisation) ────────────────────────────

const cache = new Map<number, ConversationSession>()

// ─── Public API — all async ───────────────────────────────────────────────────

export async function getSession(chatId: number): Promise<ConversationSession> {
  if (cache.has(chatId)) return cache.get(chatId)!

  const { data } = await getDb()
    .from("bot_sessions")
    .select("data")
    .eq("chat_id", chatId)
    .single()

  const session: ConversationSession = (data?.data as ConversationSession) ?? { state: "idle" }
  cache.set(chatId, session)
  return session
}

export async function setSession(chatId: number, session: ConversationSession): Promise<void> {
  cache.set(chatId, session)
  await getDb()
    .from("bot_sessions")
    .upsert({ chat_id: chatId, data: session, updated_at: new Date().toISOString() })
}

export async function updateSession(
  chatId: number,
  patch: Partial<ConversationSession>
): Promise<ConversationSession> {
  const current = await getSession(chatId)
  const updated = { ...current, ...patch }
  await setSession(chatId, updated)
  return updated
}

export async function clearSession(chatId: number): Promise<void> {
  cache.delete(chatId)
  await getDb().from("bot_sessions").delete().eq("chat_id", chatId)
}
