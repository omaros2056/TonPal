// XRPL Checks — CheckCreate / CheckCash / CheckCancel
// Uses xrpl.js library

import { Client, Wallet, xrpToDrops, dropsToXrp } from "xrpl"
import type { CheckCreate, CheckCash, CheckCancel } from "xrpl"
import type { XrplCheckState } from "@/types"

const XRPL_NETWORKS = {
  testnet: "wss://s.altnet.rippletest.net:51233",
  mainnet: "wss://xrplcluster.com",
}

export function getXrplClient(): Client {
  const network = (process.env.XRPL_NETWORK ?? "testnet") as keyof typeof XRPL_NETWORKS
  return new Client(XRPL_NETWORKS[network])
}

// Build a CheckCreate transaction (unsigned — to be signed by participant via Xumm)
export function buildCheckCreate({
  participantXrpAddress,
  organizerXrpAddress,
  xrpAmount,
  invoiceId,
  expiryDays = 7,
}: {
  participantXrpAddress: string
  organizerXrpAddress: string
  xrpAmount: string
  invoiceId: string  // splitId + participantId (hex)
  expiryDays?: number
}): CheckCreate {
  const expirySeconds = Math.floor(Date.now() / 1000) + expiryDays * 24 * 3600
  // XRPL epoch starts 2000-01-01, Unix epoch starts 1970-01-01 (diff: 946684800)
  const rippleExpiry = expirySeconds - 946684800

  return {
    TransactionType: "CheckCreate",
    Account: participantXrpAddress,
    Destination: organizerXrpAddress,
    SendMax: xrpToDrops(xrpAmount),
    Expiration: rippleExpiry,
    InvoiceID: Buffer.from(invoiceId).toString("hex").toUpperCase().padEnd(64, "0"),
  }
}

// Build a CheckCash transaction (signed by organizer server-side)
export function buildCheckCash({
  organizerXrpAddress,
  checkId,
  xrpAmount,
}: {
  organizerXrpAddress: string
  checkId: string
  xrpAmount: string
}): CheckCash {
  return {
    TransactionType: "CheckCash",
    Account: organizerXrpAddress,
    CheckID: checkId,
    Amount: xrpToDrops(xrpAmount),
  }
}

// Build a CheckCancel transaction
export function buildCheckCancel({
  accountAddress,
  checkId,
}: {
  accountAddress: string
  checkId: string
}): CheckCancel {
  return {
    TransactionType: "CheckCancel",
    Account: accountAddress,
    CheckID: checkId,
  }
}

// Submit a signed transaction using the organizer's server-side wallet
export async function submitSignedTx(txBlob: string): Promise<string> {
  const client = getXrplClient()
  await client.connect()
  try {
    const result = await client.submitAndWait(txBlob)
    return (result.result.hash as string)
  } finally {
    await client.disconnect()
  }
}

// Get check state from ledger
export async function getCheckState(checkId: string): Promise<XrplCheckState | null> {
  const client = getXrplClient()
  await client.connect()
  try {
    const response = await client.request({
      command: "ledger_entry",
      check: checkId,
      ledger_index: "current",
    })
    return response.result.node ? "created" : null
  } catch (e: any) {
    if (e?.data?.error === "entryNotFound") return null
    throw e
  } finally {
    await client.disconnect()
  }
}
