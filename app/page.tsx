export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold text-brand">SatSplit AI</h1>
        <p className="text-gray-500">
          Group expense splitting for Telegram.<br />
          TON payments · ENS identity · XRPL commitment
        </p>
        <div className="text-sm text-gray-400 mt-8">
          Open via Telegram bot: <strong>@SatSplitBot</strong>
        </div>
      </div>
    </main>
  )
}
