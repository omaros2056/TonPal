// ENS name resolution via viem
// Resolves .eth names → address, avatar, text records

import { createPublicClient, http } from "viem"
import { mainnet } from "viem/chains"
import { normalize } from "viem/ens"
import type { EnsProfile } from "@/types"

const client = createPublicClient({
  chain: mainnet,
  transport: http(
    process.env.ETHEREUM_RPC_URL ?? "https://cloudflare-eth.com"
  ),
})

export async function resolveEnsName(name: string): Promise<EnsProfile | null> {
  if (!process.env.ENS_ENABLED || process.env.ENS_ENABLED === "false") {
    return null
  }

  try {
    const normalized = normalize(name)
    const [address, avatarUrl, tonAddress, telegramHandle] = await Promise.allSettled([
      client.getEnsAddress({ name: normalized }),
      client.getEnsAvatar({ name: normalized }),
      client.getEnsText({ name: normalized, key: "app.satsplit.ton-address" }),
      client.getEnsText({ name: normalized, key: "app.satsplit.telegram" }),
    ])

    return {
      name,
      address: address.status === "fulfilled" ? (address.value ?? undefined) : undefined,
      avatarUrl: avatarUrl.status === "fulfilled" ? (avatarUrl.value ?? undefined) : undefined,
      tonAddress: tonAddress.status === "fulfilled" ? (tonAddress.value ?? undefined) : undefined,
      telegramHandle: telegramHandle.status === "fulfilled" ? (telegramHandle.value ?? undefined) : undefined,
    }
  } catch {
    return null
  }
}

export function isEnsName(input: string): boolean {
  return input.endsWith(".eth") && input.length > 4
}
