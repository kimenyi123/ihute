"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useLanguageStore, type Language } from "@/lib/language-store"

const LANGUAGES: { code: Language; name: string; nativeName: string; flag: string }[] = [
  { code: "rw", name: "Kinyarwanda", nativeName: "Ikinyarwanda", flag: "🇷🇼" },
  { code: "en", name: "English",     nativeName: "English",      flag: "🇬🇧" },
  { code: "fr", name: "Français",    nativeName: "Français",     flag: "🇫🇷" },
]

export function LanguageSelector({ compact }: { compact?: boolean } = {}) {
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 h-9 min-w-0 px-2"
          aria-label={`Language: ${current.name}`}
        >
          <span className="text-base leading-none">{current.flag}</span>
          {!compact && (
            <span className="hidden sm:inline text-sm font-medium">
              {current.code.toUpperCase()}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className="gap-2.5 cursor-pointer"
          >
            <span className="text-base leading-none">{lang.flag}</span>
            <span className="flex-1">{lang.nativeName}</span>
            {language === lang.code && (
              <span className="ml-auto text-primary font-semibold" aria-label="selected">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
