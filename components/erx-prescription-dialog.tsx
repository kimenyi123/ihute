"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ERX_EVERY_OPTIONS,
  ERX_MEASUREMENT_OPTIONS,
  ERX_ROUTE_OPTIONS,
  type ErxPrescription,
} from "@/lib/erx-prescription";

function pickField(src: Record<string, unknown> | undefined, ...keys: string[]): string {
  if (!src) return "";
  for (const k of keys) {
    const v = src[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

export function ErxPrescriptionDialog({
  open,
  onOpenChange,
  productName,
  prefillSource,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  /** Optional raw product row to pre-fill measurement / route / etc. */
  prefillSource?: Record<string, unknown>;
  onConfirm: (erx: ErxPrescription) => void;
}) {
  const [erxMeasurement, setErxMeasurement] = useState("TABLET");
  const [erxEvery, setErxEvery] = useState("1 HOUR = 24 TIMES A DAY");
  const [erxToBeTakenDays, setErxToBeTakenDays] = useState("");
  const [erxQuantityOnce, setErxQuantityOnce] = useState("");
  const [erxRoute, setErxRoute] = useState("Oral");
  const [erxRefill, setErxRefill] = useState<"YES" | "NO">("NO");
  const [erxInstructionNotes, setErxInstructionNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    const p = prefillSource;
    const m = pickField(p, "measurement", "MEASUREMENT", "form", "FORM") || "TABLET";
    setErxMeasurement((ERX_MEASUREMENT_OPTIONS as readonly string[]).includes(m) ? m : "TABLET");
    const ev = pickField(p, "every", "EVERY", "frequency", "FREQUENCY") || "1 HOUR = 24 TIMES A DAY";
    setErxEvery((ERX_EVERY_OPTIONS as readonly string[]).includes(ev) ? ev : "1 HOUR = 24 TIMES A DAY");
    setErxToBeTakenDays(pickField(p, "to_be_taken", "TO_BE_TAKEN", "duration", "DURATION"));
    setErxQuantityOnce(pickField(p, "quantity_once", "QUANTITY_ONCE", "qty_once"));
    const rt = pickField(p, "routes", "ROUTES", "route", "ROUTE") || "Oral";
    setErxRoute((ERX_ROUTE_OPTIONS as readonly string[]).includes(rt) ? rt : "Oral");
    setErxRefill(pickField(p, "refill", "REFILL").toUpperCase() === "YES" ? "YES" : "NO");
    setErxInstructionNotes("");
  }, [open, prefillSource]);

  const handleSave = () => {
    onConfirm({
      measurement: erxMeasurement.trim() || "TABLET",
      every: erxEvery.trim() || "",
      toBeTakenDays: erxToBeTakenDays.trim(),
      quantityOnce: erxQuantityOnce.trim(),
      instructionNotes: erxInstructionNotes.trim(),
      route: erxRoute.trim() || "Oral",
      refill: erxRefill,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <DialogTitle className="text-base sm:text-lg font-semibold leading-snug pr-2">
              MEASUREMENT FOR {productName.toUpperCase()}
            </DialogTitle>
            <Badge
              variant="secondary"
              className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-600 border-0 font-mono text-xs"
            >
              {new Date().toISOString().slice(0, 19).replace("T", " ")}
            </Badge>
          </div>
          <DialogDescription className="sr-only">
            Electronic prescription — how the patient should take this medicine before adding to cart.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1">
          <div className="space-y-1.5 sm:col-span-1">
            <Label className="text-xs font-semibold uppercase tracking-wide">Measurement</Label>
            <Select value={erxMeasurement} onValueChange={setErxMeasurement}>
              <SelectTrigger>
                <SelectValue placeholder="TABLET" />
              </SelectTrigger>
              <SelectContent>
                {ERX_MEASUREMENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label className="text-xs font-semibold uppercase tracking-wide">Every</Label>
            <Select value={erxEvery} onValueChange={setErxEvery}>
              <SelectTrigger className="text-left">
                <SelectValue placeholder="Frequency" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {ERX_EVERY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">To be taken (days)</Label>
            <Input
              value={erxToBeTakenDays}
              onChange={(e) => setErxToBeTakenDays(e.target.value)}
              placeholder="DAYS"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Quantity (once)</Label>
            <Input
              value={erxQuantityOnce}
              onChange={(e) => setErxQuantityOnce(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-semibold uppercase tracking-wide">Instruction notes</Label>
            <Textarea
              value={erxInstructionNotes}
              onChange={(e) => setErxInstructionNotes(e.target.value)}
              placeholder="Additional directions for the patient…"
              rows={3}
              className="resize-y min-h-[72px]"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label className="text-xs font-semibold uppercase tracking-wide">Routes</Label>
            <Select value={erxRoute} onValueChange={setErxRoute}>
              <SelectTrigger>
                <SelectValue placeholder="Oral" />
              </SelectTrigger>
              <SelectContent>
                {ERX_ROUTE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label className="text-xs font-semibold uppercase tracking-wide">Refill</Label>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={erxRefill === "YES"}
                  onCheckedChange={(c) => {
                    if (c === true) setErxRefill("YES");
                  }}
                />
                REFILL
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={erxRefill === "NO"}
                  onCheckedChange={(c) => {
                    if (c === true) setErxRefill("NO");
                  }}
                />
                NO
              </label>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button type="button" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
