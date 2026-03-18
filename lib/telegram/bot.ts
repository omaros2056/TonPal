// grammy Telegram bot — command and message handlers
// Stub — full implementation in task 002

import { Bot, webhookCallback } from "grammy"

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set")
}

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN)

// /start — welcome + Mini App button
bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 Welcome to *SatSplit*!\n\nSplit group expenses in seconds.\n\nSend me a receipt photo or type something like:\n_\"Dinner was €85, split 4 ways\"_",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          {
            text: "Open SatSplit",
            web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/miniapp` },
          },
        ]],
      },
    }
  )
})

// /split — shortcut to start a new split
bot.command("split", async (ctx) => {
  await ctx.reply("📸 Send me a receipt photo or describe the expense:")
})

// Photo message — forward to AI parser
bot.on("message:photo", async (ctx) => {
  await ctx.reply("📊 Analyzing receipt...")
  // Full implementation in task 002+003
})

// Text message — natural language input
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text
  if (text.startsWith("/")) return // ignore unknown commands
  await ctx.reply(`Got it: "${text}"\n\nProcessing...`)
  // Full implementation in task 002+003
})

export const handleWebhook = webhookCallback(bot, "std/http")
