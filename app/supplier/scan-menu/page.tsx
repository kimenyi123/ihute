"use client";

import { useCallback, useRef, useState } from "react";
import { UploadZone, type ImageFile } from "@/components/menu-scanner/UploadZone";
import { ImagePreviewList } from "@/components/menu-scanner/ImagePreviewList";
import { MenuResultsTable } from "@/components/menu-scanner/MenuResultsTable";
import { mergeMenuData, addIds } from "@/lib/menu-scanner/mergeMenuData";
import type { MenuItem } from "@/types/menu-scanner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguageStore, type Language } from "@/lib/language-store";

const SCAN_MENU_UI: Record<Language, {
  pageTitle: string;
  pageSubtitle: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  processAll: string;
  processingPage: (current: number, total: number) => string;
  resizeNote: string;
  step3Title: string;
  noItems: string;
  tryClearer: string;
  startOver: string;
  rawOcrTitle: string;
  rawOcrEmpty: string;
  maxImages: (n: number) => string;
  totalSizeLimit: (mb: number) => string;
}> = {
  en: {
    pageTitle: "Scan Menu",
    pageSubtitle: "Upload menu photos → extract items with OCR → download Excel",
    step1Title: "1. Upload menu images",
    step1Desc: "Add multiple photos (e.g. each page of the menu). Items, prices, and descriptions are read from the images.",
    step2Title: "2. Preview & process",
    processAll: "Process all images",
    processingPage: (c, t) => `Processing page ${c} of ${t}…`,
    resizeNote: "Images are resized before upload for faster processing. Please wait.",
    step3Title: "3. Review & export",
    noItems: "No menu items were extracted from the images.",
    tryClearer: "Try clearer photos, better lighting, or ensure the menu text is visible.",
    startOver: "Start over",
    rawOcrTitle: "What we read from the images (raw OCR text)",
    rawOcrEmpty: "(empty — OCR may have failed or image was unreadable)",
    maxImages: (n) => `Maximum ${n} images per session.`,
    totalSizeLimit: (mb) => `Total size must be under ${mb}MB.`,
  },
  rw: {
    pageTitle: "Soma Menyu",
    pageSubtitle: "Ohereza amafoto ya menyu → soma ibikubiyemo na OCR → kuramo Excel",
    step1Title: "1. Ohereza amashusho ya menyu",
    step1Desc: "Ongeraho amafoto menshi (urugero: buri paji ya menyu). Ibicuruzwa, ibiciro, n'ibisobanuro bisomwa mu mashusho.",
    step2Title: "2. Reba mbere & ukore",
    processAll: "Kora amashusho yose",
    processingPage: (c, t) => `Gusoma paji ${c} kuri ${t}…`,
    resizeNote: "Amashusho agabanyijemo ingano mbere yo koherezwa. Tegereza.",
    step3Title: "3. Suzuma & ohereze",
    noItems: "Nta bicuruzwa bya menyu byavuwe mu mashusho.",
    tryClearer: "Gerageza amafoto asobanutse, urumuri rwiza, cyangwa wizere ko inyandiko za menyu zigaragara.",
    startOver: "Ongera utangire",
    rawOcrTitle: "Ibyo twasomye mu mashusho (inyandiko z'OCR)",
    rawOcrEmpty: "(ubusa — OCR ishobora kuba yarananiranye cyangwa ishusho ntiyasomeka)",
    maxImages: (n) => `Ntarengwa: amashusho ${n} ku mwitozo umwe.`,
    totalSizeLimit: (mb) => `Ingano yose igomba kuba munsi ya ${mb}MB.`,
  },
  fr: {
    pageTitle: "Scanner le menu",
    pageSubtitle: "Téléversez des photos de menu → extraction OCR → téléchargement Excel",
    step1Title: "1. Téléverser les images du menu",
    step1Desc: "Ajoutez plusieurs photos (par ex. chaque page du menu). Les articles, prix et descriptions sont extraits des images.",
    step2Title: "2. Aperçu et traitement",
    processAll: "Traiter toutes les images",
    processingPage: (c, t) => `Traitement de la page ${c} sur ${t}…`,
    resizeNote: "Les images sont redimensionnées avant l'envoi pour un traitement plus rapide. Veuillez patienter.",
    step3Title: "3. Vérifier et exporter",
    noItems: "Aucun article de menu n'a été extrait des images.",
    tryClearer: "Essayez des photos plus nettes, un meilleur éclairage ou assurez-vous que le texte du menu est visible.",
    startOver: "Recommencer",
    rawOcrTitle: "Ce que nous avons lu des images (texte OCR brut)",
    rawOcrEmpty: "(vide — l'OCR a peut-être échoué ou l'image était illisible)",
    maxImages: (n) => `Maximum ${n} images par session.`,
    totalSizeLimit: (mb) => `La taille totale doit être inférieure à ${mb} Mo.`,
  },
};

const MAX_IMAGES = 20;
const MAX_TOTAL_MB = 50;
const MAX_TOTAL_BYTES = MAX_TOTAL_MB * 1024 * 1024;
const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.82;

async function compressImageForOCR(
  file: File
): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      let targetW = w;
      let targetH = h;
      if (w > MAX_IMAGE_SIDE || h > MAX_IMAGE_SIDE) {
        if (w >= h) {
          targetW = MAX_IMAGE_SIDE;
          targetH = Math.round((h * MAX_IMAGE_SIDE) / w);
        } else {
          targetH = MAX_IMAGE_SIDE;
          targetW = Math.round((w * MAX_IMAGE_SIDE) / h);
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      try {
        const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        const base64 = dataUrl.split(",")[1] ?? "";
        resolve({ base64, mediaType: "image/jpeg" });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function fileToBase64(
  file: File
): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(",");
      const mediaType =
        header?.match(/data:([^;]+)/)?.[1] || "image/jpeg";
      resolve({ base64, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractPage(
  image: ImageFile,
  pageIndex: number
): Promise<{ items: MenuItem[]; rawText?: string }> {
  const file = image.file;
  let base64: string;
  let mediaType: string;
  const isImage = (file.type || "").startsWith("image/");
  if (isImage) {
    try {
      ({ base64, mediaType } = await compressImageForOCR(file));
    } catch {
      ({ base64, mediaType } = await fileToBase64(file));
    }
  } else {
    ({ base64, mediaType } = await fileToBase64(file));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  let res: Response;
  try {
    res = await fetch("/api/supplier/menu-extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: base64,
        mediaType,
        pageIndex,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        "OCR timed out for this image (took longer than 90 seconds)."
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || res.statusText || "Extraction failed");
  }
  const items = (data.items || []).map(
    (item: Omit<MenuItem, "id">) => ({
      ...item,
      subcategory: item.subcategory ?? "",
      id: `p${pageIndex}-${item.name}-${item.price ?? "n"}`,
    })
  );
  return { items, rawText: data.rawText };
}

async function processWithRetry(
  image: ImageFile,
  pageIndex: number,
  maxRetries = 3
): Promise<{ items: MenuItem[]; rawText?: string }> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await extractPage(image, pageIndex);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

export default function ScanMenuPage() {
  const language = useLanguageStore((s) => s.language);
  const ui = SCAN_MENU_UI[language] ?? SCAN_MENU_UI.en;
  const [images, setImages] = useState<ImageFile[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [lastRawText, setLastRawText] = useState<string>("");
  const resultsRef = useRef<HTMLDivElement>(null);

  const totalBytes = images.reduce(
    (acc: number, img: ImageFile) => acc + img.file.size,
    0
  );
  const canProcess =
    images.length > 0 &&
    images.length <= MAX_IMAGES &&
    totalBytes <= MAX_TOTAL_BYTES;

  const handleFiles = useCallback((files: ImageFile[]) => {
    setError(null);
    if (files.length > MAX_IMAGES) {
      setError(ui.maxImages(MAX_IMAGES));
      return;
    }
    const total = files.reduce((acc, f) => acc + f.file.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      setError(ui.totalSizeLimit(MAX_TOTAL_MB));
      return;
    }
    setImages(files);
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev: ImageFile[]) => {
      const next = prev.filter((f: ImageFile) => f.id !== id);
      next.forEach((f: ImageFile) => {
        if (!prev.find((p: ImageFile) => p.id === f.id))
          URL.revokeObjectURL(f.preview);
      });
      return next;
    });
    setError(null);
  }, []);

  const processAll = useCallback(async () => {
    if (!canProcess) return;
    setError(null);
    setProcessing(true);
    setProgress({ current: 0, total: images.length });

    const results: { items: MenuItem[]; rawText?: string }[] = [];
    const rawTextParts: string[] = [];

    try {
      for (let i = 0; i < images.length; i++) {
        setProgress({ current: i + 1, total: images.length });
        const result = await processWithRetry(images[i], i);
        results.push(result);
        if (result.rawText) {
          rawTextParts.push(
            `--- Page ${i + 1} ---\n${result.rawText}`
          );
        }
      }

      setLastRawText(rawTextParts.join("\n\n"));
      const merged = mergeMenuData(results);
      const withIds = addIds(merged);
      setMenuItems(withIds);
      setShowResults(true);
      setTimeout(
        () =>
          resultsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        100
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Processing failed. Please try again."
      );
    } finally {
      setProcessing(false);
    }
  }, [canProcess, images]);

  const startOver = useCallback(() => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setMenuItems([]);
    setError(null);
    setProgress({ current: 0, total: 0 });
    setShowResults(false);
    setLastRawText("");
  }, [images]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{ui.pageTitle}</h1>
        <p className="text-slate-600 mt-1">
          {ui.pageSubtitle}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{ui.step1Title}</CardTitle>
          <CardDescription>
            {ui.step1Desc}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <UploadZone
            onFiles={handleFiles}
            existingFiles={images}
            disabled={processing}
          />
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{ui.step2Title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ImagePreviewList
              files={images}
              onRemove={removeImage}
              disabled={processing}
            />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4">
                <Button
                  onClick={processAll}
                  disabled={!canProcess || processing}
                >
                  {processing
                    ? ui.processingPage(progress.current, progress.total)
                    : ui.processAll}
                </Button>
                {processing && (
                  <div className="flex-1 max-w-xs h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${
                          progress.total
                            ? (progress.current / progress.total) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                )}
              </div>
              {processing && (
                <p className="text-sm text-muted-foreground">
                  {ui.resizeNote}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showResults && (
        <div ref={resultsRef}>
        <Card>
          <CardHeader>
            <CardTitle>{ui.step3Title}</CardTitle>
          </CardHeader>
          <CardContent>
            {menuItems.length > 0 ? (
              <MenuResultsTable
                items={menuItems}
                onItemsChange={setMenuItems}
                onStartOver={startOver}
              />
            ) : (
              <div className="py-8 space-y-4">
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground">
                    {ui.noItems}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {ui.tryClearer}
                  </p>
                  <Button variant="outline" onClick={startOver}>
                    {ui.startOver}
                  </Button>
                </div>
                {lastRawText && (
                  <details className="mt-6 text-left">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">
                      {ui.rawOcrTitle}
                    </summary>
                    <pre className="mt-2 p-4 bg-muted rounded-lg text-xs text-foreground whitespace-pre-wrap break-words max-h-64 overflow-y-auto border">
                      {lastRawText || ui.rawOcrEmpty}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  );
}
