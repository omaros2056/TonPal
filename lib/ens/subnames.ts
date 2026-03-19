// NameStone offchain subname management
// Creates alice.satsplit.eth gaslessly via the NameStone REST API

const NAMESTONE_API = "https://namestone.xyz/api/public_v1"
const PARENT_DOMAIN = "satsplit.eth"

function authHeader(): string {
  const key = process.env.NAMESTONE_API_KEY
  if (!key) throw new Error("NAMESTONE_API_KEY env var is not set")
  return `Bearer ${key}`
}

// ─── Public API (task-spec signatures) ────────────────────────────────────────

export async function createSubname(params: {
  label: string
  evmAddress: string
  tonAddress?: string
  telegramHandle?: string
}): Promise<{
  subname: string
  success: boolean
  error?: string
}> {
  const subname = `${params.label}.${PARENT_DOMAIN}`

  try {
    const textRecords: Record<string, string> = {}
    if (params.tonAddress) {
      textRecords["app.satsplit.ton-address"] = params.tonAddress
    }
    if (params.telegramHandle) {
      textRecords["app.satsplit.telegram"] = params.telegramHandle
    }

    const res = await fetch(`${NAMESTONE_API}/set-name`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(),
      },
      body: JSON.stringify({
        domain: PARENT_DOMAIN,
        name: params.label,
        address: params.evmAddress,
        text_records: textRecords,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return { subname, success: false, error: `NameStone ${res.status}: ${err}` }
    }

    return { subname, success: true }
  } catch (e: any) {
    return { subname, success: false, error: e.message }
  }
}

export async function checkSubnameAvailable(label: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${NAMESTONE_API}/get-names?domain=${PARENT_DOMAIN}&name=${encodeURIComponent(label)}`,
      {
        headers: { Authorization: authHeader() },
      }
    )

    if (!res.ok) return true // assume available if API errors

    const data: { name: string }[] = await res.json()
    return !data.some((entry) => entry.name === label)
  } catch {
    return true // fail open
  }
}

export async function updateSubnameRecords(
  label: string,
  records: {
    tonAddress?: string
    telegramHandle?: string
    splitsPaid?: number
  }
): Promise<boolean> {
  try {
    // We need the current address to call set-name (required field).
    // Fetch existing entry first.
    const res = await fetch(
      `${NAMESTONE_API}/get-names?domain=${PARENT_DOMAIN}&name=${encodeURIComponent(label)}`,
      {
        headers: { Authorization: authHeader() },
      }
    )

    let currentAddress = "0x0000000000000000000000000000000000000000"
    let existingTextRecords: Record<string, string> = {}

    if (res.ok) {
      const data: { name: string; address: string; text_records?: Record<string, string> }[] =
        await res.json()
      const match = data.find((e) => e.name === label)
      if (match) {
        currentAddress = match.address
        existingTextRecords = match.text_records ?? {}
      }
    }

    const textRecords: Record<string, string> = { ...existingTextRecords }
    if (records.tonAddress !== undefined) {
      textRecords["app.satsplit.ton-address"] = records.tonAddress
    }
    if (records.telegramHandle !== undefined) {
      textRecords["app.satsplit.telegram"] = records.telegramHandle
    }
    if (records.splitsPaid !== undefined) {
      textRecords["app.satsplit.splits-paid"] = String(records.splitsPaid)
    }

    const updateRes = await fetch(`${NAMESTONE_API}/set-name`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(),
      },
      body: JSON.stringify({
        domain: PARENT_DOMAIN,
        name: label,
        address: currentAddress,
        text_records: textRecords,
      }),
    })

    return updateRes.ok
  } catch {
    return false
  }
}

// ─── Legacy compatibility exports ─────────────────────────────────────────────
// Kept so the existing API route (subnames/create/route.ts) still compiles.

export type SubnameRecord = {
  name: string
  address: string
  textRecords?: Record<string, string>
}

export async function createSubnameLegacy(record: SubnameRecord): Promise<void> {
  const res = await fetch(`${NAMESTONE_API}/set-name`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      domain: PARENT_DOMAIN,
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
  await createSubnameLegacy({ name, address, textRecords })
}

export async function deleteSubname(name: string): Promise<void> {
  const res = await fetch(`${NAMESTONE_API}/revoke-name`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      domain: PARENT_DOMAIN,
      name,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`NameStone delete error: ${res.status} — ${err}`)
  }
}

export function deriveSubname(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32)
}
