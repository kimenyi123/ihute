"use client";

import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";

interface DistanceBadgeProps {
  distanceKm: number;
  className?: string;
}

export function DistanceBadge({ distanceKm, className }: DistanceBadgeProps) {
  // Format distance
  const formatted = distanceKm < 1 
    ? `${Math.round(distanceKm * 1000)} m` 
    : `${distanceKm.toFixed(1)} km`;

  // Determine variant based onDistance
  const variant = distanceKm < 5 ? "default" : "secondary";

  return (
    <Badge variant={variant} className={className}>
      <MapPin className="w-3 h-3 mr-1" />
      {formatted} away
    </Badge>
  );
}
