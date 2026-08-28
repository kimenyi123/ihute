import { Suspense } from "react"
import { UmuriroBoarding } from "@/components/umuriro-boarding"
import { resolveUmuriroGqInitial } from "@/lib/umuriro-gq-initial"

export const metadata = {
  title: "Quick Shop · Umuriro | Ishyiga Ihute",
}

type PageProps = {
  searchParams: Promise<{
    name?: string
    momo?: string
    tin?: string
    mrc?: string
    payload?: string
  }>
}

export default async function UmuriroRegisterPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const initial = resolveUmuriroGqInitial(sp)

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#eef4fb]" />}>
      <UmuriroBoarding initial={initial} />
    </Suspense>
  )
}
