// XRPL Checks — CheckCreate / CheckCash / CheckCancel
// Uses xrpl.js library

import { Client, xrpToDrops, dropsToXrp } from "xrpl"
import type { CheckCreate, CheckCash, CheckCancel } from "xrpl"

const XRPL_NETWORKS = {
  testnet: "wss://s.altnet.rippletest.net:51233",
  mainnet: "wss://xrplcluster.com",
}

// Get a connected XRPL client (testnet by default)
export function getXrplClient(): Client {
  const network = (process.env.XRPL_NETWORK ?? "testnet") as keyof typeof XRPL_NETWORKS
  return new Client(XRPL_NETWORKS[network])
}

// Build a CheckCreate transaction (unsigned — to be signed by participant via Xumm)
export function buildCheckCreate(params: {
  senderAddress: string       // participant's XRP address
  destinationAddress: string  // organizer's XRP address
  amountXrp: number           // amount in XRP
  expireAfterDays?: number    // default 7
  invoiceId?: string          // hex identifier for this payment request
}): CheckCreate {
  const { senderAddress, destinationAddress, amountXrp, expireAfterDays = 7, invoiceId } = params

  // XRPL epoch starts 2000-01-01; Unix epoch starts 1970-01-01 (diff: 946684800 s)
  const expiryUnix = Math.floor(Date.now() / 1000) + expireAfterDays * 24 * 3600
  const rippleExpiry = expiryUnix - 946684800

  const tx: CheckCreate = {
    TransactionType: "CheckCreate",
    Account: senderAddress,
    Destination: destinationAddress,
    SendMax: xrpToDrops(amountXrp.toString()),
    Expiration: rippleExpiry,
  }

  if (invoiceId) {
    // InvoiceID must be a 64-char hex string
    const hex = Buffer.from(invoiceId).toString("hex").toUpperCase()
    tx.InvoiceID = hex.slice(0, 64).padEnd(64, "0")
  }

  return tx
}

// Build a CheckCash transaction (unsigned — signed by organizer via Xumm or server wallet)
export function buildCheckCash(params: {
  organizerAddress: string
  checkId: string           // the CheckID from the on-chain check object
  amountXrp: number
}): CheckCash {
  const { organizerAddress, checkId, amountXrp } = params
  return {
    TransactionType: "CheckCash",
    Account: organizerAddress,
    CheckID: checkId,
    Amount: xrpToDrops(amountXrp.toString()),
  }
}

// Build a CheckCancel transaction (unsigned)
export function buildCheckCancel(params: {
  signerAddress: string
  checkId: string
}): CheckCancel {
  const { signerAddress, checkId } = params
  return {
    TransactionType: "CheckCancel",
    Account: signerAddress,
    CheckID: checkId,
  }
}

// Poll the XRPL ledger for check objects sent TO the organizer address
export async function getChecksForOrganizer(organizerAddress: string): Promise<Array<{
  checkId: string
  sender: string
  amountDrops: string
  expiration?: number
  invoiceId?: string
  status: "created" | "cashed" | "cancelled" | "expired"
}>> {
  const client = getXrplClient()
  await client.connect()
  try {
    const response = await client.request({
      command: "account_objects",
      account: organizerAddress,
      type: "check",
      ledger_index: "validated",
    })

    const nowRipple = Math.floor(Date.now() / 1000) - 946684800

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (response.result.account_objects as any[]).map((obj: any) => {
      const expiration: number | undefined = obj.Expiration
      let status: "created" | "cashed" | "cancelled" | "expired" = "created"
      if (expiration && nowRipple > expiration) {
        status = "expired"
      }

      return {
        checkId: obj.index as string,
        sender: obj.Account as string,
        amountDrops: typeof obj.SendMax === "string" ? obj.SendMax : (obj.SendMax?.value ?? "0"),
        expiration,
        invoiceId: obj.InvoiceID,
        status,
      }
    })
  } finally {
    await client.disconnect()
  }
}

// Submit a pre-signed tx blob and wait for validation
export async function submitSignedTx(txBlob: string): Promise<string> {
  const client = getXrplClient()
  await client.connect()
  try {
    const result = await client.submitAndWait(txBlob)
    return result.result.hash as string
  } finally {
    await client.disconnect()
  }
}

// Convert XRP to drops (returns string)
export function xrpToDropsStr(xrp: number): string {
  return xrpToDrops(xrp.toString())
}

// Convert drops to XRP (returns number)
export function dropsToXrpNum(drops: string): number {
  return parseFloat(dropsToXrp(drops))
}
