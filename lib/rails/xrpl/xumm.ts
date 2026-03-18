// Xumm sign request builder — creates QR code + deeplink for participant signing

type XummPayloadResponse = {
  uuid: string
  next: { always: string }   // deeplink
  refs: { qr_png: string }   // QR code image URL
  pushed: boolean
}

export async function createXummPayload(txJson: object): Promise<{
  uuid: string
  qrUrl: string
  deeplink: string
}> {
  const res = await fetch("https://xumm.app/api/v1/platform/payload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.XUMM_API_KEY!,
      "X-API-Secret": process.env.XUMM_API_SECRET!,
    },
    body: JSON.stringify({
      txjson: txJson,
      options: {
        expire: 10080, // 7 days in minutes
        return_url: {
          web: `${process.env.NEXT_PUBLIC_APP_URL}/split/xrpl-callback`,
        },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Xumm error: ${res.status} — ${err}`)
  }

  const data: XummPayloadResponse = await res.json()
  return {
    uuid: data.uuid,
    qrUrl: data.refs.qr_png,
    deeplink: data.next.always,
  }
}

export async function getXummPayloadStatus(uuid: string): Promise<{
  signed: boolean
  txHash?: string
}> {
  const res = await fetch(`https://xumm.app/api/v1/platform/payload/${uuid}`, {
    headers: {
      "X-API-Key": process.env.XUMM_API_KEY!,
      "X-API-Secret": process.env.XUMM_API_SECRET!,
    },
  })

  if (!res.ok) throw new Error(`Xumm status error: ${res.status}`)
  const data = await res.json()

  return {
    signed: data.meta?.signed ?? false,
    txHash: data.response?.txid,
  }
}
