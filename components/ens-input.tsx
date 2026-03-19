'use client'

import { useState, useEffect, useRef } from 'react'

interface EnsResolvedResult {
  name: string
  address: string
  avatar: string | null
  tonAddress: string | null
}

interface EnsInputProps {
  onResolved: (result: EnsResolvedResult) => void
  placeholder?: string
}

type ResolveState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'resolved'; result: EnsResolvedResult }
  | { status: 'error'; message: string }

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function EnsInput({ onResolved, placeholder = 'Enter .eth name' }: EnsInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [state, setState] = useState<ResolveState>({ status: 'idle' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = inputValue.trim()

    if (!trimmed || !trimmed.endsWith('.eth')) {
      setState({ status: 'idle' })
      return
    }

    const label = trimmed.slice(0, trimmed.lastIndexOf('.eth'))
    if (label.length < 3) {
      setState({ status: 'idle' })
      return
    }

    setState({ status: 'loading' })

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ens/resolve/${encodeURIComponent(trimmed)}`)
        const json = await res.json()

        if (!res.ok || !json.success) {
          setState({ status: 'error', message: 'Name not found' })
          return
        }

        const data = json.data as {
          address: string
          avatar: string | null
          displayName: string | null
          tonAddress: string | null
        }

        const resolved: EnsResolvedResult = {
          name: trimmed,
          address: data.address,
          avatar: data.avatar,
          tonAddress: data.tonAddress,
        }

        setState({ status: 'resolved', result: resolved })
        onResolved(resolved)
      } catch {
        setState({ status: 'error', message: 'Name not found' })
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [inputValue]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full space-y-2">
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-10 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
        {state.status === 'loading' && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="h-4 w-4 animate-spin text-indigo-500"
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
          </span>
        )}
      </div>

      {state.status === 'error' && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <span>⚠</span>
          <span>{state.message}</span>
        </p>
      )}

      {state.status === 'resolved' && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
          {/* Avatar */}
          {state.result.avatar ? (
            <img
              src={state.result.avatar}
              alt={state.result.name}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
              {state.result.name.slice(0, 2).toUpperCase()}
            </div>
          )}

          {/* Name + address */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {state.result.name}
            </p>
            <p className="truncate font-mono text-xs text-gray-400">
              {truncateAddress(state.result.address)}
            </p>
          </div>

          {/* TON address badge */}
          {state.result.tonAddress ? (
            <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-200">
              TON linked
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
              No TON — add manually
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default EnsInput
