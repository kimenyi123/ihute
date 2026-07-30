"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type GeoComboboxOption = { value: string; label: string; keywords: string }

function findOption(options: GeoComboboxOption[], v: string): GeoComboboxOption | undefined {
  const t = String(v ?? "").trim()
  if (!t) return undefined
  return (
    options.find((o) => o.value === t) ??
    options.find((o) => o.value.toLowerCase() === t.toLowerCase())
  )
}

export function GeoCombobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  emptyText = "No match.",
  searchPlaceholder = "Search…",
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: GeoComboboxOption[]
  placeholder: string
  disabled?: boolean
  emptyText?: string
  searchPlaceholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = findOption(options, value)
  const vTrim = String(value ?? "").trim()
  const triggerLabel = selected?.label ?? (vTrim ? vTrim : undefined)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-auto min-h-10 w-full justify-between py-2 font-normal", className)}
        >
          <span className="truncate text-left">{triggerLabel ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,28rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-11" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  keywords={o.keywords ? [o.keywords] : undefined}
                  onSelect={(currentValue) => {
                    const raw = String(currentValue ?? "").trim()
                    const picked = findOption(options, raw)
                    onChange(picked?.value ?? raw)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      selected?.value === o.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
