"use client";

import { useEffect, useState } from "react";
import { CreditCard, FileText, Loader2, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/use-translation";
import type { TranslationKey } from "@/lib/translations";

export const DEFAULT_MOH_ERX_CODE = "EP-0317-169";

export type ErxUnlockKey = {
  phone: string;
  names: string;
  nationalId: string;
};

/** One combined field (spec): phone, names, or national ID — kimwe kirahagije. */
export function parseSingleUnlockKey(raw: string): ErxUnlockKey {
  const t = raw.trim();
  if (!t) return { phone: "", names: "", nationalId: "" };
  const digitsOnly = t.replace(/\D/g, "");
  if (digitsOnly.length === 16) {
    return { phone: "", names: "", nationalId: t };
  }
  if (digitsOnly.length >= 9 && digitsOnly.length <= 13 && /^[\d\s+\-().]+$/.test(t)) {
    return { phone: t, names: "", nationalId: "" };
  }
  return { phone: "", names: t, nationalId: "" };
}

export function isPharmacyCategoryId(categoryId: string): boolean {
  const id = (categoryId || "").trim().toLowerCase();
  return id === "pharmacy" || id === "farumasi" || id.includes("pharmacy");
}

export function PharmacyErxInput({
  initialCode,
  initialPhone = "",
  initialNames = "",
  initialNationalId = "",
  onLookup,
  compact = false,
  singleKeyMode = false,
}: {
  initialCode?: string;
  initialPhone?: string;
  initialNames?: string;
  initialNationalId?: string;
  onLookup: (code: string, unlock?: ErxUnlockKey) => void;
  compact?: boolean;
  singleKeyMode?: boolean;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState(initialCode?.trim() || DEFAULT_MOH_ERX_CODE);
  const [phone, setPhone] = useState(initialPhone);
  const [names, setNames] = useState(initialNames);
  const [nationalId, setNationalId] = useState(initialNationalId);
  const [singleKey, setSingleKey] = useState("");
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    const next = initialCode?.trim();
    if (next) setCode(next);
  }, [initialCode]);

  useEffect(() => {
    if (initialPhone.trim()) setPhone(initialPhone);
  }, [initialPhone]);

  useEffect(() => {
    if (initialNames.trim()) setNames(initialNames);
  }, [initialNames]);

  useEffect(() => {
    if (initialNationalId.trim()) setNationalId(initialNationalId);
  }, [initialNationalId]);

  const runLookup = (unlock?: ErxUnlockKey) => {
    const next = code.trim();
    if (!next || looking) return;
    setLooking(true);
    onLookup(next, unlock);
    window.setTimeout(() => setLooking(false), 400);
  };

  const unlockKey: ErxUnlockKey = singleKeyMode
    ? parseSingleUnlockKey(singleKey)
    : {
        phone: phone.trim(),
        names: names.trim(),
        nationalId: nationalId.trim(),
      };
  const canUnlock = Boolean(
    code.trim() && (unlockKey.phone || unlockKey.names || unlockKey.nationalId),
  );

  return (
    <form
      className={compact ? "space-y-3" : "mt-4 space-y-3 border-t pt-4"}
      onSubmit={(e) => {
        e.preventDefault();
        if (!canUnlock) return;
        runLookup(unlockKey);
      }}
    >
      {!compact && (
        <div>
          <p className="text-sm font-semibold text-foreground">
            {t("categoryBrowseErxLabel" as TranslationKey)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("categoryBrowseErxHint" as TranslationKey)}
          </p>
        </div>
      )}
      <div className={singleKeyMode ? "space-y-2" : "flex flex-col sm:flex-row gap-2"}>
        <div className="relative flex-1">
          <FileText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("categoryBrowseErxPlaceholder" as TranslationKey)}
            autoComplete="off"
            inputMode="text"
            className="pl-10"
            aria-label={t("categoryBrowseErxLabel" as TranslationKey)}
          />
        </div>
        {!singleKeyMode && (
          <Button
            type="button"
            className="bg-[#1e3a5f] hover:bg-[#2c4f7c] shrink-0"
            disabled={!code.trim() || looking}
            onClick={() => runLookup()}
          >
            {looking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("categoryBrowseErxSubmit" as TranslationKey)
            )}
          </Button>
        )}
      </div>

      {singleKeyMode ? (
        <>
          <label className="block text-[11.5px] font-bold text-[#3A4A6B]">
            Telefoni / Amazina / Indangamuntu — kimwe kirahagije
          </label>
          <Input
            value={singleKey}
            onChange={(e) => setSingleKey(e.target.value)}
            placeholder="078… cyangwa Alphonsine … cyangwa 1198…"
            autoComplete="off"
            aria-label="Urufunguzo rw'umurwayi"
          />
          <Button
            type="submit"
            className="w-full bg-[#1e3a5f] hover:bg-[#2c4f7c]"
            disabled={!canUnlock || looking}
          >
            {looking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Fungura urwandiko"
            )}
          </Button>
        </>
      ) : (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("categoryBrowseErxUnlock" as TranslationKey)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("categoryBrowseErxUnlockHint" as TranslationKey)}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("categoryBrowseErxPhonePlaceholder" as TranslationKey)}
                autoComplete="tel"
                inputMode="tel"
                className="pl-10"
                aria-label={t("categoryBrowseErxPhone" as TranslationKey)}
              />
            </div>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={names}
                onChange={(e) => setNames(e.target.value)}
                placeholder={t("categoryBrowseErxNamesPlaceholder" as TranslationKey)}
                autoComplete="name"
                className="pl-10"
                aria-label={t("categoryBrowseErxNames" as TranslationKey)}
              />
            </div>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder={t("categoryBrowseErxNationalIdPlaceholder" as TranslationKey)}
                autoComplete="off"
                inputMode="numeric"
                className="pl-10"
                aria-label={t("categoryBrowseErxNationalId" as TranslationKey)}
              />
            </div>
          </div>
          <Button
            type="submit"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={!canUnlock || looking}
          >
            {looking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("categoryBrowseErxUnlockSubmit" as TranslationKey)
            )}
          </Button>
        </div>
      )}
    </form>
  );
}
