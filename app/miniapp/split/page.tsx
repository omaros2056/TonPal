"use client"

import { useState, useRef } from "react"
import Link from "next/link"

type Tab = "photo" | "text"
type Step = "input" | "analyzing" | "preview"

const FAKE_SPLIT_PREVIEW = {
  merchant: "La Piazza Ristorante",
  total: 84.0,
  currency: "EUR",
  participants: ["You", "Alice", "Bob", "Charlie"],
  perPerson: 21.0,
}

export default function SplitPage() {
  const [activeTab, setActiveTab] = useState<Tab>("photo")
  const [step, setStep] = useState<Step>("input")
  const [description, setDescription] = useState("")
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewImage(url)
  }

  function handleAnalyze() {
    setStep("analyzing")
    // Stub: simulate async analysis (task 003 will implement real AI parsing)
    setTimeout(() => {
      setStep("preview")
    }, 2000)
  }

  function handleReset() {
    setStep("input")
    setPreviewImage(null)
    setDescription("")
    if (fileInputRef.current) fileInputRef.current.value = ""
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
          ← Back
        </Link>
        <h1 className="text-base font-semibold">New Split</h1>
      </header>

      <main className="flex-1 px-4 py-5 space-y-4">
        {/* ── Step 1: Input ─────────────────────────────────────────────── */}
        {step === "input" && (
          <>
            {/* Tabs */}
            <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
              <button
                onClick={() => setActiveTab("photo")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "photo"
                    ? "bg-white text-blue-500 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                📸 Photo
              </button>
              <button
                onClick={() => setActiveTab("text")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "text"
                    ? "bg-white text-blue-500 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                ✏️ Describe
              </button>
            </div>

            {/* Photo tab */}
            {activeTab === "photo" && (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed border-gray-200 bg-white py-10 cursor-pointer active:bg-gray-50 transition-colors"
                >
                  {previewImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewImage}
                      alt="Receipt preview"
                      className="max-h-48 rounded-xl object-contain"
                    />
                  ) : (
                    <>
                      <span className="text-4xl">🧾</span>
                      <p className="text-sm text-gray-500 text-center px-4">
                        Tap to upload a receipt photo
                      </p>
                      <p className="text-xs text-gray-400">
                        JPG, PNG or HEIC
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                {previewImage && (
                  <button
                    onClick={handleAnalyze}
                    className="w-full py-4 rounded-2xl bg-blue-500 text-white font-semibold text-base active:scale-95 transition-transform"
                  >
                    Analyze receipt →
                  </button>
                )}
              </div>
            )}

            {/* Text tab */}
            {activeTab === "text" && (
              <div className="space-y-3">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={'e.g. "Dinner was €85 for 4 people, Alice paid"'}
                  rows={4}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400"
                />
                <button
                  onClick={handleAnalyze}
                  disabled={description.trim().length < 5}
                  className="w-full py-4 rounded-2xl bg-blue-500 text-white font-semibold text-base active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create split →
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Step 2: Analyzing ─────────────────────────────────────────── */}
        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center gap-5 py-16 text-center">
            <div className="text-5xl animate-pulse">🤖</div>
            <div>
              <p className="text-base font-semibold">Analyzing...</p>
              <p className="text-sm text-gray-500 mt-1">
                AI is parsing your{" "}
                {activeTab === "photo" ? "receipt" : "description"}
              </p>
            </div>
            <div className="w-48 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full animate-[loading_2s_ease-in-out_forwards]" />
            </div>
            <p className="text-xs text-gray-400">
              Real AI parsing coming in the next update
            </p>
          </div>
        )}

        {/* ── Step 3: Split Preview ─────────────────────────────────────── */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{FAKE_SPLIT_PREVIEW.merchant}</p>
                <span className="text-xs text-gray-400 bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">
                  Parsed
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                <span className="text-sm text-gray-500">Total</span>
                <span className="font-semibold">
                  {FAKE_SPLIT_PREVIEW.currency} {FAKE_SPLIT_PREVIEW.total.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Split {FAKE_SPLIT_PREVIEW.participants.length} ways</span>
                <span className="font-semibold text-blue-600">
                  {FAKE_SPLIT_PREVIEW.currency}{" "}
                  {FAKE_SPLIT_PREVIEW.perPerson.toFixed(2)} / person
                </span>
              </div>
            </div>

            {/* Participants */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Participants
              </p>
              <ul className="space-y-2">
                {FAKE_SPLIT_PREVIEW.participants.map((name) => (
                  <li key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-500">
                        {name[0]}
                      </div>
                      <span className="text-sm">{name}</span>
                    </div>
                    <span className="text-sm font-medium">
                      {FAKE_SPLIT_PREVIEW.currency} {FAKE_SPLIT_PREVIEW.perPerson.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Placeholder action — real payment links come in task 004 */}
            <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700 text-center">
              Payment links (TON / XRPL) will be generated in the next update.
            </div>

            <button
              className="w-full py-4 rounded-2xl bg-blue-500 text-white font-semibold text-base active:scale-95 transition-transform"
              onClick={() =>
                typeof window !== "undefined" &&
                window.Telegram?.WebApp?.showAlert(
                  "Split confirmed! Payment collection coming soon."
                )
              }
            >
              Confirm split ✓
            </button>

            <button
              onClick={handleReset}
              className="w-full py-3 text-sm text-gray-400 underline underline-offset-2"
            >
              Start over
            </button>
          </div>
        )}
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
          className="flex-1 flex flex-col items-center py-3 gap-0.5 text-blue-500"
          aria-current="page"
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
