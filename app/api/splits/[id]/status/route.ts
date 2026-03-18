import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const { data: participants, error: pErr } = await supabase
      .from("participants")
      .select("*")
      .eq("split_session_id", params.id)

    if (pErr) throw pErr

    const { data: requests, error: rErr } = await supabase
      .from("payment_requests")
      .select("*, payment_receipts(*)")
      .eq("split_session_id", params.id)

    if (rErr) throw rErr

    return NextResponse.json({ success: true, data: { participants, requests } })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
