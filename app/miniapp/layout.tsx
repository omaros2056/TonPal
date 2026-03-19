import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "SatSplit",
  description: "Split group expenses — powered by AI, settled on TON & XRPL",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function MiniAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Telegram Mini App SDK — must load before any WebApp calls */}
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          // Telegram theme CSS variables with sensible fallbacks
          backgroundColor: "var(--tg-theme-bg-color, #ffffff)",
          color: "var(--tg-theme-text-color, #000000)",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          minHeight: "100dvh",
        }}
      >
        {children}
      </body>
    </html>
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
        showAlert: (message: string, callback?: () => void) => void
        MainButton: {
          text: string
          show: () => void
          hide: () => void
          enable: () => void
          disable: () => void
          onClick: (callback: () => void) => void
        }
        initDataUnsafe: {
          user?: {
            id: number
            username?: string
            first_name: string
            last_name?: string
          }
          start_param?: string
        }
        themeParams: {
          bg_color?: string
          text_color?: string
          hint_color?: string
          link_color?: string
          button_color?: string
          button_text_color?: string
          secondary_bg_color?: string
        }
      }
    }
  }
}
