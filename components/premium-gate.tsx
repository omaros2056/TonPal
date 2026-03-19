"use client"

import { useEffect, useState } from "react"

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "x402_premium_unlocked"

// ─── Props ────────────────────────────────────────────────────────────────────

interface PremiumGateProps {
  onUnlocked: () => void
  amountTon?: number // default 0.01
}

// ─── Helper: build a TON payment deep link ────────────────────────────────────

function buildTonPayLink(address: string, amountTon: number): string {
  const nanotons = Math.round(amountTon * 1_000_000_000)
  return `ton://transfer/${address}?amount=${nanotons}&text=SatSplit%20Premium`
}

// ─── PremiumGate component ────────────────────────────────────────────────────

export default function PremiumGate({
  onUnlocked,
  amountTon = 0.01,
}: PremiumGateProps) {
  const [step, setStep] = useState<"idle" | "payment" | "unlocked">("idle")
  const isDemoMode = process.env.NEXT_PUBLIC_X402_ENABLED !== "true"

  const tonAddress =
    process.env.NEXT_PUBLIC_X402_TON_ADDRESS ??
    "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFp"

  const payLink = buildTonPayLink(tonAddress, amountTon)

  // Auto-unlock in demo mode on mount
  useEffect(() => {
    if (isDemoMode) {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, "true")
      }
      setStep("unlocked")
      onUnlocked()
    }
  }, [isDemoMode, onUnlocked])

  function handleUnlockClick() {
    setStep("payment")
  }

  function handlePaid() {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true")
    }
    setStep("unlocked")
    onUnlocked()
  }

  // ── Demo mode: show passive badge, already unlocked ───────────────────────
  if (isDemoMode) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        Premium (demo mode)
      </div>
    )
  }

  // ── Unlocked state ────────────────────────────────────────────────────────
  if (step === "unlocked") {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-green-50 border border-green-100 text-green-700 text-sm font-medium">
        <span className="text-base">✓</span>
        Premium unlocked
      </div>
    )
  }

  // ── Payment instructions step ─────────────────────────────────────────────
  if (step === "payment") {
    return (
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💎</span>
          <div>
            <p className="font-semibold text-sm">Pay {amountTon} TON</p>
            <p className="text-xs text-gray-500 mt-0.5">One-time micro-payment via TON</p>
          </div>
        </div>

        {/* TON address display */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Send to address
          </p>
          <p className="text-xs font-mono text-gray-700 break-all">{tonAddress}</p>
          <p className="text-[10px] text-gray-400">
            Amount: {amountTon} TON · Memo: SatSplit Premium
          </p>
        </div>

        {/* TON deep link button */}
        <a
          href={payLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-blue-500 text-white text-sm font-semibold active:scale-95 transition-transform"
        >
          <span>Open TON Wallet</span>
          <span className="text-xs opacity-80">↗</span>
        </a>

        <p className="text-xs text-gray-400 text-center">
          After sending, tap the button below to continue.
        </p>

        <button
          onClick={handlePaid}
          className="w-full py-3 rounded-2xl border-2 border-blue-200 text-blue-600 text-sm font-semibold active:scale-95 transition-transform"
        >
          I&apos;ve paid →
        </button>

        <button
          onClick={() => setStep("idle")}
          className="w-full text-xs text-gray-400 underline underline-offset-2"
        >
          Cancel
        </button>
      </div>
    )
  }

  // ── Idle state: feature card + unlock button ───────────────────────────────
  return (
    <div className="rounded-2xl bg-white border border-blue-100 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-lg">
          ✨
        </div>
        <div>
          <p className="font-semibold text-sm">Premium Parsing</p>
          <p className="text-xs text-gray-500">Powered by x402 · {amountTon} TON</p>
        </div>
      </div>

      {/* Feature list */}
      <ul className="space-y-2">
        {[
          "Unlimited line items",
          "Multi-currency receipts",
          "Handwritten receipt support",
          "Higher accuracy model",
        ].map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
            <span className="text-green-500 font-bold text-base leading-none">✓</span>
            {feature}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={handleUnlockClick}
        className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold text-sm active:scale-95 transition-transform shadow-sm shadow-blue-200"
      >
        Unlock for {amountTon} TON
      </button>

      <p className="text-[10px] text-gray-400 text-center leading-relaxed">
        Uses x402 protocol — pay once per session. No subscription.
      </p>
    </div>
  )
}
