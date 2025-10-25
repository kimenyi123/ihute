"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Play } from "lucide-react"
import { useTranslation } from "@/hooks/use-translation"

export function VideoTutorial() {
  const { t } = useTranslation()

  return (
    <section className="py-12 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">{t("howToUse")}</h2>
          <p className="text-slate-600">{t("watchVideoGuide")}</p>
        </div>

        <Card className="max-w-4xl mx-auto overflow-hidden shadow-lg">
          <CardContent className="p-0">
            <div className="relative aspect-video bg-gradient-to-br from-slate-900 to-slate-700">
              {/* Video placeholder - replace with actual video embed */}
              <div className="absolute inset-0 flex items-center justify-center">
                <button className="group flex flex-col items-center gap-4 transition-transform hover:scale-105">
                  <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-xl group-hover:bg-white transition-colors">
                    <Play className="h-10 w-10 text-slate-900 ml-1" fill="currentColor" />
                  </div>
                  <span className="text-white text-lg font-medium">{t("watchTutorial")}</span>
                </button>
              </div>

              {/* Replace the div above with actual video embed like: */}
              {/* <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
                title="How to use ihute.rw"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              /> */}
            </div>
          </CardContent>
        </Card>

        {/* Quick tips below video */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-4xl mx-auto">
          <div className="text-center p-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
              <span className="text-xl font-bold text-blue-600">1</span>
            </div>
            <p className="text-sm text-slate-600">{t("step1Browse")}</p>
          </div>
          <div className="text-center p-4">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-2">
              <span className="text-xl font-bold text-green-600">2</span>
            </div>
            <p className="text-sm text-slate-600">{t("step2AddToCart")}</p>
          </div>
          <div className="text-center p-4">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-2">
              <span className="text-xl font-bold text-orange-600">3</span>
            </div>
            <p className="text-sm text-slate-600">{t("step3Checkout")}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
