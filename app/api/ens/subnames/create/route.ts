import { NextRequest, NextResponse } from "next/server"
import { createSubname, checkSubnameAvailable } from "@/lib/ens/subnames"

// Label must be alphanumeric + hyphens, 3-30 chars
const LABEL_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$|^[a-z0-9]{3,30}$/

function isValidLabel(label: string): boolean {
  return LABEL_RE.test(label)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const { label, evmAddress, tonAddress, telegramHandle } = body as Record<
    string,
    string | undefined
  >

  if (!label || !evmAddress) {
    return NextResponse.json(
      { success: false, error: "label and evmAddress are required" },
      { status: 400 }
    )
  }

  // Normalize label to lowercase
  const normalizedLabel = label.toLowerCase()

  if (!isValidLabel(normalizedLabel)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "label must be 3-30 characters, alphanumeric and hyphens only, cannot start or end with a hyphen",
      },
      { status: 400 }
    )
  }

  // Check availability
  const available = await checkSubnameAvailable(normalizedLabel)
  if (!available) {
    return NextResponse.json(
      { success: false, error: `${normalizedLabel}.satsplit.eth is already taken` },
      { status: 409 }
    )
  }

  const result = await createSubname({
    label: normalizedLabel,
    evmAddress,
    tonAddress,
    telegramHandle,
  })

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error ?? "Failed to create subname" },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, data: { subname: result.subname } })
}
