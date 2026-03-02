"use client"

import { Radio, MapPin, AlertTriangle, Check } from "lucide-react"
import { useState } from "react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface GPSHealthBadgeProps {
    status: "idle" | "requesting" | "watching" | "denied" | "error"
    isOnline: boolean
    queueSize?: number
    compact?: boolean
}

export function GPSHealthBadge({
    status,
    isOnline,
    queueSize = 0,
    compact = false
}: GPSHealthBadgeProps) {
    const [isOpen, setIsOpen] = useState(false)

    const getStatusIcon = () => {
        switch (status) {
            case "watching": return <Radio className="h-3 w-3 animate-pulse" />
            case "denied": return <AlertTriangle className="h-3 w-3" />
            case "error": return <AlertTriangle className="h-3 w-3" />
            default: return <MapPin className="h-3 w-3" />
        }
    }

    const getStatusColor = () => {
        switch (status) {
            case "watching": return "text-green-600 bg-green-50 border-green-200"
            case "denied": return "text-red-600 bg-red-50 border-red-200"
            case "error": return "text-orange-600 bg-orange-50 border-orange-200"
            default: return "text-slate-600 bg-slate-50 border-slate-200"
        }
    }

    const getStatusText = () => {
        switch (status) {
            case "watching": return "Active"
            case "denied": return "Denied"
            case "error": return "Error"
            default: return "Idle"
        }
    }

    if (compact) {
        return (
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <button
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium transition-colors ${getStatusColor()}`}
                    >
                        {getStatusIcon()}
                        <span>GPS</span>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="end">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">GPS Status</span>
                            <div className={`flex items-center gap-1 text-xs ${getStatusColor()} px-2 py-0.5 rounded-full border`}>
                                {getStatusIcon()}
                                <span>{getStatusText()}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Connection</span>
                            <span className={isOnline ? "text-green-600" : "text-red-600"}>
                                {isOnline ? "Online" : "Offline"}
                            </span>
                        </div>

                        {queueSize > 0 && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                                {queueSize} update{queueSize !== 1 ? 's' : ''} queued
                            </div>
                        )}

                        {status === "watching" && (
                            <div className="flex items-center gap-2 text-green-600 text-xs">
                                <Check className="h-3 w-3" />
                                <span>Location tracking active</span>
                            </div>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        )
    }

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getStatusColor()}`}>
            {getStatusIcon()}
            <span className="text-sm font-medium">GPS {getStatusText()}</span>
            {!isOnline && (
                <span className="text-xs opacity-75">(Offline)</span>
            )}
            {queueSize > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-white/50 rounded text-xs">
                    {queueSize}
                </span>
            )}
        </div>
    )
}
