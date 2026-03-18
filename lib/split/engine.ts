// Split engine — equal / itemized / custom

import type { ReceiptItem } from "@/types"

// Round to 2 decimal places
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Equal split — returns array of amounts (handles rounding)
export function equalSplit(total: number, count: number): number[] {
  if (count <= 0) throw new Error("At least 1 participant required")
  const base = round2(Math.floor((total / count) * 100) / 100)
  const remainder = round2(total - base * count)
  const amounts = Array(count).fill(base)
  // Give remainder to first participant
  amounts[0] = round2(amounts[0] + remainder)
  return amounts
}

// Itemized split — participant IDs assigned per item
export function itemizedSplit(
  items: ReceiptItem[],
  assignments: Array<{ itemIndex: number; participantIds: string[] }>
): Record<string, number> {
  const totals: Record<string, number> = {}

  for (const assignment of assignments) {
    const item = items[assignment.itemIndex]
    if (!item) continue
    const share = round2(item.totalPrice / assignment.participantIds.length)
    for (const pid of assignment.participantIds) {
      totals[pid] = round2((totals[pid] ?? 0) + share)
    }
  }

  return totals
}

// Custom split — validate that amounts sum to total
export function validateCustomSplit(
  amounts: Record<string, number>,
  total: number
): { valid: boolean; diff: number } {
  const sum = Object.values(amounts).reduce((a, b) => a + b, 0)
  const diff = round2(Math.abs(sum - total))
  return { valid: diff < 0.01, diff }
}

// Add tax proportionally to each amount
export function addTaxProportionally(
  amounts: Record<string, number>,
  tax: number
): Record<string, number> {
  const total = Object.values(amounts).reduce((a, b) => a + b, 0)
  const result: Record<string, number> = {}
  for (const [pid, amount] of Object.entries(amounts)) {
    result[pid] = round2(amount + tax * (amount / total))
  }
  return result
}
