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

/**
 * calculateEqualSplit — returns the per-person share (first person absorbs rounding).
 * Alias used by API routes.
 */
export function calculateEqualSplit(total: number, participantCount: number): number {
  const amounts = equalSplit(total, participantCount)
  // Return the base share (last element, unaffected by rounding remainder)
  return amounts[amounts.length - 1]
}

// Itemized split — participant IDs assigned per item (array-based assignments)
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

/**
 * calculateItemizedSplit — record-based assignments.
 * assignments: { participantId: [itemName, ...] }
 * Matches items by name.
 */
export function calculateItemizedSplit(
  items: ReceiptItem[],
  assignments: Record<string, string[]>
): Record<string, number> {
  const totals: Record<string, number> = {}

  // Build a map: itemName -> list of participantIds assigned to it
  const itemToParticipants: Record<string, string[]> = {}
  for (const [participantId, itemNames] of Object.entries(assignments)) {
    for (const itemName of itemNames) {
      if (!itemToParticipants[itemName]) itemToParticipants[itemName] = []
      itemToParticipants[itemName].push(participantId)
    }
  }

  for (const item of items) {
    const participants = itemToParticipants[item.name]
    if (!participants || participants.length === 0) continue
    const share = round2(item.totalPrice / participants.length)
    for (const pid of participants) {
      totals[pid] = round2((totals[pid] ?? 0) + share)
    }
  }

  return totals
}

/**
 * validateSplit — returns true if sum of amounts ≈ total (within 0.01 rounding tolerance).
 */
export function validateSplit(amounts: Record<string, number>, total: number): boolean {
  const sum = Object.values(amounts).reduce((a, b) => a + b, 0)
  return Math.abs(round2(sum) - round2(total)) < 0.01
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
