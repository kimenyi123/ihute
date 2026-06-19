"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

type RadioOptionCardProps = {
  value: string
  id: string
  selected: boolean
  children: React.ReactNode
  className?: string
  disabled?: boolean
  /** Violet tint for UrubutoPay rows */
  accent?: "default" | "violet"
}

/** Full-width selectable row; pairs with {@link RadioGroup} + `onValueChange`. */
export function RadioOptionCard({
  value,
  id,
  selected,
  children,
  className,
  disabled,
  accent = "default",
}: RadioOptionCardProps) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 sm:p-4 transition-colors",
        "cursor-pointer",
        disabled && "cursor-not-allowed opacity-50",
        !disabled && !selected && "border-border bg-card hover:bg-muted/60",
        !disabled &&
          selected &&
          accent === "violet" &&
          "border-violet-400 bg-violet-100 hover:bg-violet-100",
        !disabled &&
          selected &&
          accent === "default" &&
          "border-primary/30 bg-primary/20 hover:bg-primary/20",
        className,
      )}
    >
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center self-center">
        <RadioGroupItem value={value} id={id} disabled={disabled} />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </Label>
  )
}
