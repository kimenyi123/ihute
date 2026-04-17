import Link from "next/link"

export default function AdminGrandmaOrdersPage() {
  return (
    <div className="space-y-4">
      <Link href="/admin_grandma" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-bold text-white">Orders</h1>
      <p className="text-sm text-zinc-400">Placeholder — pipe Kaos orders or Next order store here.</p>
    </div>
  )
}
