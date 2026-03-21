// Status board: a pinned group message that is edited in real time as people pay.

import { Bot, InlineKeyboard } from "grammy"
import type { ParticipantEntry } from "./conversation"

export interface PaymentStatusEntry {
  handle: string
  amount: number
  paid: boolean
}

// ─── Renderer ────────────────────────────────────────────────────────────────

/**
 * Build the Markdown text for the status board message.
 */
export function renderStatusBoard(
  merchant: string,
  total: number,
  currency: string,
  payments: PaymentStatusEntry[]
): string {
  const lines: string[] = [
    `📊 <b>${merchant}</b> — ${currency}${total.toFixed(2)}`,
    "",
  ]

  for (const p of payments) {
    const icon = p.paid ? "✅" : "⏳"
    const status = p.paid ? "Paid" : "Pending"
    lines.push(`${icon} ${p.handle}    ${currency}${p.amount.toFixed(2)}   ${status}`)
  }

  return lines.join("\n")
}

/**
 * Build the inline keyboard for the status board.
 * Adds a "Remind" button for each pending participant.
 */
export function buildStatusBoardKeyboard(
  payments: PaymentStatusEntry[]
): InlineKeyboard {
  const kb = new InlineKeyboard()
  const pending = payments.filter((p) => !p.paid)

  for (const p of pending) {
    // Sanitise handle for use in callback data (strip @, max 32 chars total)
    const safeHandle = p.handle.replace(/^@/, "").slice(0, 20)
    kb.text(`🔔 Remind ${p.handle}`, `remind_${safeHandle}`).row()
  }

  kb.text("📊 Full details", "status_details")
  return kb
}

// ─── Bot helpers ──────────────────────────────────────────────────────────────

/**
 * Post the status board as a new message in the chat and pin it.
 * Returns the message id so it can be stored and edited later.
 */
export async function postStatusBoard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot: Bot<any>,
  chatId: number,
  merchant: string,
  total: number,
  currency: string,
  payments: PaymentStatusEntry[]
): Promise<number> {
  const text = renderStatusBoard(merchant, total, currency, payments)
  const reply_markup = buildStatusBoardKeyboard(payments)

  const msg = await bot.api.sendMessage(chatId, text, {
    parse_mode: "HTML",
    reply_markup,
  })

  // Best-effort pin — may fail if bot lacks admin rights
  try {
    await bot.api.pinChatMessage(chatId, msg.message_id, {
      disable_notification: true,
    })
  } catch {
    // Not a blocker — private chats don't support pinning
  }

  return msg.message_id
}

/**
 * Edit the existing status board message in place.
 */
export async function updateStatusBoard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot: Bot<any>,
  chatId: number,
  messageId: number,
  merchant: string,
  total: number,
  currency: string,
  payments: PaymentStatusEntry[]
): Promise<void> {
  const text = renderStatusBoard(merchant, total, currency, payments)
  const reply_markup = buildStatusBoardKeyboard(payments)

  await bot.api.editMessageText(chatId, messageId, text, {
    parse_mode: "HTML",
    reply_markup,
  })
}

// ─── Conversion helper ───────────────────────────────────────────────────────

/**
 * Convert a ParticipantEntry array into a PaymentStatusEntry array.
 * Initially all are pending; pass a set of paid handles to mark them.
 */
export function toPaymentStatusEntries(
  participants: ParticipantEntry[],
  paidHandles: Set<string> = new Set()
): PaymentStatusEntry[] {
  return participants.map((p) => ({
    handle: p.handle,
    amount: p.amount,
    paid: paidHandles.has(p.handle),
  }))
}
