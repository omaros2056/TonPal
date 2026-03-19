"use client"

import { useEffect, useState, useCallback } from "react"
import type { SplitSession, Participant, PaymentRequest, PaymentReceipt, PaymentStatus } from "@/types"

type StatusData = {
  split: SplitSession
  participants: Participant[]
  paymentRequests: PaymentRequest[]
  receipts: PaymentReceipt[]
}

type ParticipantWithRequest = {
  participant: Participant
  request?: PaymentRequest
  receipt?: PaymentReceipt
}

const STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  committed: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-500",
}

const STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  committed: "Committed",
  confirmed: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
}

const RAIL_COLORS: Record<string, string> = {
  ton: "bg-blue-500 text-white",
  xrpl: "bg-indigo-500 text-white",
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function RailBadge({ rail }: { rail: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${RAIL_COLORS[rail] ?? "bg-gray-200 text-gray-700"}`}
    >
      {rail.toUpperCase()}
    </span>
  )
}

function ParticipantCard({ data }: { data: ParticipantWithRequest }) {
  const { participant, request, receipt } = data

  const displayId =
    participant.ensName ??
    participant.satsplitSubname ??
    participant.handle ??
    participant.displayName

  const isPaid = request?.status === "confirmed"
  const hasLink = request && ["pending", "committed"].includes(request.status)

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-2 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{participant.displayName}</span>
          {displayId !== participant.displayName && (
            <span className="text-xs text-gray-500">{displayId}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {request && <StatusBadge status={request.status} />}
          {receipt && <RailBadge rail={receipt.rail} />}
        </div>
      </div>

      {request && (
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gray-800">
              {request.amount.toFixed(2)}
              {" "}
              <span className="text-sm font-normal text-gray-500">
                {request.amountNative != null
                  ? `≈ ${request.amountNative.toFixed(4)} ${request.rail === "ton" ? "TON" : "XRP"}`
                  : ""}
              </span>
            </span>
          </div>

          {hasLink && (
            <a
              href={request.paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Pay
            </a>
          )}
        </div>
      )}

      {!request && (
        <span className="text-sm text-gray-400 italic">No payment request</span>
      )}
    </div>
  )
}

export function SplitBoard({ splitId }: { splitId: string }) {
  const [data, setData] = useState<StatusData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/splits/${splitId}/status`)
      const json = await res.json()
      if (!json.success) {
        setError(json.error ?? "Failed to load split")
        return
      }
      setData(json.data)
      setError(null)
    } catch (e: any) {
      setError(e.message ?? "Network error")
    } finally {
      setLoading(false)
    }
  }, [splitId])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10_000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const handleShare = async () => {
    const url = `${window.location.origin}/split/${splitId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: open native share sheet if available
      if (navigator.share) {
        await navigator.share({ title: "SatSplit", url })
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-400">
        Loading split...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-12 text-red-500">
        Error: {error}
      </div>
    )
  }

  if (!data) return null

  const { split, participants, paymentRequests, receipts } = data

  // Build per-participant composite
  const cards: ParticipantWithRequest[] = participants.map((p) => {
    const request = paymentRequests.find((pr) => pr.participantId === p.id)
    const receipt = request
      ? receipts.find((r) => r.paymentRequestId === request.id)
      : undefined
    return { participant: p, request, receipt }
  })

  const paidCount = paymentRequests.filter((pr) =>
    ["confirmed", "committed"].includes(pr.status)
  ).length
  const totalCount = paymentRequests.length || participants.length
  const progressPct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Split</h2>
          {split.receiptData?.merchant && (
            <p className="text-sm text-gray-500">{split.receiptData.merchant}</p>
          )}
        </div>
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
        >
          {copied ? "Copied!" : "Share split"}
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{paidCount} of {totalCount} paid</span>
          <span>{progressPct}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Participant cards */}
      <div className="flex flex-col gap-3">
        {cards.map(({ participant, request, receipt }) => (
          <ParticipantCard
            key={participant.id}
            data={{ participant, request, receipt }}
          />
        ))}
      </div>
    </div>
  )
}

export default SplitBoard
