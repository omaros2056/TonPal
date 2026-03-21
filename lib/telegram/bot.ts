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
  type ConversationSession,
  type ParticipantEntry,
} from "./conversation"
import {
  postStatusBoard,
  toPaymentStatusEntries,
} from "./status-board"
import {
  buildTelegramWalletLink,
  buildTonkeeperPaymentLink,
} from "@/lib/rails/ton/payment-link"

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

// ─── Private payment DM helper ───────────────────────────────────────────────
// Sends the payment buttons with pre-filled amount to whoever clicked the link.
// Called from both the universal split_ deep link and (future) remind flows.
async function sendPaymentDM(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  split: { merchant: string; currency: string; total: number },
  entry: { amount: number },
  splitId: string
): Promise<void> {
  const amountTon = entry.amount   // fiat treated as TON for demo/testnet
  const nanotons = Math.round(amountTon * 1_000_000_000)
  const comment = `TonPal-${splitId.slice(-8)}`
  const collectionAddress = process.env.TON_COLLECTION_ADDRESS ?? ""
  const isTestnet = (process.env.TON_NETWORK ?? "testnet") === "testnet"

  const kb = new InlineKeyboard()

  if (collectionAddress) {
    const tonkeeperLink = buildTonkeeperPaymentLink({
      toAddress: collectionAddress,
      amountTon,
      comment,
    })
    kb.url("💎 Pay with Tonkeeper", tonkeeperLink).row()
  }

  const walletParams = new URLSearchParams({
    startattach: "pay",
    amount: nanotons.toString(),
    currency: "TON",
    comment,
  })
  kb.url("💰 Telegram Wallet", `https://t.me/wallet?${walletParams.toString()}`)

  const addrDisplay = collectionAddress
    ? `\n📍 To: ${code(collectionAddress.slice(0, 6) + "…" + collectionAddress.slice(-4))}`
    : ""

  const testnetNote = isTestnet
    ? `\n\n${i("⚠️ Testnet — switch Tonkeeper to testnet mode (Settings → Dev tools)")}`
    : ""

  await ctx.reply(
    `👋 Hey ${ctx.from?.first_name ?? "there"}!\n\n` +
    `You owe ${b(`${amountTon.toFixed(2)} TON`)} ` +
    `(${split.currency}${entry.amount.toFixed(2)}) for ${b(split.merchant)}.` +
    addrDisplay +
    testnetNote +
    `\n\nTap below to pay:`,
    { ...HTML, reply_markup: kb }
  )
}

// ─── Remove inline keyboard from the message that was just clicked ────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function removeKeyboard(ctx: any): Promise<void> {
  try {
    const msg = ctx.callbackQuery?.message
    if (!msg) return
    await ctx.api.editMessageReplyMarkup(msg.chat.id, msg.message_id, {})
  } catch {
    // Message may have been deleted or already modified — not a blocker
  }
}

// ─── Stale-button guard ───────────────────────────────────────────────────────
// Returns true if the callback data no longer makes sense for the current state.
function isStaleCallback(data: string, session: ConversationSession): boolean {
  if (data === "split_equal" || data === "split_items" || data === "split_custom") {
    return session.state !== "awaiting_split_mode"
  }
  if (data === "confirm_split") {
    return session.state !== "confirming"
  }
  if (data.startsWith("assign_")) {
    return session.state !== "assigning_items"
  }
  return false
}

// ─── Bot factory ──────────────────────────────────────────────────────────────

export function createBot(token: string): Bot {
  const instance = new Bot(token)

  // ── /start ──────────────────────────────────────────────────────────────────
  instance.command("start", async (ctx) => {
    const payload = ctx.match ?? ""

    // Universal split deep link: /start split_{splitId}
    // The bot identifies the clicker by their Telegram username and shows only their share.
    if (typeof payload === "string" && payload.startsWith("split_")) {
      const splitId = payload.slice("split_".length)
      const username = ctx.from?.username

      if (!username) {
        await ctx.reply(
          `❌ You need a Telegram username to use TonPal payments.\n\n` +
          `Set one in ${b("Settings → Edit Profile → Username")}, then tap the link again.`,
          HTML
        )
        return
      }

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

          // Match by Telegram username (case-insensitive)
          const handle = `@${username}`
          const entry = split.splits.find(
            (s) => s.handle.toLowerCase() === handle.toLowerCase()
          )

          // Not part of this split → they're clear
          if (!entry) {
            await ctx.reply(
              `✅ ${b("You're all clear!")} You don't owe anything for ${b(split.merchant)}.\n\n` +
              `${i("This split doesn't include your username (@" + username + ").")}`,
              HTML
            )
            return
          }

          // Build payment buttons with pre-filled amount
          await sendPaymentDM(ctx, split, entry, splitId)
          return
        }
      } catch (err) {
        console.error("[bot] split deep link error:", err)
      }

      await ctx.reply("Sorry, I couldn't find that split. It may have expired.")
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

    // ── Stale-button guard ─────────────────────────────────────────────────────
    if (isStaleCallback(data, session)) {
      await ctx.answerCallbackQuery("⏰ This button has already been used.")
      await removeKeyboard(ctx)
      return
    }

    // ── feature_split ──────────────────────────────────────────────────────────
    if (data === "feature_split") {
      await ctx.answerCallbackQuery()
      await removeKeyboard(ctx)
      await setSession(chatId, { state: "awaiting_receipt" })
      await ctx.reply("📸 Send me a receipt photo or describe the bill and I'll parse it for you.")
      return
    }

    // ── split_equal ────────────────────────────────────────────────────────────
    if (data === "split_equal") {
      await ctx.answerCallbackQuery()
      await removeKeyboard(ctx)

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
      await removeKeyboard(ctx)

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
      await removeKeyboard(ctx)

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
      await removeKeyboard(ctx)

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

      // Transition to split_active so old confirm/edit buttons are now stale
      await updateSession(chatId, {
        state: "split_active",
        splitSessionId: splitId,
        statusMessageId: statusMsgId,
      })

      const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "satsplittestbot"

      // Universal link — same for everyone; the bot identifies the clicker by username
      const universalLink = `https://t.me/${botUsername}?start=split_${splitId}`
      const universalKb = new InlineKeyboard().url("💎 View your share & pay", universalLink)

      // Post one message per person showing their amount publicly (social accountability),
      // but the button is universal — clicking it opens a private chat where the bot
      // identifies who you are and shows only your share.
      for (const p of participants) {
        await instance.api.sendMessage(
          chatId,
          `${p.handle} — you owe ${b(`${currency}${p.amount.toFixed(2)}`)} for ${b(scan.merchant)}`,
          { ...HTML, reply_markup: universalKb }
        )
      }
      return
    }

    // ── edit_split ─────────────────────────────────────────────────────────────
    // Preserve all collected data; go back to split-mode selection.
    if (data === "edit_split") {
      await ctx.answerCallbackQuery()
      await removeKeyboard(ctx)

      const scan = session.receiptScan
      const handles = session.collectedHandles ?? []

      if (!scan) {
        await ctx.reply("Session expired. Please start again with /tonpal.")
        await setSession(chatId, { state: "awaiting_receipt" })
        return
      }

      // Keep receiptScan and handles; reset only the split-mode state
      await updateSession(chatId, {
        state: "awaiting_split_mode",
        splitMode: undefined,
        participants: undefined,
        itemAssignments: undefined,
        currentItemIndex: undefined,
      })

      const currency = scan.currency ?? "€"
      const names = handles.length > 0 ? handles.join(", ") : i("(no participants yet)")
      await ctx.reply(
        `✏️ ${b("Edit split")} — ${b(scan.merchant)} ${currency}${scan.total.toFixed(2)}\n\nParticipants: ${names}\n\nChoose how to split:`,
        { ...HTML, reply_markup: receiptKeyboard() }
      )
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
    // Re-sends the same deep link payment message as confirm_split, as a reminder.
    if (data.startsWith("remind_")) {
      const rawHandle = data.slice("remind_".length)
      const handle = `@${rawHandle}`

      const scan = session.receiptScan
      const participants = session.participants ?? []
      const splitId = session.splitSessionId

      const participant = participants.find(
        (p) => p.handle.toLowerCase() === handle.toLowerCase()
      )

      if (!participant || !scan || !splitId) {
        await ctx.answerCallbackQuery("Could not find reminder data.")
        return
      }

      const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "satsplittestbot"
      const universalLink = `https://t.me/${botUsername}?start=split_${splitId}`
      const currency = scan.currency ?? "€"

      const kb = new InlineKeyboard().url("💎 View your share & pay", universalLink)
      await ctx.reply(
        `🔔 ${b("Reminder:")} ${handle} — you still owe ${b(`${currency}${participant.amount.toFixed(2)}`)} for ${b(scan.merchant)}`,
        { ...HTML, reply_markup: kb }
      )

      await ctx.answerCallbackQuery("🔔 Reminder sent!")
      return
    }

    // ── item assignment: assign_{handle}__{itemIndex} ──────────────────────────
    if (data.startsWith("assign_")) {
      await ctx.answerCallbackQuery()
      await removeKeyboard(ctx)

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
