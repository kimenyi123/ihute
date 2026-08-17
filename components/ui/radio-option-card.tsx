"use client"

import * as React from "react"
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

/**
 * Full-width selectable row; pairs with {@link RadioGroup} + `onValueChange`.
 * Uses a div (not Label wrapping the radio) so label association does not
 * nest/double-activate the control — that broke selection when the group
 * value pointed at a disabled option.
 */
export function RadioOptionCard({
  value,
  id,
  selected,
  children,
  className,
  disabled,
  accent = "default",
}: RadioOptionCardProps) {
  const select = () => {
    if (disabled) return
    const el = document.getElementById(id)
    if (el instanceof HTMLElement) el.click()
  }

  return (
    <div
      role="presentation"
      data-disabled={disabled ? "" : undefined}
      data-state={selected ? "checked" : "unchecked"}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 sm:p-4 transition-colors",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
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
      onClick={select}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          select()
        }
      }}
    >
      <span
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center self-center"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <RadioGroupItem value={value} id={id} disabled={disabled} />
      </span>
      <div className="min-w-0 flex-1 pointer-events-none">{children}</div>
    </div>
  )
}
