import { redirect } from "next/navigation"

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>

function buildQuery(sp: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams()
  for (const [key, val] of Object.entries(sp)) {
    if (val == null) continue
    if (Array.isArray(val)) {
      for (const v of val) q.append(key, v)
    } else {
      q.set(key, val)
    }
  }
  return q.toString()
}

/** Legacy URL: /category_ai → home with same query (e.g. ?shopBy=sector). */
export default async function CategoryAIRedirectPage({
  searchParams,
}: {
  searchParams?: SearchParamsInput
}) {
  const sp = await Promise.resolve(searchParams ?? {})
  const suffix = buildQuery(sp)
  redirect(suffix ? `/?${suffix}` : "/")
}
