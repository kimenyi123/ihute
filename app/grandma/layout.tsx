import { GrandmaFetchTracker } from "@/components/grandma-fetch-tracker"

export default function GrandmaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GrandmaFetchTracker />
      {children}
    </>
  )
}
