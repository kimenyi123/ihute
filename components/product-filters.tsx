"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"

export function ProductFilters() {
  const [priceRange, setPriceRange] = useState([0, 100000])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Filters</CardTitle>
        <Button variant="ghost" size="sm" className="h-8 text-xs">
          Clear all
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price Range */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Price Range (RWF)</Label>
          <Slider value={priceRange} onValueChange={setPriceRange} max={100000} step={1000} className="mt-2" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{priceRange[0].toLocaleString()}</span>
            <span>{priceRange[1].toLocaleString()}</span>
          </div>
        </div>

        {/* Availability */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Availability</Label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="in-stock" />
              <label htmlFor="in-stock" className="text-sm cursor-pointer">
                In Stock
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="out-of-stock" />
              <label htmlFor="out-of-stock" className="text-sm cursor-pointer">
                Out of Stock
              </label>
            </div>
          </div>
        </div>

        {/* Brand */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Brand</Label>
          <div className="space-y-2">
            {["Brand A", "Brand B", "Brand C", "Brand D"].map((brand) => (
              <div key={brand} className="flex items-center gap-2">
                <Checkbox id={brand} />
                <label htmlFor={brand} className="text-sm cursor-pointer">
                  {brand}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Rating */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Rating</Label>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => (
              <div key={rating} className="flex items-center gap-2">
                <Checkbox id={`rating-${rating}`} />
                <label htmlFor={`rating-${rating}`} className="text-sm cursor-pointer">
                  {rating} stars & up
                </label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
