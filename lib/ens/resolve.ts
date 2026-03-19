// ENS name resolution via viem
// Resolves .eth names → address, avatar, text records

import { createPublicClient, http } from "viem"
import { mainnet } from "viem/chains"
import { normalize } from "viem/ens"

const client = createPublicClient({
  chain: mainnet,
  transport: http(
    process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ?? "https://cloudflare-eth.com"
  ),
})

export async function resolveEns(name: string): Promise<{
  address: string | null
  avatar: string | null
  displayName: string | null
  tonAddress: string | null
  telegramHandle: string | null
  splitsPaid: number | null
}> {
  const empty = {
    address: null,
    avatar: null,
    displayName: null,
    tonAddress: null,
    telegramHandle: null,
    splitsPaid: null,
  }

  try {
    const normalized = normalize(name)

    const [address, avatar, tonAddress, telegramHandle, splitsPaid] =
      await Promise.allSettled([
        client.getEnsAddress({ name: normalized }),
        client.getEnsAvatar({ name: normalized }),
        client.getEnsText({ name: normalized, key: "app.satsplit.ton-address" }),
        client.getEnsText({ name: normalized, key: "app.satsplit.telegram" }),
        client.getEnsText({ name: normalized, key: "app.satsplit.splits-paid" }),
      ])

    const resolvedAddress =
      address.status === "fulfilled" ? (address.value ?? null) : null

    if (!resolvedAddress) {
      return empty
    }

    const splitsPaidRaw =
      splitsPaid.status === "fulfilled" ? splitsPaid.value : null
    const splitsPaidNum =
      splitsPaidRaw != null ? parseInt(splitsPaidRaw, 10) : null

    return {
      address: resolvedAddress,
      avatar:
        avatar.status === "fulfilled" ? (avatar.value ?? null) : null,
      displayName: name,
      tonAddress:
        tonAddress.status === "fulfilled" ? (tonAddress.value ?? null) : null,
      telegramHandle:
        telegramHandle.status === "fulfilled"
          ? (telegramHandle.value ?? null)
          : null,
      splitsPaid:
        splitsPaidNum != null && !isNaN(splitsPaidNum) ? splitsPaidNum : null,
    }
  } catch {
    return empty
  }
}

export async function getEnsName(address: string): Promise<string | null> {
  try {
    const name = await client.getEnsName({
      address: address as `0x${string}`,
    })
    return name ?? null
  } catch {
    return null
  }
}

export function isValidEnsName(name: string): boolean {
  if (!name.endsWith(".eth")) return false
  const label = name.slice(0, name.lastIndexOf(".eth"))
  return label.length >= 3
}

// ─── Legacy compatibility exports ─────────────────────────────────────────────
// Kept so existing API route (resolve/[name]/route.ts) still compiles.

import type { EnsProfile } from "@/types"

export async function resolveEnsName(name: string): Promise<EnsProfile | null> {
  const result = await resolveEns(name)
  if (!result.address) return null
  return {
    name,
    address: result.address ?? undefined,
    avatarUrl: result.avatar ?? undefined,
    tonAddress: result.tonAddress ?? undefined,
    telegramHandle: result.telegramHandle ?? undefined,
    splitsPaid: result.splitsPaid ?? undefined,
  }
}

export function isEnsName(input: string): boolean {
  return isValidEnsName(input)
}
