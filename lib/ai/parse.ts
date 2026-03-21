import { generateObject } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"
import type { ReceiptScan } from "@/types"

// ─── Zod schema — mirrors ReceiptScan / ReceiptItem exactly ──────────────────

const receiptItemSchema = z.object({
  name: z.string().describe("Item or dish name"),
  quantity: z.number().describe("Quantity ordered"),
  unitPrice: z.number().describe("Price per unit"),
  totalPrice: z.number().describe("quantity × unitPrice"),
})

const receiptSchema = z.object({
  merchant: z.string().describe("Store or restaurant name"),
  currency: z.string().describe("ISO 4217 currency code, e.g. EUR, USD, CHF"),
  total: z.number().describe("Final total amount charged"),
  tax: z.number().optional().describe("Tax amount, if shown separately"),
  items: z.array(receiptItemSchema).describe("Itemized line items"),
  rawImageUrl: z.string().optional().describe("Original image URL if applicable"),
})

// ─── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a precise receipt parser. Extract the following fields:
- merchant: store or restaurant name
- currency: ISO 4217 code (EUR, USD, CHF, GBP, etc.)
- total: the final total charged as a number (no currency symbol)
- tax: tax amount as a number, only if explicitly shown on the receipt
- items: every line item with name, quantity, unitPrice, and totalPrice

Rules:
- Return only structured data, no commentary.
- If quantity is not shown, default to 1.
- If unitPrice is not shown but totalPrice is, set unitPrice = totalPrice / quantity.
- Make your best guess for any unclear field rather than omitting it.
- Do NOT include tip or service charge in the items list — add it to total only.`

const TEXT_PROMPT = (text: string) =>
  `${SYSTEM_PROMPT}\n\nParse this receipt description:\n\n${text}`

// ─── Input type ───────────────────────────────────────────────────────────────

export type ParseReceiptInput = {
  imageBase64?: string
  imageUrl?: string
  text?: string
  premium?: boolean
}

// ─── Model routing ────────────────────────────────────────────────────────────

function buildMessages(input: ParseReceiptInput) {
  const hasImage = Boolean(input.imageBase64 || input.imageUrl)

  if (hasImage) {
    const imageContent =
      input.imageBase64
        ? {
            type: "image" as const,
            image: input.imageBase64.startsWith("data:")
              ? input.imageBase64
              : `data:image/jpeg;base64,${input.imageBase64}`,
          }
        : { type: "image" as const, image: new URL(input.imageUrl!) }

    return [
      {
        role: "user" as const,
        content: [
          imageContent,
          { type: "text" as const, text: SYSTEM_PROMPT },
        ],
      },
    ]
  }

  return [
    {
      role: "user" as const,
      content: TEXT_PROMPT(input.text ?? ""),
    },
  ]
}

export async function parseReceipt(input: ParseReceiptInput): Promise<ReceiptScan> {
  const messages = buildMessages(input)

  const result = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: receiptSchema,
    messages,
  })

  const parsed = result.object as ReceiptScan
  if (!parsed.rawImageUrl && input.imageUrl) {
    parsed.rawImageUrl = input.imageUrl
  }

  return parsed
}
