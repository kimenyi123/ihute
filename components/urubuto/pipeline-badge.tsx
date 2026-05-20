"use client"

import { stageMeta, type PipelineStage } from "@/lib/urubuto-pipeline"
import { cn } from "@/lib/utils"

export function UrubutoPipelineBadge({
  stage,
  className,
}: {
  stage: string
  className?: string
}) {
  const meta = stageMeta(stage)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        meta.color,
        className
      )}
    >
      {meta.label}
    </span>
  )
}

export function UrubutoLiveBadge({ eligible }: { eligible: boolean }) {
  if (!eligible) return null
  return (
    <span className="inline-flex items-center rounded-full bg-green-600 px-2.5 py-0.5 text-xs font-semibold text-white">
      Live
    </span>
  )
}
