import { LocationVerification } from "@/components/location-verification"

export default function LocationTestPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900">Location Tracking Test</h1>
                    <p className="text-gray-600">
                        Verify that your GPS location is being tracked accurately in real-time
                    </p>
                </div>

                <LocationVerification />

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-yellow-900">
                        <strong>Note:</strong> This is a test page. Delete or restrict access before deploying to production.
                    </p>
                </div>
            </div>
        </div>
    )
}
