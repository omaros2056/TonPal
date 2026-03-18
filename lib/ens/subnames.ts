// NameStone offchain subname management
// Creates alice.satsplit.eth gaslessly

const NAMESTONE_API = "https://namestone.xyz/api/public_v1"

export type SubnameRecord = {
  name: string       // e.g. "alice" → alice.satsplit.eth
  address: string    // EVM address
  textRecords?: Record<string, string>
}

export async function createSubname(record: SubnameRecord): Promise<void> {
  if (!process.env.ENS_ENABLED || process.env.ENS_ENABLED === "false") return

  const res = await fetch(`${NAMESTONE_API}/set-name`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.NAMESTONE_API_KEY!,
    },
    body: JSON.stringify({
      domain: process.env.ENS_PARENT_NAME ?? "satsplit.eth",
      name: record.name,
      address: record.address,
      text_records: record.textRecords ?? {},
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`NameStone error: ${res.status} — ${err}`)
  }
}

export async function updateSubnameTextRecords(
  name: string,
  address: string,
  textRecords: Record<string, string>
): Promise<void> {
  await createSubname({ name, address, textRecords })
}

export async function deleteSubname(name: string): Promise<void> {
  if (!process.env.ENS_ENABLED || process.env.ENS_ENABLED === "false") return

  const res = await fetch(`${NAMESTONE_API}/revoke-name`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.NAMESTONE_API_KEY!,
    },
    body: JSON.stringify({
      domain: process.env.ENS_PARENT_NAME ?? "satsplit.eth",
      name,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`NameStone delete error: ${res.status} — ${err}`)
  }
}

// Derive a URL-safe subname from a display name or Telegram handle
export function deriveSubname(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32)
}
