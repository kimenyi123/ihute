"use client"

import { FormEvent, useMemo, useState, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  MessageSquare,
  PenLine,
  Phone,
  Send,
  Tag,
  User,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuthStore } from "@/lib/auth-store"
import { GRANDMA_PATHS } from "@/lib/grandma-urls"
import {
  CLIENT_SUGGESTION_CATEGORIES,
  validateClientSuggestionInput,
} from "@/lib/client-suggestion-shared"
import { useTranslation } from "@/hooks/use-translation"

const COPY = {
  en: {
    back: "Back to Home",
    brandTag: "Your Growth, Our Care",
    title: "We value your suggestions!",
    intro:
      "Your feedback helps us improve Grandma and serve you better. Please share your ideas, suggestions, or any issues you encounter.",
    formTitle: "Submit a Suggestion",
    formSub: "Kindly fill in the form below",
    fullName: "Full Name",
    fullNamePh: "Enter your full name",
    email: "Email Address",
    emailPh: "Enter your email address",
    phone: "Phone Number",
    phonePh: "Enter your phone number",
    subject: "Subject",
    subjectPh: "What is your suggestion about?",
    details: "Suggestion Details",
    detailsPh: "Please describe your suggestion in detail...",
    category: "Category (Optional)",
    categoryPh: "Select a category",
    submit: "Submit Suggestion",
    submitting: "Submitting…",
    success: "Suggestion submitted successfully!",
    successHint: "Thank you. Our team will review your message.",
    lockNote: "Your feedback is safe with us and will be used to improve our services.",
    thanks: "Thank you! Your suggestions make Grandma better for everyone.",
    none: "None",
  },
  rw: {
    back: "Subira ahabanza",
    brandTag: "Iterambere ryawe, ubwitange bwacu",
    title: "Twishimiye ibitekerezo byawe!",
    intro:
      "Ibitekerezo byawe bitufasha kunoza Grandma. Tanga igitekerezo, ikibazo, cyangwa icyo wabonanye.",
    formTitle: "Tanga igitekerezo",
    formSub: "Uzuza ifishi ikurikira",
    fullName: "Amazina yose",
    fullNamePh: "Andika amazina yawe",
    email: "Imeri",
    emailPh: "Andika imeri yawe",
    phone: "Telefoni",
    phonePh: "Andika nimero ya telefoni",
    subject: "Ingingo",
    subjectPh: "Igitekerezo cyawe kiri ku iki?",
    details: "Ibisobanuro",
    detailsPh: "Sobanura neza igitekerezo cyawe...",
    category: "Icyiciro (ntibisabwa)",
    categoryPh: "Hitamo icyiciro",
    submit: "Ohereza igitekerezo",
    submitting: "Birimo koherezwa…",
    success: "Igitekerezo cyakiriwe neza!",
    successHint: "Murakoze. Ikipe yacu izagisuzuma.",
    lockNote: "Amakuru yawe arinzwe kandi akoreshwa gusa kunoza serivisi.",
    thanks: "Murakoze! Ibitekerezo byawe binoza Grandma.",
    none: "Nta cyiciro",
  },
  fr: {
    back: "Retour à l’accueil",
    brandTag: "Votre croissance, notre soin",
    title: "Nous valorisons vos suggestions !",
    intro:
      "Vos retours nous aident à améliorer Grandma. Partagez vos idées, suggestions ou problèmes.",
    formTitle: "Envoyer une suggestion",
    formSub: "Veuillez remplir le formulaire",
    fullName: "Nom complet",
    fullNamePh: "Entrez votre nom complet",
    email: "Adresse e-mail",
    emailPh: "Entrez votre e-mail",
    phone: "Téléphone",
    phonePh: "Entrez votre numéro",
    subject: "Sujet",
    subjectPh: "De quoi s’agit-il ?",
    details: "Détails",
    detailsPh: "Décrivez votre suggestion en détail...",
    category: "Catégorie (facultatif)",
    categoryPh: "Choisir une catégorie",
    submit: "Envoyer la suggestion",
    submitting: "Envoi…",
    success: "Suggestion envoyée avec succès !",
    successHint: "Merci. Notre équipe l’examinera.",
    lockNote: "Vos retours sont protégés et servent à améliorer le service.",
    thanks: "Merci ! Vos suggestions rendent Grandma meilleure.",
    none: "Aucune",
  },
} as const

type FieldErrors = Partial<Record<"fullName" | "email" | "phone" | "subject" | "suggestionDetails" | "category", string>>

export default function GrandmaSupportPage() {
  const router = useRouter()
  const { language } = useTranslation()
  const ui = COPY[language] ?? COPY.en
  const user = useAuthStore((s) => s.user)

  const defaults = useMemo(
    () => ({
      fullName: user?.name?.trim() || "",
      email: user?.email?.includes("@phone.local") ? "" : user?.email?.trim() || "",
      phone: user?.phone?.trim() || "",
    }),
    [user],
  )

  const [fullName, setFullName] = useState(defaults.fullName)
  const [email, setEmail] = useState(defaults.email)
  const [phone, setPhone] = useState(defaults.phone)
  const [subject, setSubject] = useState("")
  const [suggestionDetails, setSuggestionDetails] = useState("")
  const [category, setCategory] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setFormError(null)
    const parsed = validateClientSuggestionInput({
      fullName,
      email,
      phone,
      subject,
      suggestionDetails,
      category: category || undefined,
    })
    if (!parsed.ok) {
      setErrors(parsed.field ? { [parsed.field]: parsed.error } : {})
      setFormError(parsed.error)
      setSubmitting(false)
      return
    }
    setErrors({})
    try {
      const res = await fetch("/api/grandma/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.value),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setFormError(json.error || "Could not submit. Please try again.")
        return
      }
      setSuccess(true)
      setSubject("")
      setSuggestionDetails("")
      setCategory("")
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const fieldClass =
    "h-11 rounded-xl border-[#d7e4f2] bg-white pl-10 text-[#17324d] placeholder:text-slate-400"

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#e8f5ff] to-[#dff0ff] text-[#17324d]">
      <header className="sticky top-0 z-20 border-b border-[#d5e6f5] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/img/logo.png" alt="" className="h-9 w-9 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="truncate text-base font-bold">Grandma</p>
              <p className="truncate text-xs text-slate-500">{ui.brandTag}</p>
            </div>
          </div>
          <Link
            href={GRANDMA_PATHS.appRoot}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#c5daf0] bg-white px-3 py-2 text-sm font-medium text-[#1d4f7a] hover:bg-[#f4f9fd]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {ui.back}
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-2 lg:items-start">
        <section className="space-y-4">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-[#0f3a5c]">
            {ui.title}
            <MessageCircle className="h-7 w-7 text-[#1d6aa5]" aria-hidden />
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-slate-600">{ui.intro}</p>
          <div className="relative overflow-hidden rounded-3xl border border-[#cfe0ef] bg-white shadow-sm">
            <Image
              src="/grandma/support-hero.png"
              alt=""
              width={900}
              height={700}
              className="h-auto w-full object-cover object-left"
              priority
            />
            <span
              className="absolute right-[18%] top-[18%] flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md"
              aria-hidden
            >
              <MessageSquare className="h-6 w-6 text-[#1d6aa5]" />
            </span>
          </div>
        </section>

        <section className="rounded-3xl border border-[#d5e6f5] bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7f3fb] text-[#1d6aa5]">
              <PenLine className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold">{ui.formTitle}</h2>
              <p className="text-sm text-slate-500">{ui.formSub}</p>
            </div>
          </div>

          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800" role="status">
              <p className="font-semibold">{ui.success}</p>
              <p className="mt-1">{ui.successHint}</p>
              <button
                type="button"
                className="mt-4 text-sm font-medium text-[#1d6aa5] underline"
                onClick={() => {
                  setSuccess(false)
                  router.push(GRANDMA_PATHS.appRoot)
                }}
              >
                {ui.back}
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <Field
                id="fullName"
                label={ui.fullName}
                error={errors.fullName}
                icon={<User className="h-4 w-4" />}
              >
                <Input
                  id="fullName"
                  name="fullName"
                  autoComplete="name"
                  required
                  maxLength={120}
                  placeholder={ui.fullNamePh}
                  value={fullName}
                  onChange={(ev) => setFullName(ev.target.value)}
                  className={fieldClass}
                  aria-invalid={Boolean(errors.fullName)}
                />
              </Field>
              <Field id="email" label={ui.email} error={errors.email} icon={<Mail className="h-4 w-4" />}>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={255}
                  placeholder={ui.emailPh}
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  className={fieldClass}
                  aria-invalid={Boolean(errors.email)}
                />
              </Field>
              <Field id="phone" label={ui.phone} error={errors.phone} icon={<Phone className="h-4 w-4" />}>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  maxLength={24}
                  placeholder={ui.phonePh}
                  value={phone}
                  onChange={(ev) => setPhone(ev.target.value)}
                  className={fieldClass}
                  aria-invalid={Boolean(errors.phone)}
                />
              </Field>
              <Field id="subject" label={ui.subject} error={errors.subject} icon={<Tag className="h-4 w-4" />}>
                <Input
                  id="subject"
                  name="subject"
                  required
                  maxLength={200}
                  placeholder={ui.subjectPh}
                  value={subject}
                  onChange={(ev) => setSubject(ev.target.value)}
                  className={fieldClass}
                  aria-invalid={Boolean(errors.subject)}
                />
              </Field>
              <Field
                id="suggestionDetails"
                label={ui.details}
                error={errors.suggestionDetails}
                icon={<MessageSquare className="h-4 w-4" />}
              >
                <Textarea
                  id="suggestionDetails"
                  name="suggestionDetails"
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={5}
                  placeholder={ui.detailsPh}
                  value={suggestionDetails}
                  onChange={(ev) => setSuggestionDetails(ev.target.value)}
                  className="rounded-xl border-[#d7e4f2] bg-white pl-10 pt-3 text-[#17324d] placeholder:text-slate-400"
                  aria-invalid={Boolean(errors.suggestionDetails)}
                />
              </Field>
              <div className="space-y-1.5">
                <Label htmlFor="category">{ui.category}</Label>
                <Select value={category || "__none"} onValueChange={(v) => setCategory(v === "__none" ? "" : v)}>
                  <SelectTrigger id="category" className="h-11 rounded-xl border-[#d7e4f2] bg-white">
                    <SelectValue placeholder={ui.categoryPh} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{ui.none}</SelectItem>
                    {CLIENT_SUGGESTION_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {formError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1d6aa5] text-sm font-semibold text-white hover:bg-[#185a8c] disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                {submitting ? ui.submitting : ui.submit}
              </button>
              <p className="flex items-start gap-2 text-xs text-slate-500">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {ui.lockNote}
              </p>
            </form>
          )}
        </section>
      </main>

      <footer className="border-t border-[#d5e6f5] bg-white/80 px-4 py-4 text-sm text-[#1d6aa5]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p>{ui.thanks}</p>
          <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
        </div>
      </footer>
    </div>
  )
}

function Field({
  id,
  label,
  error,
  icon,
  children,
}: {
  id: string
  label: string
  error?: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden>
          {icon}
        </span>
        {children}
      </div>
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
