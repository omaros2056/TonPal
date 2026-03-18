import { NextRequest, NextResponse } from "next/server"
import { parseReceipt } from "@/lib/ai/parse"
import type { ApiResponse, ReceiptScan } from "@/types"

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<ReceiptScan>>> {
  try {
    const body = await req.json()

    if (body.image) {
      const result = await parseReceipt({
        type: "image",
        base64: body.image,
        mimeType: body.mimeType ?? "image/jpeg",
      })
      return NextResponse.json({ success: true, data: result })
    }

    if (body.text) {
      const result = await parseReceipt({ type: "text", text: body.text })
      return NextResponse.json({ success: true, data: result })
    }

    return NextResponse.json(
      { success: false, error: "Provide image (base64) or text" },
      { status: 400 }
    )
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
