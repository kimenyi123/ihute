import Link from "next/link"

export default function AdminGrandmaAgentsPage() {
  return (
    <div className="space-y-4">
      <Link href="/admin_grandma" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-bold text-white">Agents</h1>
      <p className="text-sm text-zinc-400">Placeholder — define agent model and table.</p>
    </div>
  )
}
