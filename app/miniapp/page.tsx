"use client"

export default function MiniAppPage() {
  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-sm font-bold">S</div>
        <h1 className="text-lg font-semibold">SatSplit</h1>
      </header>

      <div className="rounded-xl bg-gray-50 border border-gray-200 p-6 text-center space-y-2">
        <p className="text-sm text-gray-500">Start a new split</p>
        <p className="text-xs text-gray-400">Send a receipt photo to the bot or type an amount</p>
      </div>
    </div>
  )
}
