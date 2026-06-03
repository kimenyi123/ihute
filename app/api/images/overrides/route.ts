import { NextRequest, NextResponse } from "next/server"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import {
  getLegacyShopOverridesFile,
  getProductOverridesFile,
  getProductUploadsDir,
  getShopOverridesFile,
  getShopUploadsDir,
  normalizeShopImagePublicUrl,
  shopImagePublicUrl,
} from "@/lib/image-upload-paths"

export const runtime = "nodejs"

type Scope = "shop" | "product"

function clean(input: unknown): string {
  return typeof input === "string" ? input.trim() : ""
}

function safeSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120)
}

function normalizeCode(input: string): string {
  return input.replace(/\s+/g, " ").trim().toUpperCase()
}

function keyFor(scope: Scope, account: string, itemCode: string): string {
  const acc = normalizeCode(account)
  if (scope === "shop") return acc
  return `${acc}::${normalizeCode(itemCode)}`
}

/** Map legacy `/uploads/shops/x.png` entries to API serve URLs on read. */
function normalizeShopImageUrl(url: string): string {
  return normalizeShopImagePublicUrl(url)
}

async function readShopOverrideMap(): Promise<Record<string, string>> {
  const legacy = await readJsonMap(getLegacyShopOverridesFile())
  const published = await readJsonMap(getShopOverridesFile())
  const merged = { ...legacy, ...published }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(merged)) {
    out[k] = normalizeShopImageUrl(v)
  }
  return out
}

async function writeShopOverrideMap(map: Record<string, string>): Promise<void> {
  await writeJsonMap(getShopOverridesFile(), map)
  await writeJsonMap(getLegacyShopOverridesFile(), map)
}

async function readJsonMap(filePath: string): Promise<Record<string, string>> {
  try {
    const raw = await readFile(filePath, "utf8")
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

async function writeJsonMap(filePath: string, map: Record<string, string>): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(map, null, 2), "utf8")
}

export async function GET(req: NextRequest) {
  const scope = clean(req.nextUrl.searchParams.get("scope")) as Scope
  const account = clean(req.nextUrl.searchParams.get("account"))
  const itemCode = clean(req.nextUrl.searchParams.get("itemCode"))

  if (scope !== "shop" && scope !== "product") {
    return NextResponse.json({ ok: false, error: "scope must be 'shop' or 'product'" }, { status: 400 })
  }

  const map =
    scope === "shop" ? await readShopOverrideMap() : await readJsonMap(getProductOverridesFile())
  if (!account) {
    return NextResponse.json({ ok: true, scope, map })
  }

  if (scope === "shop") {
    const k = keyFor("shop", account, "")
    return NextResponse.json({
      ok: true,
      scope,
      account,
      imageUrl: map[k] || map[account] || "",
    })
  }

  if (itemCode) {
    const k = keyFor("product", account, itemCode)
    return NextResponse.json({ ok: true, scope, account, itemCode, imageUrl: map[k] || "" })
  }

  const prefix = `${normalizeCode(account)}::`
  const accountMap: Record<string, string> = {}
  for (const [k, v] of Object.entries(map)) {
    if (!k.startsWith(prefix)) continue
    accountMap[k.slice(prefix.length)] = v
  }
  return NextResponse.json({ ok: true, scope, account, map: accountMap })
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const scope = clean(form.get("scope")) as Scope
  const account = clean(form.get("account"))
  const itemCode = clean(form.get("itemCode"))
  const file = form.get("file")

  if (scope !== "shop" && scope !== "product") {
    return NextResponse.json({ ok: false, error: "scope must be 'shop' or 'product'" }, { status: 400 })
  }
  if (!account) {
    return NextResponse.json({ ok: false, error: "account required" }, { status: 400 })
  }
  if (scope === "product" && !itemCode) {
    return NextResponse.json({ ok: false, error: "itemCode required for product scope" }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "file required" }, { status: 400 })
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "Only image files are allowed" }, { status: 400 })
  }

  const ext = (() => {
    const byType = file.type.split("/")[1] || "jpg"
    if (byType === "jpeg" || byType === "png" || byType === "webp" || byType === "gif") return byType
    return "jpg"
  })()

  const now = Date.now()
  const accountSafe = safeSegment(account.toUpperCase())
  const itemSafe = itemCode ? safeSegment(itemCode.toUpperCase()) : ""
  const fileName =
    scope === "shop" ? `${accountSafe}_${now}.${ext}` : `${accountSafe}_${itemSafe}_${now}.${ext}`

  const uploadDir = scope === "shop" ? getShopUploadsDir() : getProductUploadsDir()
  const absolutePath = path.join(uploadDir, fileName)

  await mkdir(uploadDir, { recursive: true })
  const buf = Buffer.from(await file.arrayBuffer())
  await writeFile(absolutePath, buf)

  const imageUrl =
    scope === "shop"
      ? shopImagePublicUrl(fileName)
      : `/uploads/products/${fileName}`

  if (scope === "shop") {
    const map = await readShopOverrideMap()
    map[keyFor(scope, account, itemCode)] = imageUrl
    await writeShopOverrideMap(map)
  } else {
    const map = await readJsonMap(getProductOverridesFile())
    map[keyFor(scope, account, itemCode)] = imageUrl
    await writeJsonMap(getProductOverridesFile(), map)
  }

  return NextResponse.json({
    ok: true,
    scope,
    account,
    itemCode: scope === "product" ? itemCode : undefined,
    imageUrl,
    storedPath: absolutePath,
  })
}
