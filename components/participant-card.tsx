'use client'

import type { Participant } from '@/types'

interface ParticipantCardProps {
  participant: Participant
  amount: number
  status: 'pending' | 'paid' | 'overdue'
  rail?: 'ton' | 'xrpl'
  paymentLink?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-rose-400',
  'bg-amber-400',
  'bg-lime-500',
  'bg-emerald-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-pink-500',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ParticipantCardProps['status'] }) {
  const styles = {
    pending:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  } as const

  const labels = {
    pending: 'Pending',
    paid: 'Paid',
    overdue: 'Overdue',
  } as const

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  )
}

function RailBadge({ rail }: { rail: 'ton' | 'xrpl' }) {
  const styles = {
    ton: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
    xrpl: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
  } as const

  const labels = {
    ton: 'Paid via TON',
    xrpl: 'Settled via XRPL',
  } as const

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[rail]}`}
    >
      {labels[rail]}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ParticipantCard({
  participant,
  amount,
  status,
  rail,
  paymentLink,
}: ParticipantCardProps) {
  const { displayName, ensName, satsplitSubname, avatarUrl } = participant

  const showEnsName = ensName && ensName !== displayName
  const showPayButton = status === 'pending' && Boolean(paymentLink)

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Avatar */}
      <div className="shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(displayName)}`}
          >
            {getInitial(displayName)}
          </div>
        )}
      </div>

      {/* Identity */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {displayName}
          </span>

          {showEnsName && (
            <span className="truncate font-mono text-xs text-gray-400">
              {ensName}
            </span>
          )}

          {satsplitSubname && (
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
              {satsplitSubname}
            </span>
          )}
        </div>

        {/* Status + rail badges */}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <StatusBadge status={status} />
          {status === 'paid' && rail && <RailBadge rail={rail} />}
        </div>
      </div>

      {/* Amount + action */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-sm font-bold text-gray-900 dark:text-white">
          €{amount.toFixed(2)}
        </span>

        {showPayButton && (
          <a
            href={paymentLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 active:scale-95"
          >
            Pay
          </a>
        )}
      </div>
    </div>
  )
}

export default ParticipantCard
