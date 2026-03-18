// TON payment deeplink builder
// Format: ton://transfer/<address>?amount=<nanotons>&text=<comment>

const TON_TO_NANO = 1_000_000_000n

export function buildTonPaymentLink({
  address,
  amountTon,
  comment,
}: {
  address: string
  amountTon: number
  comment: string
}): string {
  const nanotons = BigInt(Math.round(amountTon * Number(TON_TO_NANO)))
  const encoded = encodeURIComponent(comment)
  return `ton://transfer/${address}?amount=${nanotons}&text=${encoded}`
}

export function buildSplitComment(splitId: string, participantId: string): string {
  return `SatSplit:${splitId.slice(0, 8)}:${participantId.slice(0, 8)}`
}

// Parse a transfer comment to identify the split and participant
export function parseSplitComment(comment: string): { splitId: string; participantId: string } | null {
  const match = comment.match(/^SatSplit:([a-f0-9-]{8}):([a-f0-9-]{8})$/)
  if (!match) return null
  return { splitId: match[1], participantId: match[2] }
}
