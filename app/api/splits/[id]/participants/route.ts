import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { ApiResponse, Participant } from "@/types"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<Participant>>> {
  try {
    const body = await req.json()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("participants")
      .insert({
        split_session_id: params.id,
        telegram_user_id: body.telegramUserId,
        display_name: body.displayName,
        ens_name: body.ensName,
        satsplit_subname: body.satsplitSubname,
        handle: body.handle,
        ton_address: body.tonAddress,
        evm_address: body.evmAddress,
        xrp_address: body.xrpAddress,
        avatar_url: body.avatarUrl,
      })
      .select()
      .single()

    if (error) throw error

    const participant: Participant = {
      id: data.id,
      splitSessionId: data.split_session_id,
      telegramUserId: data.telegram_user_id,
      displayName: data.display_name,
      ensName: data.ens_name,
      satsplitSubname: data.satsplit_subname,
      handle: data.handle,
      tonAddress: data.ton_address,
      evmAddress: data.evm_address,
      xrpAddress: data.xrp_address,
      avatarUrl: data.avatar_url,
    }

    return NextResponse.json({ success: true, data: participant })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
