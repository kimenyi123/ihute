import { RecommendationSettings } from "@/components/recommendation-settings"
import { BecauseYouViewed } from "@/components/because-you-viewed"
import { RecommendedForYou } from "@/components/recommended-for-you"

export default function RecommendationTestPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900">Advanced Recommendation System</h1>
                    <p className="text-gray-600">
                        Test all recommendation features including A/B testing, caching, and contextual sections
                    </p>
                </div>

                {/* Settings Panel */}
                <div className="max-w-2xl mx-auto">
                    <RecommendationSettings />
                </div>

                {/* Recommendation Sections */}
                <div className="space-y-8">
                    <RecommendedForYou />

                    <BecauseYouViewed />
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-4xl mx-auto">
                    <h3 className="font-semibold text-blue-900 mb-3">How to Test:</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                        <li>Browse some products on the main site to build recommendation history</li>
                        <li>Adjust cache duration and see when recommendations refresh</li>
                        <li>Enable A/B testing to try different algorithm variants</li>
                        <li>Enable debug options to see cache status and recommendation sources</li>
                        <li>Watch the console logs for cache hits/misses</li>
                        <li>Check sessionStorage for <code>ihute-recommendations-cache</code></li>
                    </ol>
                </div>
            </div>
        </div>
    )
}
