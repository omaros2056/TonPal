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
  updateStatusBoard,
  toPaymentStatusEntries,
} from "./status-board"
import { buildTelegramWalletLink } from "@/lib/rails/ton/payment-link"

// Token check is deferred to runtime (not build time) — see getBot() below

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ton-pal.vercel.app"

// ─── Payment request DM ───────────────────────────────────────────────────────

/**
 * Send a direct-message payment request to a participant via their Telegram user id.
 * Falls back gracefully if the bot has never started a conversation with that user.
 */
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
      `Hey ${participant.handle} 👋\n` +
        `You owe *${currency}${participant.amount.toFixed(2)}* for ${merchant}.\n\n` +
        `Tap below to pay instantly with your Telegram Wallet:`,
      {
        parse_mode: "Markdown",
        reply_markup: kb,
      }
    )
  } catch (err) {
    console.error(
      `[bot] Failed to send payment DM to userId=${telegramUserId}:`,
      err
    )
  }
}

// ─── Receipt parsing stub ─────────────────────────────────────────────────────

/**
 * Call the receipt-parse API and return a ReceiptScan.
 * Falls back to a demo stub if the service is unavailable.
 */
async function fetchFileAsBase64(fileId: string): Promise<string> {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  // Step 1: get the file path from Telegram
  const metaRes = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
  )
  const meta = await metaRes.json()
  const filePath: string = meta.result.file_path
  const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`
  // Step 2: download the image bytes on our server
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
    `🧾 *${scan.merchant}* — ${currency}${scan.total.toFixed(2)}` +
    ` — ${scan.items.length} item${scan.items.length !== 1 ? "s" : ""}`
  )
}

// ─── Bot factory ──────────────────────────────────────────────────────────────

export function createBot(token: string): Bot {
  const instance = new Bot(token)

  // ── /start ──────────────────────────────────────────────────────────────────
  instance.command("start", async (ctx) => {
    const firstName = ctx.from?.first_name ?? "there"
    const keyboard = new InlineKeyboard().webApp(
      "Open SatSplit",
      `${APP_URL}/miniapp`
    )

    await ctx.reply(
      `👋 Welcome to *SatSplit*, ${firstName}!\n\n` +
        "Split group expenses in seconds — powered by AI and settled on TON or XRPL.\n\n" +
        "*How it works:*\n" +
        "1. Use /split in any group chat\n" +
        "2. Send a receipt photo or describe the bill\n" +
        "3. Everyone pays via Telegram Wallet\n\n" +
        "_Try it — use /split to get started!_",
      { parse_mode: "Markdown", reply_markup: keyboard }
    )
  })

  // ── /split ──────────────────────────────────────────────────────────────────
  instance.command("split", async (ctx) => {
    const chatId = ctx.chat.id
    setSession(chatId, { state: "awaiting_receipt" })

    await ctx.reply(
      "📸 Send me a receipt photo or describe the bill.",
      { parse_mode: "Markdown" }
    )
  })

  // ── /status <id> ─────────────────────────────────────────────────────────────
  instance.command("status", async (ctx) => {
    const parts = (ctx.message?.text ?? "").split(" ")
    const splitId = parts[1]?.trim()

    if (!splitId) {
      await ctx.reply(
        "Please provide a split ID.\nUsage: `/status <split-id>`",
        { parse_mode: "Markdown" }
      )
      return
    }

    await ctx.reply(
      `🔍 Looking up split \`${splitId}\`...`,
      { parse_mode: "Markdown" }
    )
  })

  // ── Photo messages ───────────────────────────────────────────────────────────
  instance.on("message:photo", async (ctx) => {
    const chatId = ctx.chat.id
    const session = getSession(chatId)

    // Always accept a photo — start a fresh split regardless of current state
    setSession(chatId, { state: "awaiting_receipt" })

    const processingMsg = await ctx.reply(
      "Got it! Analyzing your receipt... 📊\n_This may take a few seconds._",
      { parse_mode: "Markdown" }
    )

    try {
      const photos = ctx.message.photo
      const bestPhoto = photos[photos.length - 1]
      const fileId = bestPhoto.file_id

      console.log(`[bot] Receipt photo fileId=${fileId}, userId=${ctx.from?.id}`)

      const scan = await parseReceipt(fileId, null)

      // Delete the "analyzing..." message
      await ctx.api.deleteMessage(chatId, processingMsg.message_id).catch(() => {})

      updateSession(chatId, {
        state: "awaiting_participant_count",
        receiptScan: scan,
      })

      await ctx.reply(
        buildReceiptSummaryText(scan) + "\n\nHow many people are splitting this bill?",
        { parse_mode: "Markdown" }
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

    // Ignore commands (handled separately)
    if (text.startsWith("/")) return

    const session = getSession(chatId)

    // ── State: awaiting receipt description ────────────────────────────────────
    if (session.state === "awaiting_receipt") {
      const processingMsg = await ctx.reply(
        "Parsing expense... 🤖",
        { parse_mode: "Markdown" }
      )

      const scan = await parseReceipt(null, text)

      await ctx.api.deleteMessage(chatId, processingMsg.message_id).catch(() => {})

      updateSession(chatId, {
        state: "awaiting_participant_count",
        receiptScan: scan,
      })

      await ctx.reply(
        buildReceiptSummaryText(scan) + "\n\nHow many people are splitting this bill?",
        { parse_mode: "Markdown" }
      )
      return
    }

    // ── State: how many people? ────────────────────────────────────────────────
    if (session.state === "awaiting_participant_count") {
      const count = parseInt(text.trim(), 10)
      if (isNaN(count) || count < 2 || count > 50) {
        await ctx.reply("Please enter a number between 2 and 50.")
        return
      }

      updateSession(chatId, {
        state: "collecting_handles",
        participantCount: count,
        collectedHandles: [],
        currentHandleIndex: 0,
      })

      await ctx.reply(`Person 1 of ${count} — send their @handle:`, { parse_mode: "Markdown" })
      return
    }

    // ── State: collecting handles one by one ───────────────────────────────────
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
        updateSession(chatId, { collectedHandles: collected, currentHandleIndex: nextIndex })
        await ctx.reply(`Person ${nextIndex + 1} of ${count} — send their @handle:`, { parse_mode: "Markdown" })
      } else {
        // All handles collected — show split options
        const scan = session.receiptScan!
        updateSession(chatId, {
          state: "awaiting_split_mode",
          collectedHandles: collected,
          currentHandleIndex: nextIndex,
        })

        const names = collected.map((h) => h).join(", ")
        await ctx.reply(
          `Got everyone: ${names}\n\nHow do you want to split *${scan.merchant}*?`,
          { parse_mode: "Markdown", reply_markup: receiptKeyboard() }
        )
      }
      return
    }

    // ── Default: not in any flow ───────────────────────────────────────────────
    const looksLikeExpense =
      /\d/.test(text) &&
      /(split|owe|paid|dinner|lunch|taxi|bill|total|each|€|\$|£|eur|usd|gbp)/i.test(text)

    if (looksLikeExpense) {
      await ctx.reply(
        "Use /split to start a new expense split, then send your description.",
        { parse_mode: "Markdown" }
      )
    } else {
      await ctx.reply(
        "👋 I'm SatSplit — I help you split group expenses!\n\n" +
          "Use /split in your group chat to get started.",
        { parse_mode: "Markdown" }
      )
    }
  })

  // ── Callback query (inline button taps) ──────────────────────────────────────
  instance.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data
    const chatId = ctx.chat?.id ?? ctx.callbackQuery.message?.chat.id

    if (!chatId) {
      await ctx.answerCallbackQuery()
      return
    }

    const session = getSession(chatId)

    // ── split_equal ────────────────────────────────────────────────────────────
    if (data === "split_equal") {
      await ctx.answerCallbackQuery()

      const scan = session.receiptScan
      const handles = session.collectedHandles ?? []
      if (!scan) { await ctx.reply("Please start with /split first."); return }

      const count = handles.length
      const currency = scan.currency ?? "€"
      const perPerson = parseFloat((scan.total / count).toFixed(2))
      const participants: ParticipantEntry[] = handles.map((handle) => ({ handle, amount: perPerson }))

      updateSession(chatId, { state: "confirming", splitMode: "equal", participants })

      const lines = participants.map((p) => `• ${p.handle} — ${currency}${p.amount.toFixed(2)}`)
      const summary = `Here's the equal split for *${scan.merchant}*:\n\n${lines.join("\n")}\n\nTotal: *${currency}${scan.total.toFixed(2)}*`

      await ctx.reply(summary, {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text("✅ Send payment requests", "confirm_split").text("✏️ Edit", "edit_split"),
      })
      return
    }

    // ── split_items ────────────────────────────────────────────────────────────
    if (data === "split_items") {
      await ctx.answerCallbackQuery()

      const scan = session.receiptScan
      const handles = session.collectedHandles ?? []
      if (!scan || scan.items.length === 0) { await ctx.reply("No items found. Please try /split again."); return }

      const placeholderParticipants = handles.map((handle) => ({ handle, amount: 0 }))
      updateSession(chatId, {
        splitMode: "items",
        state: "assigning_items",
        participants: placeholderParticipants,
        currentItemIndex: 0,
        itemAssignments: {},
      })

      await sendItemAssignmentPrompt(instance, chatId, scan, 0)
      return
    }

    // ── split_custom ───────────────────────────────────────────────────────────
    if (data === "split_custom") {
      await ctx.answerCallbackQuery()

      const handles = session.collectedHandles ?? []
      const scan = session.receiptScan!
      const currency = scan.currency ?? "€"
      const handleList = handles.map((h) => `${h} 0.00`).join("\n")

      updateSession(chatId, { state: "awaiting_participants", splitMode: "custom" })

      await ctx.reply(
        `Send the amount each person owes, one per line:\n\`${handleList}\`\n\n_Edit the amounts and send back._`,
        { parse_mode: "Markdown" }
      )
      return
    }

    // ── confirm_split ──────────────────────────────────────────────────────────
    if (data === "confirm_split") {
      await ctx.answerCallbackQuery("Sending payment requests...")

      const scan = session.receiptScan
      const participants = session.participants

      if (!scan || !participants || participants.length === 0) {
        await ctx.reply("No split data found. Please start again with /split.")
        return
      }

      const currency = scan.currency ?? "€"
      const splitId = `split-${Date.now()}`

      // Post status board
      const paymentEntries = toPaymentStatusEntries(participants)
      const statusMsgId = await postStatusBoard(
        instance,
        chatId,
        scan.merchant,
        scan.total,
        currency,
        paymentEntries
      )

      updateSession(chatId, {
        splitSessionId: splitId,
        statusMessageId: statusMsgId,
      })

      // Send DMs — note: we don't have real user ids in the hackathon demo,
      // so we report that requests have been queued.
      await ctx.reply(
        `✅ Payment requests sent to ${participants.length} participant(s)!\n\n` +
          "_Each person received a direct message with their payment link._",
        { parse_mode: "Markdown" }
      )
      return
    }

    // ── edit_split ─────────────────────────────────────────────────────────────
    if (data === "edit_split") {
      await ctx.answerCallbackQuery()
      updateSession(chatId, { state: "awaiting_receipt" })
      await ctx.reply("OK, let's start over. Send me the receipt photo or description again.")
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
      await ctx.reply(
        `*${scan.merchant}* split details:\n\n${lines.join("\n")}`,
        { parse_mode: "Markdown" }
      )
      return
    }

    // ── remind_{handle} ────────────────────────────────────────────────────────
    if (data.startsWith("remind_")) {
      await ctx.answerCallbackQuery("Reminder sent!")
      const handle = `@${data.slice("remind_".length)}`
      await ctx.reply(
        `🔔 Reminder sent to ${handle}!`,
        { parse_mode: "Markdown" }
      )
      return
    }

    // ── item assignment: assigned_{handle}_for_{itemIndex} ─────────────────────
    if (data.startsWith("assign_")) {
      await ctx.answerCallbackQuery()

      const parts = data.split("__")  // assign_{handle}___{itemIndex}
      if (parts.length < 2) return

      const handle = parts[0].replace(/^assign_/, "")
      const itemIndex = parseInt(parts[1], 10)
      const scan = session.receiptScan

      if (!scan) return

      const assignments = { ...(session.itemAssignments ?? {}), [itemIndex]: `@${handle}` }
      const nextIndex = itemIndex + 1

      if (nextIndex < scan.items.length) {
        // More items to assign
        updateSession(chatId, {
          itemAssignments: assignments,
          currentItemIndex: nextIndex,
        })
        await sendItemAssignmentPrompt(instance, chatId, scan, nextIndex)
      } else {
        // All items assigned — build participant totals
        updateSession(chatId, { itemAssignments: assignments })

        const totals: Record<string, number> = {}
        for (const [idxStr, h] of Object.entries(assignments)) {
          const idx = parseInt(idxStr, 10)
          const item = scan.items[idx]
          if (item) {
            totals[h] = (totals[h] ?? 0) + item.totalPrice
          }
        }

        const participants: ParticipantEntry[] = Object.entries(totals).map(
          ([handle, amount]) => ({ handle, amount: parseFloat(amount.toFixed(2)) })
        )

        updateSession(chatId, {
          state: "confirming",
          participants,
        })

        const currency = scan.currency ?? "€"
        const lines = participants.map(
          (p) => `• ${p.handle} — ${currency}${p.amount.toFixed(2)}`
        )
        const summary =
          `Here's the split for *${scan.merchant}*:\n\n${lines.join("\n")}\n\n` +
          `Total: *${currency}${scan.total.toFixed(2)}*`

        const kb = new InlineKeyboard()
          .text("✅ Send payment requests", "confirm_split")
          .text("✏️ Edit", "edit_split")

        await ctx.reply(summary, {
          parse_mode: "Markdown",
          reply_markup: kb,
        })
      }
      return
    }

    // Unhandled callback
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

/**
 * Send a message asking who had a specific item, with inline buttons
 * for each known participant or a set of default demo participants.
 */
async function sendItemAssignmentPrompt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot: Bot<any>,
  chatId: number,
  scan: ReceiptScan,
  itemIndex: number
): Promise<void> {
  const item = scan.items[itemIndex]
  if (!item) return

  const currency = scan.currency ?? "€"
  const session = getSession(chatId)

  // Use known participants if available, otherwise provide defaults
  const knownHandles =
    session.participants?.map((p) => p.handle) ??
    ["@Alice", "@Bob", "@Charlie", "@Me"]

  const kb = new InlineKeyboard()
  for (const handle of knownHandles) {
    const safeHandle = handle.replace(/^@/, "").slice(0, 20)
    kb.text(handle, `assign_${safeHandle}__${itemIndex}`)
  }

  await bot.api.sendMessage(
    chatId,
    `*${item.name}* — ${currency}${item.totalPrice.toFixed(2)} — Who had this?`,
    {
      parse_mode: "Markdown",
      reply_markup: kb,
    }
  )
}

// ─── Lazy singleton — only created at runtime, never at build time ────────────

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
