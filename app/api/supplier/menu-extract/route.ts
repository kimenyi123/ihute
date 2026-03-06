import { NextRequest, NextResponse } from "next/server";
import { parseMenuText, type ParsedMenuItem } from "@/lib/menu-scanner/parseMenuText";
import {
  preprocessOCRText,
  validateAndCleanPrices,
} from "@/lib/menu-scanner/priceDetection";

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

async function ocrWithOcrSpace(
  imageBase64: string,
  apiKey: string,
  mimeType = "image/jpeg"
): Promise<string> {
  const formData = new FormData();
  formData.append(
    "base64Image",
    `data:${mimeType};base64,${imageBase64}`
  );
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");
  formData.append("detectOrientation", "true");
  formData.append("scale", "true");
  formData.append("OCREngine", "2");

  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { apikey: apiKey },
    body: formData,
  });

  const data = (await response.json()) as {
    ParsedResults?: Array<{ ParsedText?: string }>;
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string | string[];
  };

  if (data.IsErroredOnProcessing) {
    const errMsg = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage[0]
      : data.ErrorMessage;
    throw new Error(errMsg || "OCR failed");
  }

  return data.ParsedResults?.[0]?.ParsedText ?? "";
}

async function ocrWithGoogleVision(
  imageBase64: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [
              { type: "DOCUMENT_TEXT_DETECTION" },
              { type: "TEXT_DETECTION" },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google Vision API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as {
    responses?: Array<{
      fullTextAnnotation?: { text?: string };
      error?: { message?: string };
    }>;
  };
  const first = data.responses?.[0];
  if (first?.error?.message) throw new Error(first.error.message);
  return first?.fullTextAnnotation?.text ?? "";
}

async function parseWithLlm(
  ocrText: string
): Promise<ParsedMenuItem[] | null> {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const prompt = `Extract menu items from this OCR text. Return ONLY a valid JSON array, no markdown or explanation.
For each item include: name, price (number or null), currency (e.g. "RWF" or "$"), description (string), category (string, Title Case), subcategory (string, optional), dietary_tags (array of strings).

OCR text:
${ocrText.slice(0, 6000)}

Example: [{"name":"Caesar Salad","price":12.99,"currency":"$","description":"","category":"Salads","dietary_tags":["vegetarian"]}]`;

  if (groqKey) {
    try {
      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.1-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
          }),
        }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) return null;
      const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
      const arr = JSON.parse(cleaned) as unknown[];
      return normalizeLlmItems(arr);
    } catch {
      return null;
    }
  }

  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) return null;
      const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
      const arr = JSON.parse(cleaned) as unknown[];
      return normalizeLlmItems(arr);
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeLlmItems(arr: unknown[]): ParsedMenuItem[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(
      (x): x is Record<string, unknown> =>
        x != null && typeof x === "object"
    )
    .map((o) => ({
      name: String(o.name ?? ""),
      price:
        typeof o.price === "number"
          ? o.price
          : o.price === null || o.price === undefined
            ? null
            : Number(o.price) || null,
      currency: String(o.currency ?? "RWF"),
      description: String(o.description ?? ""),
      category: String(o.category ?? "Uncategorized"),
      subcategory: String(o.subcategory ?? ""),
      dietary_tags: Array.isArray(o.dietary_tags)
        ? o.dietary_tags.map(String)
        : [],
    }))
    .filter((i) => i.name);
}

export async function POST(request: NextRequest) {
  const ocrSpaceKey = process.env.OCR_SPACE_API_KEY;
  const googleKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

  if (!ocrSpaceKey && !googleKey) {
    return NextResponse.json(
      {
        error:
          "No OCR API key configured. Set OCR_SPACE_API_KEY in .env.local (free at https://ocr.space/ocrapi, no credit card).",
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const {
      imageBase64,
      mediaType = "image/jpeg",
      pageIndex = 0,
    } = body as {
      imageBase64?: string;
      mediaType?: string;
      pageIndex?: number;
    };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid imageBase64" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(imageBase64, "base64");
    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image too large (max 20MB)" },
        { status: 400 }
      );
    }

    if (mediaType?.toLowerCase().includes("heic")) {
      return NextResponse.json(
        {
          error:
            "HEIC format is not supported. Please convert to JPG or PNG first.",
        },
        { status: 400 }
      );
    }

    let extractedText: string;
    if (ocrSpaceKey) {
      extractedText = await ocrWithOcrSpace(
        imageBase64,
        ocrSpaceKey,
        mediaType || "image/jpeg"
      );
    } else if (googleKey) {
      extractedText = await ocrWithGoogleVision(imageBase64, googleKey);
    } else {
      return NextResponse.json(
        { error: "No OCR provider available." },
        { status: 500 }
      );
    }

    const cleanedText = preprocessOCRText(extractedText);

    let items: ParsedMenuItem[];
    const llmItems = await parseWithLlm(cleanedText);
    if (llmItems != null && llmItems.length > 0) {
      items = llmItems;
    } else {
      items = parseMenuText(cleanedText);
    }

    const withPage = items.map((item) => ({
      name: item.name || "Unnamed",
      price: item.price,
      currency: item.currency ?? "RWF",
      description: item.description ?? "",
      category: item.category ?? "Uncategorized",
      subcategory: (item as { subcategory?: string }).subcategory ?? "",
      dietary_tags: item.dietary_tags ?? [],
      page_number: pageIndex + 1,
    }));

    const { items: validatedItems } = validateAndCleanPrices(withPage);

    return NextResponse.json({
      success: true,
      items: validatedItems,
      pageIndex,
      rawText: extractedText,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
