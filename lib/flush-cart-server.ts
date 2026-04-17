/**
 * Push cart to the backend immediately (bypasses CartSyncEffect debounce).
 * Call after checkout so server cart matches cleared local state before navigation.
 */
export async function flushCartToServer(userId: string, items: unknown[]): Promise<void> {
  const id = userId.trim()
  if (!id) return
  try {
    await fetch("/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id, items }),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    // best-effort
  }
}
