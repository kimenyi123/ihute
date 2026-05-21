"use client"

import { useEffect } from "react"

export default function GrandmaPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Grandma page runtime error:", error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl font-semibold text-slate-900">Something went wrong on this page</h2>
      <p className="text-sm text-slate-600">
        The payment screen hit an unexpected error. You can retry without reloading the whole app.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
      >
        Retry page
      </button>
    </div>
  )
}
