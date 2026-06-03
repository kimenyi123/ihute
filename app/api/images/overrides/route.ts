import { NextRequest, NextResponse } from "next/server"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

export const runtime = "nodejs"

type Scope = "shop" | "product"

const DATA_DIR = path.join(process.cwd(), ".data")
const PUBLIC_DIR = path.join(process.cwd(), "public")
const PRODUCT_OVERRIDES_FILE = path.join(DATA_DIR, "supplier-image-overrides.json")
/** Legacy local-only index (gitignored). */
const SHOP_OVERRIDES_LEGACY_FILE = path.join(DATA_DIR, "shop-image-overrides.json")
/** Deployable index next to shop images — commit with `public/uploads/shops/*`. */
const SHOP_OVERRIDES_PUBLIC_FILE = path.join(PUBLIC_DIR, "uploads", "shops", "overrides.json")

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

function fileForScope(scope: Scope): string {
  return scope === "shop" ? SHOP_OVERRIDES_LEGACY_FILE : PRODUCT_OVERRIDES_FILE
}

async function readShopOverrideMap(): Promise<Record<string, string>> {
  const legacy = await readJsonMap(SHOP_OVERRIDES_LEGACY_FILE)
  const published = await readJsonMap(SHOP_OVERRIDES_PUBLIC_FILE)
  return { ...legacy, ...published }
}

async function writeShopOverrideMap(map: Record<string, string>): Promise<void> {
  await writeJsonMap(SHOP_OVERRIDES_PUBLIC_FILE, map)
  await writeJsonMap(SHOP_OVERRIDES_LEGACY_FILE, map)
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

  const map = scope === "shop" ? await readShopOverrideMap() : await readJsonMap(fileForScope(scope))
  if (!account) {
    return NextResponse.json({ ok: true, scope, map })
  }

  if (scope === "shop") {
    const k = keyFor("shop", account, "")
    return NextResponse.json({ ok: true, scope, account, imageUrl: map[k] || map[account] || "" })
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
  const fileBase = scope === "shop" ? `${accountSafe}_${now}` : `${accountSafe}_${itemSafe}_${now}`
  const relativeDir = scope === "shop" ? "uploads/shops" : "uploads/products"
  const relativePath = `${relativeDir}/${fileBase}.${ext}`
  const absolutePath = path.join(PUBLIC_DIR, relativePath)

  await mkdir(path.dirname(absolutePath), { recursive: true })
  const buf = Buffer.from(await file.arrayBuffer())
  await writeFile(absolutePath, buf)

  const imageUrl = `/${relativePath.replace(/\\/g, "/")}`
  if (scope === "shop") {
    const map = await readShopOverrideMap()
    map[keyFor(scope, account, itemCode)] = imageUrl
    await writeShopOverrideMap(map)
  } else {
    const mapFile = fileForScope(scope)
    const map = await readJsonMap(mapFile)
    map[keyFor(scope, account, itemCode)] = imageUrl
    await writeJsonMap(mapFile, map)
  }

  return NextResponse.json({
    ok: true,
    scope,
    account,
    itemCode: scope === "product" ? itemCode : undefined,
    imageUrl,
  })
}
