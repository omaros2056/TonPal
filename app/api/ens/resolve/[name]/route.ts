import { NextRequest, NextResponse } from "next/server"
import { resolveEns, isValidEnsName } from "@/lib/ens/resolve"

// Cache each resolved name for 5 minutes
export const revalidate = 300

export async function GET(
  _req: NextRequest,
  { params }: { params: { name: string } }
) {
  const name = decodeURIComponent(params.name)

  if (!isValidEnsName(name)) {
    return NextResponse.json(
      { success: false, error: "Invalid ENS name — must end in .eth with at least 3 chars before the dot" },
      { status: 400 }
    )
  }

  try {
    const result = await resolveEns(name)

    if (!result.address) {
      return NextResponse.json(
        { success: false, error: "ENS name not found or not registered" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: result })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    )
  }
}
