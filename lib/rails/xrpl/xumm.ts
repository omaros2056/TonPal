// Xumm (Xaman) sign request builder
// Uses direct REST calls to Xumm API — no SDK required

type XummCreateResponse = {
  uuid: string
  next: { always: string }
  refs: { qr_png: string }
  pushed: boolean
  expire_at?: string
}

type XummStatusResponse = {
  meta: {
    signed: boolean
    cancelled: boolean
    expired: boolean
  }
  response: {
    txid: string | null
    account: string | null
  }
}

function xummHeaders() {
  return {
    "Content-Type": "application/json",
    "X-API-Key": process.env.XUMM_API_KEY!,
    "X-API-Secret": process.env.XUMM_API_SECRET!,
  }
}

// Create a Xumm sign request for any XRPL transaction
export async function createXummSignRequest(params: {
  transaction: object
  participantName: string
  returnUrl?: string
}): Promise<{
  uuid: string
  qrUrl: string
  deeplink: string
  webUrl: string
  expiration: string
}> {
  const { transaction, participantName, returnUrl } = params

  const body: Record<string, unknown> = {
    txjson: transaction,
    options: {
      submit: true,
      expire: 10080, // 7 days in minutes
      instruction: `SatSplit: Payment from ${participantName}`,
    },
  }

  if (returnUrl) {
    ;(body.options as Record<string, unknown>).return_url = {
      app: returnUrl,
      web: returnUrl,
    }
  }

  const res = await fetch("https://xumm.app/api/v1/platform/payload", {
    method: "POST",
    headers: xummHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Xumm create error: ${res.status} — ${errText}`)
  }

  const data: XummCreateResponse = await res.json()

  // deeplink: xumm://sign/<uuid>
  const deeplink = `xumm://sign/${data.uuid}`
  // expiration: Xumm returns expire_at in the payload if available; default to 7 days from now
  const expiration =
    data.expire_at ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  return {
    uuid: data.uuid,
    qrUrl: data.refs.qr_png,
    deeplink,
    webUrl: data.next.always,
    expiration,
  }
}

// Legacy compat: createXummPayload (used by existing create route)
export async function createXummPayload(txJson: object): Promise<{
  uuid: string
  qrUrl: string
  deeplink: string
  webUrl: string
  expiration: string
}> {
  return createXummSignRequest({ transaction: txJson, participantName: "Participant" })
}

// Check the status of a Xumm sign request
export async function getXummPayloadStatus(uuid: string): Promise<{
  signed: boolean
  txHash: string | null
  resolvedAddress: string | null
  cancelled: boolean
}> {
  const res = await fetch(`https://xumm.app/api/v1/platform/payload/${uuid}`, {
    headers: xummHeaders(),
  })

  if (!res.ok) {
    throw new Error(`Xumm status error: ${res.status}`)
  }

  const data: XummStatusResponse = await res.json()

  return {
    signed: data.meta?.signed ?? false,
    txHash: data.response?.txid ?? null,
    resolvedAddress: data.response?.account ?? null,
    cancelled: data.meta?.cancelled ?? false,
  }
}
