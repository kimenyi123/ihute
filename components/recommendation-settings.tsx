"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Settings, RefreshCw } from "lucide-react"
import { useRecommendationConfig, type RecommendationAlgorithm } from "@/lib/recommendation-config"
import { invalidateRecommendationCache } from "@/lib/recommendation-service"

/**
 * Recommendation Settings Panel
 * Allows users to configure recommendation behavior
 */

export function RecommendationSettings() {
    const { config, setConfig, resetToDefaults } = useRecommendationConfig()

    function handleCacheDurationChange(value: number[]) {
        setConfig({ cacheDurationMinutes: value[0] })
    }

    function handleAlgorithmChange(value: RecommendationAlgorithm) {
        setConfig({ algorithm: value })
        invalidateRecommendationCache() // Refresh with new algorithm
    }

    function handleABTestToggle(enabled: boolean) {
        setConfig({ abTestEnabled: enabled })
        invalidateRecommendationCache()
    }

    function handleReset() {
        resetToDefaults()
        invalidateRecommendationCache()
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Recommendation Settings
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Cache Duration */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Cache Duration</Label>
                        <Badge variant="outline">{config.cacheDurationMinutes} minutes</Badge>
                    </div>
                    <Slider
                        value={[config.cacheDurationMinutes]}
                        onValueChange={handleCacheDurationChange}
                        min={1}
                        max={60}
                        step={1}
                        className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                        How long to cache recommendations before refreshing
                    </p>
                </div>

                {/* Algorithm Selection */}
                <div className="space-y-2">
                    <Label>Recommendation Algorithm</Label>
                    <Select value={config.algorithm} onValueChange={handleAlgorithmChange}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="hybrid">Hybrid (Best Results)</SelectItem>
                            <SelectItem value="collaborative">Collaborative Filtering</SelectItem>
                            <SelectItem value="category-based">Category-Based</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        Choose how recommendations are generated
                    </p>
                </div>

                {/* A/B Testing */}
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>A/B Testing</Label>
                        <p className="text-xs text-muted-foreground">
                            Enable experimental features
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={config.abTestEnabled}
                            onCheckedChange={handleABTestToggle}
                        />
                        {config.abTestEnabled && (
                            <Badge variant="secondary" className="text-xs">
                                Variant: {config.abTestVariant}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Feature Flags */}
                <div className="space-y-3">
                    <Label>Features</Label>

                    <div className="flex items-center justify-between">
                        <span className="text-sm">Trending Fallback</span>
                        <Switch
                            checked={config.enableTrendingFallback}
                            onCheckedChange={(checked) => setConfig({ enableTrendingFallback: checked })}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm">Collaborative Filtering</span>
                        <Switch
                            checked={config.enableCollaborativeFiltering}
                            onCheckedChange={(checked) => setConfig({ enableCollaborativeFiltering: checked })}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm">Category Recommendations</span>
                        <Switch
                            checked={config.enableCategoryBased}
                            onCheckedChange={(checked) => setConfig({ enableCategoryBased: checked })}
                        />
                    </div>
                </div>

                {/* Debug Options */}
                <div className="space-y-3 pt-4 border-t">
                    <Label>Debug</Label>

                    <div className="flex items-center justify-between">
                        <span className="text-sm">Show Recommendation Source</span>
                        <Switch
                            checked={config.showRecommendationSource}
                            onCheckedChange={(checked) => setConfig({ showRecommendationSource: checked })}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm">Show Cache Status</span>
                        <Switch
                            checked={config.showCacheStatus}
                            onCheckedChange={(checked) => setConfig({ showCacheStatus: checked })}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                    <Button
                        variant="outline"
                        onClick={handleReset}
                        className="flex-1"
                    >
                        Reset to Defaults
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => invalidateRecommendationCache()}
                        className="flex-1"
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Clear Cache
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
