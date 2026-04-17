"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type PasswordInputWithToggleProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  /** Optional id for label association */
  id?: string
}

/**
 * Password field with an eye toggle: first click shows plain text, second click hides.
 */
export const PasswordInputWithToggle = React.forwardRef<HTMLInputElement, PasswordInputWithToggleProps>(
  function PasswordInputWithToggle({ className, id, ...props }, ref) {
    const [visible, setVisible] = React.useState(false)

    return (
      <div className="relative">
        <Input
          id={id}
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-md p-2 text-muted-foreground outline-none ring-offset-background transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4 shrink-0" aria-hidden /> : <Eye className="h-4 w-4 shrink-0" aria-hidden />}
        </button>
      </div>
    )
  }
)
