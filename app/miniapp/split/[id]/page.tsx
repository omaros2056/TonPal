"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { SplitBoard } from "@/components/split-board"

export default function SplitDetailPage() {
  const params = useParams()
  const splitId = params?.id as string

  const [polling, setPolling] = useState(false)
  const [pollResult, setPollResult] = useState<{
    confirmed: string[]
    total: number
  } | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)

  const [copied, setCopied] = useState(false)

  async function handlePollPayments() {
    if (!splitId || polling) return
    setPolling(true)
    setPollError(null)
    setPollResult(null)

    try {
      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ splitSessionId: splitId, rail: "ton" }),
      })
      const json = await res.json()
      if (!json.success) {
        setPollError(json.error ?? "Polling failed")
      } else {
        setPollResult(json.data)
      }
    } catch (e: any) {
      setPollError(e.message ?? "Network error")
    } finally {
      setPolling(false)
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/miniapp/split/${splitId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "SatSplit", url })
      }
    }
  }

  if (!splitId) {
    return (
      <div className="flex items-center justify-center min-h-dvh text-gray-400">
        Invalid split link.
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--tg-theme-bg-color,#f5f5f5)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        <Link
          href="/miniapp"
          className="text-blue-500 text-sm font-medium"
          aria-label="Back"
        >
          Back
        </Link>
        <h1 className="text-base font-semibold flex-1">Split Details</h1>

        {/* Share button */}
        <button
          onClick={handleShare}
          className="text-sm font-medium text-blue-500 px-3 py-1.5 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 transition-colors"
        >
          {copied ? "Copied!" : "Share"}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-28">
        {/* Status board */}
        <SplitBoard splitId={splitId} />

        {/* Poll for payments section */}
        <div className="max-w-lg mx-auto px-4 pt-2 pb-4 flex flex-col gap-3">
          <button
            onClick={handlePollPayments}
            disabled={polling}
            className="w-full py-3 rounded-2xl bg-blue-500 text-white font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {polling ? "Checking for payments..." : "Poll for payments"}
          </button>

          {pollError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              Error: {pollError}
            </div>
          )}

          {pollResult && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              {pollResult.total === 0
                ? "No new payments found."
                : `${pollResult.total} payment${pollResult.total > 1 ? "s" : ""} confirmed!`}
            </div>
          )}

          {/* Deep link / share section */}
          <div className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 break-all">
            <p className="font-medium text-gray-700 mb-1">Share this split</p>
            <p className="text-xs text-gray-500">
              {typeof window !== "undefined"
                ? `${window.location.origin}/miniapp/split/${splitId}`
                : `/miniapp/split/${splitId}`}
            </p>
          </div>
        </div>
      </main>

      {/* Bottom navigation */}
      <nav className="flex items-center border-t border-gray-100 bg-white sticky bottom-0">
        <Link
          href="/miniapp"
          className="flex-1 flex flex-col items-center py-3 gap-0.5 text-gray-400"
        >
          <span className="text-lg leading-none">🏠</span>
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link
          href="/miniapp/split"
          className="flex-1 flex flex-col items-center py-3 gap-0.5 text-gray-400"
        >
          <span className="text-lg leading-none">✂️</span>
          <span className="text-[10px] font-medium">New Split</span>
        </Link>
        <Link
          href="/miniapp/history"
          className="flex-1 flex flex-col items-center py-3 gap-0.5 text-gray-400"
        >
          <span className="text-lg leading-none">📋</span>
          <span className="text-[10px] font-medium">History</span>
        </Link>
      </nav>
    </div>
  )
}
