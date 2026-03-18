"use client"

import { useEffect } from "react"

export default function MiniAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    // Initialize Telegram WebApp SDK
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready()
      window.Telegram.WebApp.expand()
    }
  }, [])

  return (
    <div className="min-h-screen bg-[var(--tg-bg-color,#ffffff)] text-[var(--tg-text-color,#000000)]">
      {children}
    </div>
  )
}

// Extend window type for Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void
        expand: () => void
        close: () => void
        initDataUnsafe: {
          user?: {
            id: number
            username?: string
            first_name: string
            last_name?: string
          }
        }
      }
    }
  }
}
