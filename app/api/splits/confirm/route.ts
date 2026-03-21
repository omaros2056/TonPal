import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { nanoid } from "nanoid"

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { merchant, currency, total, splits } = body

    if (!merchant || !splits || !Array.isArray(splits)) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 })
    }

    const id = nanoid(10)
    const { error } = await getDb()
      .from("tonpal_splits")
      .insert({ id, data: { merchant, currency, total, splits } })

    if (error) throw error

    return NextResponse.json({ success: true, splitId: id })
  } catch (err) {
    console.error("[splits/confirm]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
