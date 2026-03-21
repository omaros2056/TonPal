"use client"

import { useEffect, useState } from "react"
import {
  TonConnectUIProvider,
  TonConnectButton,
  useTonConnectUI,
  useTonAddress,
} from "@tonconnect/ui-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type SplitData = {
  merchant: string
  currency: string
  total: number
  organizer_wallet?: string
  splits: { handle: string; amount: number }[]
}

type Status =
  | "loading"
  | "no_split"
  | "no_username"
  | "not_found"
  | "clear"
  | "ready"
  | "paying"
  | "done"
  | "error"

// ─── Comment payload (BOC) ────────────────────────────────────────────────────

function buildCommentPayload(comment: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { beginCell } = require("ton-core")
    return (beginCell()
      .storeUint(0, 32)
      .storeStringTail(comment)
      .endCell()
      .toBoc() as Buffer)
      .toString("base64")
  } catch {
    return undefined
  }
}

// ─── Inner component (uses TON Connect hooks) ─────────────────────────────────

function PayInner({ splitId }: { splitId: string }) {
  const [tonConnectUI] = useTonConnectUI()
  const userAddress = useTonAddress()

  const [split, setSplit] = useState<SplitData | null>(null)
  const [entry, setEntry] = useState<{ handle: string; amount: number } | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>("loading")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Step 1 — identify user from Telegram WebApp
  useEffect(() => {
    if (typeof window === "undefined") return

    const devHandle = new URLSearchParams(window.location.search).get("handle")
    if (devHandle) { setUsername(devHandle); return }

    const tg = window.Telegram?.WebApp
    if (!tg) { setUsername("devuser"); return }

    tg.ready()
    tg.expand()

    const user = tg.initDataUnsafe?.user
    if (user?.username) {
      setUsername(user.username)
    } else {
      setStatus("no_username")
    }
  }, [])

  // Step 2 — fetch split from Supabase and find this user's entry
  useEffect(() => {
    if (!username) return

    async function load() {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

        const res = await fetch(
          `${supabaseUrl}/rest/v1/tonpal_splits?id=eq.${encodeURIComponent(splitId)}&select=data`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
          }
        )

        const rows: { data: SplitData }[] = await res.json()
        const splitData = rows?.[0]?.data
        if (!splitData) { setStatus("not_found"); return }

        setSplit(splitData)

        const handle = `@${username}`
        const found = splitData.splits.find(
          (s) => s.handle.toLowerCase() === handle.toLowerCase()
        )

        if (!found) { setStatus("clear"); return }

        setEntry(found)
        setStatus("ready")
      } catch {
        setStatus("error")
        setErrorMsg("Couldn't load split data.")
      }
    }

    load()
  }, [username, splitId])

  // Step 3 — send the transaction via TON Connect
  async function handlePay() {
    if (!split?.organizer_wallet || !entry) return
    setStatus("paying")
    setErrorMsg(null)

    const nanotons = String(Math.round(entry.amount * 1_000_000_000))
    const comment = `TonPal-${splitId.slice(-8)}`
    const payload = buildCommentPayload(comment)

    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: split.organizer_wallet,
            amount: nanotons,
            ...(payload ? { payload } : {}),
          },
        ],
      })
      setStatus("done")
    } catch (err: unknown) {
      setStatus("error")
      const msg = err instanceof Error ? err.message : "Transaction cancelled or failed."
      setErrorMsg(msg)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (status === "loading") {
    return (
      <Screen>
        <Spinner />
        <p className="text-sm text-gray-400">Loading your payment…</p>
      </Screen>
    )
  }

  if (status === "no_username") {
    return (
      <Screen>
        <span className="text-4xl">⚠️</span>
        <h2 className="text-lg font-semibold text-center">Username required</h2>
        <p className="text-sm text-gray-500 text-center">
          You need a Telegram username to use TonPal.
          <br />
          Set one in <strong>Settings → Edit Profile → Username</strong>.
        </p>
      </Screen>
    )
  }

  if (status === "not_found") {
    return (
      <Screen>
        <span className="text-5xl">❓</span>
        <h2 className="text-lg font-semibold">Split not found</h2>
        <p className="text-sm text-gray-400 text-center">This link may have expired.</p>
      </Screen>
    )
  }

  if (status === "clear") {
    return (
      <Screen>
        <span className="text-5xl">✅</span>
        <h2 className="text-xl font-bold">You&apos;re all clear!</h2>
        <p className="text-sm text-gray-400 text-center">
          You don&apos;t owe anything for <strong>{split?.merchant}</strong>.
        </p>
      </Screen>
    )
  }

  if (status === "done") {
    return (
      <Screen>
        <span className="text-5xl">🎉</span>
        <h2 className="text-xl font-bold">Payment sent!</h2>
        <p className="text-sm text-gray-400 text-center">
          Your transaction has been broadcast to the TON network.
        </p>
      </Screen>
    )
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--tg-theme-bg-color,#f0f4ff)]">
      <header className="px-4 pt-6 pb-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">TonPal</p>
        <h1 className="text-lg font-bold mt-0.5">{split?.merchant}</h1>
      </header>

      <main className="flex-1 flex flex-col gap-4 px-4 pb-8">
        {/* Amount card */}
        <div className="rounded-2xl bg-white border border-blue-100 shadow-sm px-5 py-5 text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Your share</p>
          <p className="text-4xl font-extrabold text-blue-600 mt-2 tabular-nums">
            {entry?.amount.toFixed(2)}
            <span className="text-xl font-semibold text-blue-400 ml-1">TON</span>
          </p>
          <p className="text-sm text-gray-400 mt-1">
            ≈ {split?.currency}{entry?.amount.toFixed(2)}
          </p>
        </div>

        {/* Recipient */}
        {split?.organizer_wallet && (
          <div className="rounded-xl bg-white border border-gray-100 px-4 py-3 flex items-center gap-2">
            <span className="text-base">📍</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 font-medium">Paying to</p>
              <p className="text-sm font-mono text-gray-700 truncate">
                {split.organizer_wallet.slice(0, 8)}…{split.organizer_wallet.slice(-6)}
              </p>
            </div>
          </div>
        )}

        {/* TON Connect button */}
        <div className="flex justify-center mt-2">
          <TonConnectButton />
        </div>

        {/* Pay button — only shown when wallet is connected */}
        {userAddress && status === "ready" && (
          <button
            onClick={handlePay}
            className="w-full py-4 rounded-2xl bg-blue-500 text-white font-bold text-base shadow-md active:scale-95 transition-transform mt-2"
          >
            Send {entry?.amount.toFixed(2)} TON
          </button>
        )}

        {status === "paying" && (
          <div className="w-full py-4 rounded-2xl bg-blue-100 text-blue-600 font-semibold text-center">
            <Spinner className="mx-auto mb-2" />
            Waiting for signature…
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 text-center">
            {errorMsg ?? "Something went wrong. Please try again."}
            <button
              onClick={() => setStatus("ready")}
              className="block mx-auto mt-2 text-xs underline text-red-400"
            >
              Try again
            </button>
          </div>
        )}

        {!userAddress && status === "ready" && (
          <p className="text-center text-xs text-gray-400 mt-1">
            Connect your wallet above to pay
          </p>
        )}
      </main>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-4 px-6 py-10 text-center">
      {children}
    </div>
  )
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-7 h-7 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin ${className}`}
    />
  )
}

// ─── Page entry point ─────────────────────────────────────────────────────────
// Reads splitId from:
//   1. Telegram WebApp start_param (when opened via t.me/bot/app?startapp=X)
//   2. ?id= query param (direct access / dev testing)

const MANIFEST_URL =
  process.env.NEXT_PUBLIC_TONCONNECT_MANIFEST_URL ??
  "https://ton-pal.vercel.app/tonconnect-manifest.json"

export default function PayEntryPage() {
  const [splitId, setSplitId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    // 1. Try Telegram start_param (from t.me/bot/app?startapp=SPLIT_ID)
    const tg = window.Telegram?.WebApp
    const startParam = tg?.initDataUnsafe?.start_param
    if (startParam) { setSplitId(startParam); return }

    // 2. Fallback: ?id= query param
    const urlId = new URLSearchParams(window.location.search).get("id")
    if (urlId) { setSplitId(urlId); return }
  }, [])

  if (!splitId) {
    return (
      <Screen>
        <Spinner />
        <p className="text-sm text-gray-400">Connecting to TonPal…</p>
      </Screen>
    )
  }

  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <PayInner splitId={splitId} />
    </TonConnectUIProvider>
  )
}
