import Image from "next/image"

export function HeroSection() {
  return (
    <section className="bg-gradient-to-r from-orange-50 to-yellow-50 py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Shop from Local Businesses</h1>
            <p className="text-slate-600 text-sm md:text-base">Quality products delivered to your door across Rwanda</p>
          </div>
          <div className="hidden md:block">
            <Image
              src="/images/ishyiga-banner.png"
              alt="Ishyiga Trading"
              width={300}
              height={120}
              className="rounded-lg"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  )
}
