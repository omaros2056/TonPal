"use client"

import { useState, useRef } from "react"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "photo" | "text"
type Step = "input" | "analyzing" | "participants" | "split_mode" | "result"
type SplitMode = "equal" | "items"

interface ReceiptItem {
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface ParsedReceipt {
  merchant: string
  currency: string
  total: number
  items: ReceiptItem[]
}

interface Participant {
  handle: string
}

interface Split {
  handle: string
  amount: number
  payLink: string
  deepLink?: string
}

// ─── Tonkeeper link ───────────────────────────────────────────────────────────

function buildPayLink(amount: number, splitId: string): string {
  const address =
    process.env.NEXT_PUBLIC_TON_COLLECTION_ADDRESS ??
    "UQDrjGwR-gN8b5wXdAqDrV5RUKnxZvbUk55rFe-8bfvb8xJt"
  const nanotons = Math.round(amount * 1_000_000_000).toString()
  const comment = encodeURIComponent(`TonPal-${splitId}`)
  return `https://app.tonkeeper.com/transfer/${address}?amount=${nanotons}&text=${comment}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SplitPage() {
  const [tab, setTab] = useState<Tab>("photo")
  const [step, setStep] = useState<Step>("input")
  const [description, setDescription] = useState("")
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([{ handle: "" }])
  const [splitMode, setSplitMode] = useState<SplitMode>("equal")
  const [itemAssignments, setItemAssignments] = useState<Record<number, string>>({})
  const [results, setResults] = useState<Split[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Photo select ────────────────────────────────────────────────────────────
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewImage(URL.createObjectURL(file))
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1]
      setImageBase64(b64)
    }
    reader.readAsDataURL(file)
  }

  // ── Analyze ─────────────────────────────────────────────────────────────────
  async function handleAnalyze() {
    setError(null)
    setStep("analyzing")
    try {
      const body = imageBase64
        ? { imageBase64 }
        : { text: description }

      const res = await fetch("/api/receipts/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? "Parse failed")
      setReceipt(json.data)
      setStep("participants")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setStep("input")
    }
  }

  // ── Participants ─────────────────────────────────────────────────────────────
  function addParticipant() {
    setParticipants((p) => [...p, { handle: "" }])
  }
  function updateHandle(i: number, value: string) {
    setParticipants((p) => p.map((x, j) => (j === i ? { handle: value } : x)))
  }
  function removeParticipant(i: number) {
    setParticipants((p) => p.filter((_, j) => j !== i))
  }

  // ── Compute split ────────────────────────────────────────────────────────────
  async function handleComputeSplit() {
    if (!receipt) return
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "satsplittestbot"
    const validHandles = participants.map((p) =>
      p.handle.startsWith("@") ? p.handle : `@${p.handle}`
    )

    let splits: Split[] = []
    const tempId = `${Date.now()}`

    if (splitMode === "equal") {
      const perPerson = receipt.total / validHandles.length
      splits = validHandles.map((handle) => ({
        handle,
        amount: perPerson,
        payLink: buildPayLink(perPerson, tempId),
      }))
    } else {
      const totals: Record<string, number> = {}
      for (const [idxStr, handle] of Object.entries(itemAssignments)) {
        const item = receipt.items[parseInt(idxStr)]
        if (item) totals[handle] = (totals[handle] ?? 0) + item.totalPrice
      }
      splits = Object.entries(totals).map(([handle, amount]) => ({
        handle,
        amount,
        payLink: buildPayLink(amount, tempId),
      }))
    }

    // Save to Supabase and get a real split ID
    try {
      const res = await fetch("/api/splits/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: receipt.merchant,
          currency,
          total: receipt.total,
          splits: splits.map((s) => ({ handle: s.handle, amount: s.amount })),
        }),
      })
      const json = await res.json()
      if (json.success) {
        const splitId: string = json.splitId
        splits = splits.map((s) => {
          const rawHandle = s.handle.replace(/^@/, "")
          return {
            ...s,
            payLink: buildPayLink(s.amount, splitId),
            deepLink: `https://t.me/${botUsername}?start=pay_${splitId}_${rawHandle}`,
          }
        })
      }
    } catch {
      // fallback: use temp ID, no deep links
    }

    setResults(splits)
    setStep("result")
  }

  function reset() {
    setStep("input")
    setPreviewImage(null)
    setImageBase64(null)
    setDescription("")
    setReceipt(null)
    setError(null)
    setParticipants([{ handle: "" }])
    setItemAssignments({})
    setResults([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const currency = receipt?.currency ?? "€"

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--tg-theme-bg-color,#f5f5f5)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        {step === "input" ? (
          <Link href="/miniapp" className="text-blue-500 text-sm font-medium">← Back</Link>
        ) : (
          <button onClick={reset} className="text-blue-500 text-sm font-medium">← Start over</button>
        )}
        <h1 className="text-base font-semibold">
          {step === "input" && "New Split"}
          {step === "analyzing" && "Analyzing..."}
          {step === "participants" && "Who's splitting?"}
          {step === "split_mode" && "How to split?"}
          {step === "result" && "Payment Links"}
        </h1>
      </header>

      <main className="flex-1 px-4 py-5 space-y-4">

        {/* ── Step: Input ────────────────────────────────────────────────── */}
        {step === "input" && (
          <>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
              {(["photo", "text"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t ? "bg-white text-blue-500 shadow-sm" : "text-gray-500"
                  }`}
                >
                  {t === "photo" ? "📸 Photo" : "✏️ Describe"}
                </button>
              ))}
            </div>

            {tab === "photo" && (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed border-gray-200 bg-white py-10 cursor-pointer active:bg-gray-50 transition-colors"
                >
                  {previewImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewImage} alt="Receipt" className="max-h-48 rounded-xl object-contain" />
                  ) : (
                    <>
                      <span className="text-4xl">🧾</span>
                      <p className="text-sm text-gray-500 text-center px-4">Tap to upload a receipt photo</p>
                      <p className="text-xs text-gray-400">JPG, PNG or HEIC</p>
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

            {tab === "text" && (
              <div className="space-y-3">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder='e.g. "Dinner was $85 for 4 people, steak $32, pasta $18..."'
                  rows={5}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400"
                />
                <button
                  onClick={handleAnalyze}
                  disabled={description.trim().length < 5}
                  className="w-full py-4 rounded-2xl bg-blue-500 text-white font-semibold text-base active:scale-95 transition-transform disabled:opacity-40"
                >
                  Parse & split →
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Step: Analyzing ───────────────────────────────────────────── */}
        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
            <div className="text-5xl animate-pulse">🤖</div>
            <div>
              <p className="text-base font-semibold">Reading your receipt...</p>
              <p className="text-sm text-gray-500 mt-1">Gemini AI is on it</p>
            </div>
          </div>
        )}

        {/* ── Step: Participants ────────────────────────────────────────── */}
        {step === "participants" && receipt && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-semibold">{receipt.merchant}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {currency}{receipt.total.toFixed(2)} · {receipt.items.length} items
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Who&apos;s splitting this?
              </p>
              {participants.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={p.handle}
                    onChange={(e) => updateHandle(i, e.target.value)}
                    placeholder="@username"
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  {participants.length > 1 && (
                    <button onClick={() => removeParticipant(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                  )}
                </div>
              ))}
              <button
                onClick={addParticipant}
                className="w-full py-2 rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 active:bg-gray-50"
              >
                + Add person
              </button>
            </div>

            <button
              onClick={() => setStep("split_mode")}
              disabled={participants.some((p) => !p.handle.trim())}
              className="w-full py-4 rounded-2xl bg-blue-500 text-white font-semibold text-base active:scale-95 transition-transform disabled:opacity-40"
            >
              Continue →
            </button>
          </>
        )}

        {/* ── Step: Split Mode ──────────────────────────────────────────── */}
        {step === "split_mode" && receipt && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Split method</p>
              <button
                onClick={() => setSplitMode("equal")}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                  splitMode === "equal" ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-gray-50"
                }`}
              >
                <div className="text-left">
                  <p className="text-sm font-medium">✅ Split equally</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {currency}{(receipt.total / participants.length).toFixed(2)} per person
                  </p>
                </div>
                {splitMode === "equal" && <span className="text-blue-500 text-lg">●</span>}
              </button>

              {receipt.items.length > 0 && (
                <button
                  onClick={() => setSplitMode("items")}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    splitMode === "items" ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <div className="text-left">
                    <p className="text-sm font-medium">✏️ Assign items</p>
                    <p className="text-xs text-gray-400 mt-0.5">Each person picks what they had</p>
                  </div>
                  {splitMode === "items" && <span className="text-blue-500 text-lg">●</span>}
                </button>
              )}
            </div>

            {/* Item assignment */}
            {splitMode === "items" && (
              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Who had what?</p>
                {receipt.items.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-gray-500">{currency}{item.totalPrice.toFixed(2)}</span>
                    </div>
                    <select
                      value={itemAssignments[idx] ?? ""}
                      onChange={(e) => setItemAssignments((a) => ({ ...a, [idx]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">— Select person —</option>
                      {participants.map((p) => {
                        const h = p.handle.startsWith("@") ? p.handle : `@${p.handle}`
                        return <option key={h} value={h}>{h}</option>
                      })}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleComputeSplit}
              className="w-full py-4 rounded-2xl bg-blue-500 text-white font-semibold text-base active:scale-95 transition-transform"
            >
              Generate payment links →
            </button>
          </>
        )}

        {/* ── Step: Result ──────────────────────────────────────────────── */}
        {step === "result" && receipt && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-semibold">{receipt.merchant}</p>
              <p className="text-sm text-gray-500">Total: {currency}{receipt.total.toFixed(2)}</p>
            </div>

            <div className="space-y-3">
              {results.map((s) => (
                <div key={s.handle} className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{s.handle}</p>
                    <p className="text-sm font-bold text-blue-600">{currency}{s.amount.toFixed(2)}</p>
                  </div>
                  <div className="flex gap-2">
                    {s.deepLink && (
                      <a
                        href={s.deepLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold text-center active:scale-95 transition-transform"
                      >
                        💬 Send request
                      </a>
                    )}
                    <a
                      href={s.payLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold text-center active:scale-95 transition-transform"
                    >
                      💎 Pay now
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={reset}
              className="w-full py-3 text-sm text-gray-400 underline underline-offset-2"
            >
              New split
            </button>
          </>
        )}
      </main>
    </div>
  )
}
