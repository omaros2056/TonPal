// grammy Telegram bot — command and message handlers
// Task 002 — full implementation

import { Bot, webhookCallback, InlineKeyboard } from "grammy"

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set")
}

export function createBot(token: string): Bot {
  const instance = new Bot(token)

  // /start — welcome message + inline button to open Mini App
  instance.command("start", async (ctx) => {
    const firstName = ctx.from?.first_name ?? "there"
    const keyboard = new InlineKeyboard().webApp(
      "Open SatSplit",
      `${process.env.NEXT_PUBLIC_APP_URL ?? "https://satsplit.app"}/miniapp`
    )

    await ctx.reply(
      `👋 Welcome to *SatSplit*, ${firstName}!\n\n` +
        "Split group expenses in seconds — powered by AI and settled on TON or XRPL.\n\n" +
        "*How it works:*\n" +
        "1. Send a receipt photo or describe the expense\n" +
        "2. I'll parse the amounts and suggest a fair split\n" +
        "3. Everyone pays via their preferred chain\n\n" +
        "_Try it now — open the app or send me a receipt photo!_",
      {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    )
  })

  // /split — prompt user to start a new split
  instance.command("split", async (ctx) => {
    await ctx.reply(
      "📸 *Start a new split*\n\n" +
        "You can:\n" +
        "• Send a *photo* of your receipt\n" +
        "• Or *describe* the expense, e.g.:\n" +
        '  _"Dinner was €85 for 4 people"_\n' +
        '  _"Pizza €32 + drinks €18, split 3 ways"_',
      { parse_mode: "Markdown" }
    )
  })

  // /status <id> — show split status
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

    // Stub: real lookup implemented in task 004
    await ctx.reply(
      `🔍 Looking up split \`${splitId}\`...\n\n` +
        "_Split status lookup will be available once payment processing is live (task 004)._",
      { parse_mode: "Markdown" }
    )
  })

  // Photo message handler — forward to receipt parser
  instance.on("message:photo", async (ctx) => {
    await ctx.reply(
      "Got it! Analyzing your receipt... 📊\n\n" +
        "_This may take a few seconds._",
      { parse_mode: "Markdown" }
    )

    try {
      // Get the highest-resolution photo
      const photos = ctx.message.photo
      const bestPhoto = photos[photos.length - 1]
      const fileId = bestPhoto.file_id

      // Stub call to receipt parser — real implementation in task 003
      // In production this would be:
      // const file = await ctx.api.getFile(fileId)
      // const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`
      // const result = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/receipts/parse`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ fileId, telegramUserId: ctx.from?.id }),
      // })

      console.log(`[bot] Receipt photo received, fileId=${fileId}, userId=${ctx.from?.id}`)

      await ctx.reply(
        "✅ Receipt received!\n\n" +
          "AI parsing will be live in the next update. " +
          "For now, open the app to create your split manually.",
        {
          parse_mode: "Markdown",
          reply_markup: new InlineKeyboard().webApp(
            "Open SatSplit",
            `${process.env.NEXT_PUBLIC_APP_URL ?? "https://satsplit.app"}/miniapp/split`
          ),
        }
      )
    } catch (err) {
      console.error("[bot] Photo handler error:", err)
      await ctx.reply("Sorry, I couldn't process that photo. Please try again.")
    }
  })

  // Text message handler — natural language expense description
  instance.on("message:text", async (ctx) => {
    const text = ctx.message.text

    // Ignore unknown commands
    if (text.startsWith("/")) return

    // Simple heuristic: does it look like an expense description?
    const looksLikeExpense =
      /\d/.test(text) &&
      /(split|owe|paid|dinner|lunch|taxi|bill|total|each|€|\$|£|eur|usd|gbp)/i.test(text)

    if (looksLikeExpense) {
      await ctx.reply(
        `Creating split for: _"${text}"_ ✂️\n\n` +
          "AI expense parsing will be live in the next update. " +
          "Open the app to set up the split manually.",
        {
          parse_mode: "Markdown",
          reply_markup: new InlineKeyboard().webApp(
            "Open SatSplit",
            `${process.env.NEXT_PUBLIC_APP_URL ?? "https://satsplit.app"}/miniapp/split`
          ),
        }
      )
    } else {
      await ctx.reply(
        "👋 I'm SatSplit — I help you split group expenses!\n\n" +
          "Send me a receipt photo or describe the expense, e.g.:\n" +
          '_"Dinner was €85 for 4 people"_\n\n' +
          "Or use /split to get started.",
        { parse_mode: "Markdown" }
      )
    }
  })

  // Global error handler
  instance.catch((err) => {
    const ctx = err.ctx
    console.error(`[bot] Error handling update ${ctx.update.update_id}:`, err.error)
  })

  return instance
}

// Singleton bot instance
export const bot = createBot(process.env.TELEGRAM_BOT_TOKEN)

// Start bot in long-polling mode (for local dev without a webhook)
export async function startBot(): Promise<void> {
  console.log("[bot] Starting in long-polling mode...")
  await bot.start({
    onStart: (info) => {
      console.log(`[bot] Listening as @${info.username}`)
    },
  })
}

// Webhook handler for Next.js API route
export const handleWebhook = webhookCallback(bot, "std/http")
