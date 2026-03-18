import { generateObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { z } from "zod"
import type { ReceiptScan } from "@/types"

const receiptSchema = z.object({
  merchant: z.string(),
  currency: z.string(),
  total: z.number(),
  tax: z.number().optional(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    totalPrice: z.number(),
  })),
})

const PARSE_PROMPT = `You are a receipt parser. Extract from this receipt:
- merchant: store or restaurant name
- currency: ISO code (EUR, USD, CHF, etc.)
- total: final total as a number
- tax: tax amount as a number (optional)
- items: array of line items with name, quantity, unitPrice, totalPrice

Return only valid JSON. No explanation. If a field is unclear, make your best guess.`

type ParseInput =
  | { type: "image"; base64: string; mimeType: string }
  | { type: "text"; text: string }

export async function parseReceipt(input: ParseInput): Promise<ReceiptScan> {
  const models = [
    anthropic("claude-sonnet-4-6"),
    google("gemini-1.5-flash"),
  ]

  for (const model of models) {
    try {
      const messages =
        input.type === "image"
          ? [{ role: "user" as const, content: [
              { type: "image" as const, image: `data:${input.mimeType};base64,${input.base64}` },
              { type: "text" as const, text: PARSE_PROMPT },
            ]}]
          : [{ role: "user" as const, content: `${PARSE_PROMPT}\n\nReceipt text: ${input.text}` }]

      const result = await generateObject({
        model,
        schema: receiptSchema,
        messages,
      })

      return result.object as ReceiptScan
    } catch {
      // try next model
      continue
    }
  }

  throw new Error("All AI models failed. Please enter the receipt details manually.")
}
