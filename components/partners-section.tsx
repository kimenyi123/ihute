import { Building2 } from "lucide-react"

const partners = [
  { name: "MTN Rwanda", logo: "MTN" },
  { name: "Airtel Rwanda", logo: "Airtel" },
  { name: "Bank of Kigali", logo: "BK" },
  { name: "Equity Bank", logo: "Equity" },
  { name: "I&M Bank", logo: "I&M" },
  { name: "KCB Bank", logo: "KCB" },
]

export function PartnersSection() {
  return (
    <section className="py-12 md:py-16 border-t bg-white">
      <div className="container mx-auto px-4">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Our Partners</h2>
          <p className="mt-2 text-muted-foreground">Trusted by leading organizations in Rwanda</p>
        </div>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="flex items-center justify-center rounded-lg border bg-slate-50 p-6 transition-all hover:shadow-md"
            >
              <div className="text-center">
                <Building2 className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                <p className="text-sm font-semibold text-slate-700">{partner.logo}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
