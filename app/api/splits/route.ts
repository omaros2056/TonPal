import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { ApiResponse, SplitSession } from "@/types"

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<SplitSession>>> {
  try {
    const body = await req.json()
    const { ownerId, source, receiptData } = body

    if (!ownerId || !source) {
      return NextResponse.json({ success: false, error: "ownerId and source required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("split_sessions")
      .insert({ owner_id: ownerId, source, receipt_data: receiptData, status: "draft" })
      .select()
      .single()

    if (error) throw error

    const session: SplitSession = {
      id: data.id,
      ownerId: data.owner_id,
      source: data.source,
      status: data.status,
      receiptData: data.receipt_data,
      createdAt: data.created_at,
    }

    return NextResponse.json({ success: true, data: session })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
