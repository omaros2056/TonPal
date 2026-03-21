"use client"

import { useEffect } from "react"
import Link from "next/link"
import type { SplitSession } from "@/types"

// Placeholder recent splits for UI scaffold
const PLACEHOLDER_SPLITS: (Pick<SplitSession, "id" | "status" | "createdAt"> & {
  label: string
  total: string
  participants: number
})[] = [
  {
    id: "split-001",
    label: "Dinner at La Piazza",
    total: "€84.00",
    participants: 4,
    status: "settled",
    createdAt: "2026-03-18T20:30:00Z",
  },
  {
    id: "split-002",
    label: "Taxi to airport",
    total: "€36.50",
    participants: 3,
    status: "active",
    createdAt: "2026-03-17T08:15:00Z",
  },
  {
    id: "split-003",
    label: "Groceries run",
    total: "€52.20",
    participants: 2,
    status: "draft",
    createdAt: "2026-03-16T14:00:00Z",
  },
]

const STATUS_STYLES: Record<SplitSession["status"], string> = {
  draft: "bg-gray-100 text-gray-500",
  active: "bg-blue-100 text-blue-700",
  settled: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-500",
}

function TonLogo() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="TON"
    >
      <circle cx="28" cy="28" r="28" fill="#0098EA" />
      <path
        d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6928 19.4118 14.4512 22.4459L26.2966 43.0756C27.0857 44.4422 29.0591 44.4422 29.8482 43.0756L41.5937 22.4459C43.3521 19.4118 41.1761 15.6277 37.5603 15.6277Z"
        fill="white"
      />
    </svg>
  )
}

export default function MiniAppPage() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready()
      window.Telegram.WebApp.expand()
    }
  }, [])

  const user =
    typeof window !== "undefined"
      ? window.Telegram?.WebApp?.initDataUnsafe?.user
      : undefined

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--tg-theme-bg-color,#f5f5f5)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold select-none">
            S
          </div>
          <h1 className="text-base font-semibold tracking-tight">TonPal</h1>
        </div>
        <TonLogo />
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-5 space-y-5">
        {/* Greeting */}
        {user && (
          <p className="text-sm text-gray-500">
            Hey, {user.first_name} 👋
          </p>
        )}

        {/* Primary CTA */}
        <Link
          href="/miniapp/split"
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-blue-500 text-white font-semibold text-base shadow-sm active:scale-95 transition-transform"
        >
          <span>✂️</span>
          <span>Split a bill</span>
        </Link>

        {/* Recent splits */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Recent splits
          </h2>
          <ul className="space-y-2">
            {PLACEHOLDER_SPLITS.map((split) => (
              <li key={split.id}>
                <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{split.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {split.participants} people ·{" "}
                      {new Date(split.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                    <span className="text-sm font-semibold">{split.total}</span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
                        STATUS_STYLES[split.status]
                      }`}
                    >
                      {split.status}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* Bottom navigation */}
      <nav className="flex items-center border-t border-gray-100 bg-white sticky bottom-0">
        <Link
          href="/miniapp"
          className="flex-1 flex flex-col items-center py-3 gap-0.5 text-blue-500"
          aria-current="page"
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
