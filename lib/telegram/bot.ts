// grammy Telegram bot — fully Telegram-native flow
// Core split flow runs entirely inside the chat; Mini App is secondary (XRPL / ENS demos).

import { Bot, webhookCallback, InlineKeyboard } from "grammy"
import type { ReceiptScan } from "@/types"
import { parseReceipt as parseReceiptAI } from "@/lib/ai/parse"
import {
  getSession,
  setSession,
  updateSession,
  clearSession,
  type ParticipantEntry,
} from "./conversation"
import {
  postStatusBoard,
  toPaymentStatusEntries,
} from "./status-board"
import { buildTelegramWalletLink } from "@/lib/rails/ton/payment-link"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ton-pal.vercel.app"

// ─── HTML helpers (safe for handles with underscores etc.) ───────────────────

const b = (s: string) => `<b>${s}</b>`
const i = (s: string) => `<i>${s}</i>`
const code = (s: string) => `<code>${s}</code>`
const HTML = { parse_mode: "HTML" as const }

// ─── Payment request DM ───────────────────────────────────────────────────────

export async function sendPaymentRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot: Bot<any>,
  participant: ParticipantEntry,
  splitId: string,
  merchant: string,
  currency: string,
  telegramUserId?: number
): Promise<void> {
  if (!telegramUserId) return

  const walletLink = buildTelegramWalletLink(
    participant.amount,
    splitId,
    `${participant.handle} owes for ${merchant}`
  )

  const kb = new InlineKeyboard().url("💎 Pay with Telegram Wallet", walletLink)

  try {
    await bot.api.sendMessage(
      telegramUserId,
      `Hey ${participant.handle} 👋\nYou owe ${b(`${currency}${participant.amount.toFixed(2)}`)} for ${merchant}.\n\nTap below to pay instantly with your Telegram Wallet:`,
      { ...HTML, reply_markup: kb }
    )
  } catch (err) {
    console.error(`[bot] Failed to send payment DM to userId=${telegramUserId}:`, err)
  }
}

// ─── Receipt helpers ──────────────────────────────────────────────────────────

async function fetchFileAsBase64(fileId: string): Promise<string> {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  const metaRes = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
  )
  const meta = await metaRes.json()
  const filePath: string = meta.result.file_path
  const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`
  const imgRes = await fetch(fileUrl)
  const buffer = await imgRes.arrayBuffer()
  return Buffer.from(buffer).toString("base64")
}

async function parseReceipt(
  fileId: string | null,
  text: string | null
): Promise<ReceiptScan> {
  if (fileId) {
    const imageBase64 = await fetchFileAsBase64(fileId)
    return parseReceiptAI({ imageBase64 })
  }
  return parseReceiptAI({ text: text ?? "" })
}

// ─── Reply helpers ────────────────────────────────────────────────────────────

function receiptKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Split equally", "split_equal")
    .text("✏️ Assign items", "split_items")
    .row()
    .text("💬 Type amounts", "split_custom")
}

function buildReceiptSummaryText(scan: ReceiptScan): string {
  const currency = scan.currency ?? "€"
  return (
    `🧾 ${b(scan.merchant)} — ${currency}${scan.total.toFixed(2)}` +
    ` — ${scan.items.length} item${scan.items.length !== 1 ? "s" : ""}`
  )
}

function featureMenu(): InlineKeyboard {
  return new InlineKeyboard().text("🧾 Split a bill", "feature_split")
}

// ─── Bot factory ──────────────────────────────────────────────────────────────

export function createBot(token: string): Bot {
  const instance = new Bot(token)

  // ── /start ──────────────────────────────────────────────────────────────────
  instance.command("start", async (ctx) => {
    const payload = ctx.match ?? ""

    // Deep link: /start pay_{splitId}_{handle}
    if (typeof payload === "string" && payload.startsWith("pay_")) {
      const parts = payload.slice("pay_".length).split("_")
      const splitId = parts[0]
      const rawHandle = parts.slice(1).join("_")

      try {
        const { createClient } = await import("@supabase/supabase-js")
        const db = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data } = await db.from("tonpal_splits").select("data").eq("id", splitId).single()

        if (data?.data) {
          const split = data.data as {
            merchant: string
            currency: string
            total: number
            splits: { handle: string; amount: number }[]
          }
          const handle = `@${rawHandle}`
          const entry = split.splits.find(
            (s) => s.handle.toLowerCase() === handle.toLowerCase()
          )

          if (entry) {
            const nanotons = Math.round(entry.amount * 1_000_000_000).toString()
            const params = new URLSearchParams({
              startattach: "pay",
              amount: nanotons,
              currency: "TON",
              comment: `TonPal-${splitId}`,
            })
            const payLink = `https://t.me/wallet?${params.toString()}`
            const kb = new InlineKeyboard().url("💎 Pay with Telegram Wallet", payLink)

            await ctx.reply(
              `👋 Hey ${ctx.from?.first_name ?? handle}!\n\nYou owe ${b(`${split.currency}${entry.amount.toFixed(2)}`)} for ${b(split.merchant)}.\n\nTap below to pay instantly:`,
              { ...HTML, reply_markup: kb }
            )
            return
          }
        }
      } catch (err) {
        console.error("[bot] pay deep link error:", err)
      }

      await ctx.reply("Sorry, I couldn't find that payment request. It may have expired.")
      return
    }

    const firstName = ctx.from?.first_name ?? "there"
    await ctx.reply(
      `👋 Hey ${firstName}! I'm ${b("TonPal")} — your group expense assistant.\n\nUse /tonpal to get started.`,
      HTML
    )
  })

  // ── /tonpal — main entry point ───────────────────────────────────────────────
  instance.command("tonpal", async (ctx) => {
    const chatId = ctx.chat.id
    await setSession(chatId, { state: "awaiting_receipt" })
    const kb = new InlineKeyboard().text("🧾 Split a bill", "feature_split")
    await ctx.reply(
      `💼 ${b("TonPal")} — What do you want to do?`,
      { ...HTML, reply_markup: kb }
    )
  })

  // ── Photo messages ───────────────────────────────────────────────────────────
  instance.on("message:photo", async (ctx) => {
    const chatId = ctx.chat.id

    await setSession(chatId, { state: "awaiting_receipt" })

    const processingMsg = await ctx.reply(
      `Got it! Analyzing your receipt... 📊\n${i("This may take a few seconds.")}`,
      HTML
    )

    try {
      const photos = ctx.message.photo
      const bestPhoto = photos[photos.length - 1]
      const fileId = bestPhoto.file_id

      console.log(`[bot] Receipt photo fileId=${fileId}, userId=${ctx.from?.id}`)

      const scan = await parseReceipt(fileId, null)

      await ctx.api.deleteMessage(chatId, processingMsg.message_id).catch(() => {})

      await updateSession(chatId, {
        state: "awaiting_participant_count",
        receiptScan: scan,
      })

      await ctx.reply(
        buildReceiptSummaryText(scan) + "\n\nHow many people are splitting this bill?",
        HTML
      )
    } catch (err) {
      console.error("[bot] Photo handler error:", err)
      await ctx.reply("Sorry, I couldn't process that photo. Please try again.")
    }
  })

  // ── Text messages ─────────────────────────────────────────────────────────────
  instance.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id
    const text = ctx.message.text

    if (text.startsWith("/")) return

    const session = await getSession(chatId)

    // ── awaiting receipt description ───────────────────────────────────────────
    if (session.state === "awaiting_receipt") {
      const processingMsg = await ctx.reply("Parsing expense... 🤖", HTML)

      const scan = await parseReceipt(null, text)

      await ctx.api.deleteMessage(chatId, processingMsg.message_id).catch(() => {})

      await updateSession(chatId, {
        state: "awaiting_participant_count",
        receiptScan: scan,
      })

      await ctx.reply(
        buildReceiptSummaryText(scan) + "\n\nHow many people are splitting this bill?",
        HTML
      )
      return
    }

    // ── how many people? ───────────────────────────────────────────────────────
    if (session.state === "awaiting_participant_count") {
      const count = parseInt(text.trim(), 10)
      if (isNaN(count) || count < 2 || count > 50) {
        await ctx.reply("Please enter a number between 2 and 50.")
        return
      }

      await updateSession(chatId, {
        state: "collecting_handles",
        participantCount: count,
        collectedHandles: [],
        currentHandleIndex: 0,
      })

      await ctx.reply(`Person 1 of ${count} — send their @handle:`)
      return
    }

    // ── collecting handles one by one ──────────────────────────────────────────
    if (session.state === "collecting_handles") {
      const raw = text.trim()
      const handle = raw.startsWith("@") ? raw : `@${raw}`

      if (!/^@\w+$/.test(handle)) {
        await ctx.reply("That doesn't look like a valid @handle. Try again:")
        return
      }

      const collected = [...(session.collectedHandles ?? []), handle]
      const count = session.participantCount!
      const nextIndex = collected.length

      if (nextIndex < count) {
        await updateSession(chatId, { collectedHandles: collected, currentHandleIndex: nextIndex })
        await ctx.reply(`Person ${nextIndex + 1} of ${count} — send their @handle:`)
      } else {
        const scan = session.receiptScan
        if (!scan) {
          await ctx.reply("Session expired. Please send the receipt photo again.")
          await setSession(chatId, { state: "awaiting_receipt" })
          return
        }

        await updateSession(chatId, {
          state: "awaiting_split_mode",
          collectedHandles: collected,
          currentHandleIndex: nextIndex,
        })

        const names = collected.join(", ")
        await ctx.reply(
          `Got everyone: ${names}\n\nHow do you want to split ${b(scan.merchant)}?`,
          { ...HTML, reply_markup: receiptKeyboard() }
        )
      }
      return
    }

    // ── custom amounts typed in ────────────────────────────────────────────────
    if (session.state === "awaiting_participants" && session.splitMode === "custom") {
      const scan = session.receiptScan
      if (!scan) {
        await ctx.reply("Session expired. Please start again with /tonpal.")
        return
      }
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
      const participants: ParticipantEntry[] = []

      for (const line of lines) {
        const match = line.match(/^(@?\w+)\s+([\d.,]+)$/)
        if (match) {
          const handle = match[1].startsWith("@") ? match[1] : `@${match[1]}`
          const amount = parseFloat(match[2].replace(",", "."))
          if (!isNaN(amount)) participants.push({ handle, amount })
        }
      }

      if (participants.length === 0) {
        await ctx.reply(
          `Couldn't parse those amounts. Send one per line like:\n${code("@alice 20.50\n@bob 15.00")}`,
          HTML
        )
        return
      }

      await updateSession(chatId, { state: "confirming", participants })
      const currency = scan.currency ?? "€"
      const summaryLines = participants.map((p) => `• ${p.handle} — ${currency}${p.amount.toFixed(2)}`)
      await ctx.reply(
        `Here's your custom split for ${b(scan.merchant)}:\n\n${summaryLines.join("\n")}`,
        {
          ...HTML,
          reply_markup: new InlineKeyboard()
            .text("✅ Send payment requests", "confirm_split")
            .text("✏️ Edit", "edit_split"),
        }
      )
      return
    }

    // ── Default ────────────────────────────────────────────────────────────────
    await ctx.reply("Use /tonpal to get started.")
  })

  // ── Callback query (inline button taps) ──────────────────────────────────────
  instance.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data
    const chatId = ctx.chat?.id ?? ctx.callbackQuery.message?.chat.id

    if (!chatId) {
      await ctx.answerCallbackQuery()
      return
    }

    const session = await getSession(chatId)

    // ── feature_split ──────────────────────────────────────────────────────────
    if (data === "feature_split") {
      await ctx.answerCallbackQuery()
      await setSession(chatId, { state: "awaiting_receipt" })
      await ctx.reply("📸 Send me a receipt photo or describe the bill and I'll parse it for you.")
      return
    }

    // ── split_equal ────────────────────────────────────────────────────────────
    if (data === "split_equal") {
      await ctx.answerCallbackQuery()

      const scan = session.receiptScan
      const handles = session.collectedHandles ?? []
      if (!scan) {
        await ctx.reply("Session expired. Please start again with /tonpal.")
        return
      }

      const count = handles.length
      const currency = scan.currency ?? "€"
      const perPerson = parseFloat((scan.total / count).toFixed(2))
      const participants: ParticipantEntry[] = handles.map((handle) => ({ handle, amount: perPerson }))

      await updateSession(chatId, { state: "confirming", splitMode: "equal", participants })

      const lines = participants.map((p) => `• ${p.handle} — ${currency}${p.amount.toFixed(2)}`)
      const summary =
        `Here's the equal split for ${b(scan.merchant)}:\n\n${lines.join("\n")}\n\nTotal: ${b(`${currency}${scan.total.toFixed(2)}`)}`

      await ctx.reply(summary, {
        ...HTML,
        reply_markup: new InlineKeyboard()
          .text("✅ Send payment requests", "confirm_split")
          .text("✏️ Edit", "edit_split"),
      })
      return
    }

    // ── split_items ────────────────────────────────────────────────────────────
    if (data === "split_items") {
      await ctx.answerCallbackQuery()

      const scan = session.receiptScan
      const handles = session.collectedHandles ?? []
      if (!scan || scan.items.length === 0) {
        await ctx.reply("No items found. Please try again.")
        return
      }

      const placeholderParticipants = handles.map((handle) => ({ handle, amount: 0 }))
      await updateSession(chatId, {
        splitMode: "items",
        state: "assigning_items",
        participants: placeholderParticipants,
        currentItemIndex: 0,
        itemAssignments: {},
      })

      await sendItemAssignmentPrompt(instance, chatId, scan, 0, handles)
      return
    }

    // ── split_custom ───────────────────────────────────────────────────────────
    if (data === "split_custom") {
      await ctx.answerCallbackQuery()

      const handles = session.collectedHandles ?? []
      const scan = session.receiptScan
      if (!scan) {
        await ctx.reply("Session expired. Please start again with /tonpal.")
        return
      }

      const handleList = handles.map((h) => `${h} 0.00`).join("\n")

      await updateSession(chatId, { state: "awaiting_participants", splitMode: "custom" })

      await ctx.reply(
        `Send the amount each person owes, one per line:\n${code(handleList)}\n\n${i("Edit the amounts and send back.")}`,
        HTML
      )
      return
    }

    // ── confirm_split ──────────────────────────────────────────────────────────
    if (data === "confirm_split") {
      await ctx.answerCallbackQuery("Sending payment requests...")

      const scan = session.receiptScan
      const participants = session.participants

      if (!scan || !participants || participants.length === 0) {
        await ctx.reply("No split data found. Please start again with /tonpal.")
        return
      }

      const currency = scan.currency ?? "€"
      const splitId = `split-${Date.now()}`

      const paymentEntries = toPaymentStatusEntries(participants)
      const statusMsgId = await postStatusBoard(
        instance,
        chatId,
        scan.merchant,
        scan.total,
        currency,
        paymentEntries
      )

      // Save split to DB so the deep link can look it up
      try {
        const { createClient } = await import("@supabase/supabase-js")
        const db = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        await db.from("tonpal_splits").insert({
          id: splitId,
          data: {
            merchant: scan.merchant,
            currency,
            total: scan.total,
            splits: participants.map((p) => ({ handle: p.handle, amount: p.amount })),
          },
        })
      } catch (err) {
        console.error("[bot] Failed to save split to DB:", err)
      }

      await updateSession(chatId, { splitSessionId: splitId, statusMessageId: statusMsgId })

      const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "satsplittestbot"

      // Post one message per person with a deep link to their private payment chat
      for (const p of participants) {
        const rawHandle = p.handle.replace(/^@/, "")
        const deepLink = `https://t.me/${botUsername}?start=pay_${splitId}_${rawHandle}`
        const kb = new InlineKeyboard().url("💎 Tap to pay", deepLink)
        await instance.api.sendMessage(
          chatId,
          `${p.handle} — you owe ${b(`${currency}${p.amount.toFixed(2)}`)} for ${b(scan.merchant)}`,
          { ...HTML, reply_markup: kb }
        )
      }
      return
    }

    // ── edit_split ─────────────────────────────────────────────────────────────
    if (data === "edit_split") {
      await ctx.answerCallbackQuery()
      await setSession(chatId, { state: "awaiting_receipt" })
      await ctx.reply("OK, send me the receipt photo or description again.")
      return
    }

    // ── status_details ─────────────────────────────────────────────────────────
    if (data === "status_details") {
      await ctx.answerCallbackQuery()
      const scan = session.receiptScan
      if (!scan) {
        await ctx.reply("No active split found.")
        return
      }
      const currency = scan.currency ?? "€"
      const lines = (session.participants ?? []).map(
        (p) => `• ${p.handle} — ${currency}${p.amount.toFixed(2)}`
      )
      await ctx.reply(`${b(scan.merchant)} split details:\n\n${lines.join("\n")}`, HTML)
      return
    }

    // ── remind_{handle} ────────────────────────────────────────────────────────
    if (data.startsWith("remind_")) {
      await ctx.answerCallbackQuery("Reminder sent!")
      const handle = `@${data.slice("remind_".length)}`
      await ctx.reply(`🔔 Reminder sent to ${handle}!`)
      return
    }

    // ── item assignment: assign_{handle}__{itemIndex} ──────────────────────────
    if (data.startsWith("assign_")) {
      await ctx.answerCallbackQuery()

      const parts = data.split("__")
      if (parts.length < 2) return

      const handle = parts[0].replace(/^assign_/, "")
      const itemIndex = parseInt(parts[1], 10)
      const scan = session.receiptScan
      const handles = session.collectedHandles ?? []

      if (!scan) return

      const assignments = { ...(session.itemAssignments ?? {}), [itemIndex]: `@${handle}` }
      const nextIndex = itemIndex + 1

      if (nextIndex < scan.items.length) {
        await updateSession(chatId, { itemAssignments: assignments, currentItemIndex: nextIndex })
        await sendItemAssignmentPrompt(instance, chatId, scan, nextIndex, handles)
      } else {
        await updateSession(chatId, { itemAssignments: assignments })

        const totals: Record<string, number> = {}
        for (const [idxStr, h] of Object.entries(assignments)) {
          const idx = parseInt(idxStr, 10)
          const item = scan.items[idx]
          if (item) totals[h] = (totals[h] ?? 0) + item.totalPrice
        }

        const participants: ParticipantEntry[] = Object.entries(totals).map(
          ([h, amount]) => ({ handle: h, amount: parseFloat(amount.toFixed(2)) })
        )

        await updateSession(chatId, { state: "confirming", participants })

        const currency = scan.currency ?? "€"
        const lines = participants.map((p) => `• ${p.handle} — ${currency}${p.amount.toFixed(2)}`)
        const summary =
          `Here's the split for ${b(scan.merchant)}:\n\n${lines.join("\n")}\n\nTotal: ${b(`${currency}${scan.total.toFixed(2)}`)}`

        await ctx.reply(summary, {
          ...HTML,
          reply_markup: new InlineKeyboard()
            .text("✅ Send payment requests", "confirm_split")
            .text("✏️ Edit", "edit_split"),
        })
      }
      return
    }

    await ctx.answerCallbackQuery()
  })

  // Global error handler
  instance.catch((err) => {
    const ctx = err.ctx
    console.error(`[bot] Error handling update ${ctx.update.update_id}:`, err.error)
  })

  return instance
}

// ─── Item assignment prompt ────────────────────────────────────────────────────

async function sendItemAssignmentPrompt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot: Bot<any>,
  chatId: number,
  scan: ReceiptScan,
  itemIndex: number,
  handles: string[]
): Promise<void> {
  const item = scan.items[itemIndex]
  if (!item) return

  const currency = scan.currency ?? "€"

  const kb = new InlineKeyboard()
  for (const handle of handles) {
    const safeHandle = handle.replace(/^@/, "").slice(0, 20)
    kb.text(handle, `assign_${safeHandle}__${itemIndex}`)
  }

  await bot.api.sendMessage(
    chatId,
    `${b(item.name)} — ${currency}${item.totalPrice.toFixed(2)} — Who had this?`,
    { ...HTML, reply_markup: kb }
  )
}

// ─── Lazy singleton ───────────────────────────────────────────────────────────

let _bot: Bot | null = null

function getBot(): Bot {
  if (!_bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set")
    _bot = createBot(token)
  }
  return _bot
}

export async function startBot(): Promise<void> {
  console.log("[bot] Starting in long-polling mode...")
  await getBot().start({
    onStart: (info) => {
      console.log(`[bot] Listening as @${info.username}`)
    },
  })
}

export async function handleWebhook(req: Request): Promise<Response> {
  return webhookCallback(getBot(), "std/http", { timeoutMilliseconds: 55_000 })(req)
}
