"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface XrplCheckFlowProps {
  participantId: string
  splitSessionId: string
  participantName: string
  amountXrp: number
  participantXrpAddress: string
  onCommitted: (txHash: string) => void
}

type FlowStep = "idle" | "loading" | "qr" | "polling" | "done" | "error"

interface XummPayload {
  paymentRequestId: string
  xummQrUrl: string
  xummDeeplink: string
  xummWebUrl: string
  xummUuid: string
}

export function XrplCheckFlow({
  participantId,
  splitSessionId,
  participantName,
  amountXrp,
  participantXrpAddress,
  onCommitted,
}: XrplCheckFlowProps) {
  const [step, setStep] = useState<FlowStep>("idle")
  const [payload, setPayload] = useState<XummPayload | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Clean up interval on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  const startPolling = useCallback(
    (paymentRequestId: string) => {
      setStep("polling")
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/xrpl/checks/status/${paymentRequestId}`)
          const json = await res.json()
          if (!json.success) return // keep polling on transient errors

          const { xummSigned, xummCancelled, txHash: hash } = json.data

          if (xummCancelled) {
            stopPolling()
            setError("Sign request was cancelled in Xaman.")
            setStep("error")
            return
          }

          if (xummSigned && hash) {
            stopPolling()
            setTxHash(hash)
            setStep("done")
            onCommitted(hash)
          }
        } catch {
          // network error — keep polling
        }
      }, 5000)
    },
    [onCommitted, stopPolling]
  )

  const handleCommit = async () => {
    setStep("loading")
    setError(null)

    try {
      const res = await fetch("/api/xrpl/checks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          splitSessionId,
          participantId,
          participantXrpAddress,
          amountXrp,
          participantName,
        }),
      })

      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error ?? "Unknown error from /api/xrpl/checks/create")
      }

      const data: XummPayload = json.data
      setPayload(data)
      setStep("qr")
      startPolling(data.paymentRequestId)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
      setStep("error")
    }
  }

  const networkLabel =
    process.env.NEXT_PUBLIC_XRPL_NETWORK === "mainnet" ? "mainnet" : "testnet"
  const explorerBase =
    networkLabel === "mainnet"
      ? "https://livenet.xrpl.org/transactions"
      : "https://testnet.xrpl.org/transactions"

  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-gray-900">Commit via XRPL Check</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          {participantName} &mdash; {amountXrp} XRP
        </p>
      </div>

      {/* Step: idle */}
      {step === "idle" && (
        <button
          onClick={handleCommit}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 active:scale-95 transition-transform"
        >
          Commit via XRPL Check
        </button>
      )}

      {/* Step: loading */}
      {step === "loading" && (
        <div className="flex items-center justify-center py-6 gap-2 text-sm text-gray-500">
          <svg
            className="animate-spin h-4 w-4 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          Creating sign request…
        </div>
      )}

      {/* Step: qr / polling */}
      {(step === "qr" || step === "polling") && payload && (
        <div className="space-y-3">
          {/* QR Code */}
          <div className="flex justify-center">
            <img
              src={payload.xummQrUrl}
              alt="Xaman QR code"
              width={200}
              height={200}
              className="rounded-xl border border-gray-100"
            />
          </div>

          {/* Deeplink button */}
          <a
            href={payload.xummDeeplink}
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Open in Xaman
          </a>

          {/* Also show web URL as fallback */}
          <p className="text-center text-xs text-gray-400">
            Or{" "}
            <a
              href={payload.xummWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600"
            >
              open in browser
            </a>
          </p>

          {step === "polling" && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 pt-1">
              <svg
                className="animate-spin h-3 w-3 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Waiting for signature…
            </div>
          )}
        </div>
      )}

      {/* Step: done */}
      {step === "done" && txHash && (
        <div className="space-y-3 text-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-3xl">✓</span>
            <p className="text-sm font-semibold text-green-700">Committed!</p>
            <p className="text-xs text-gray-500">
              Your XRPL Check has been created on the {networkLabel}.
            </p>
          </div>
          <a
            href={`${explorerBase}/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            View on XRPL Explorer
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      )}

      {/* Step: error */}
      {step === "error" && (
        <div className="space-y-3">
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error ?? "Something went wrong."}
          </p>
          <button
            onClick={() => {
              setStep("idle")
              setError(null)
              setPayload(null)
            }}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
