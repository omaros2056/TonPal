import { NextRequest, NextResponse } from "next/server"
import { resolveEnsName } from "@/lib/ens/resolve"

export async function GET(
  _req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const profile = await resolveEnsName(decodeURIComponent(params.name))
    if (!profile) {
      return NextResponse.json({ success: false, error: "ENS name not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: profile })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
