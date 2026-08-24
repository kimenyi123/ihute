import { NextRequest, NextResponse } from "next/server"
import { readFile, stat } from "fs/promises"
import path from "path"
import { warmJavaBackendBase, getBackendBaseForProxy } from "@/lib/backend-config"
import { getShopUploadsDir } from "@/lib/image-upload-paths"
import { readShopOverrideMap } from "@/lib/shop-image-overrides"
import {
  parseShopPhotoAccountFromWebPath,
  stableShopPhotoFileName,
} from "@/lib/shop-photo-stable"

export const runtime = "nodejs"

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
}

function contentTypeFor(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream"
}

function imageResponse(buf: Buffer, filePath: string): NextResponse {
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(filePath),
      "Cache-Control": "public, max-age=300",
    },
  })
}

async function readLocalShopFile(fileName: string): Promise<Buffer | null> {
  const baseDir = getShopUploadsDir()
  const absolute = path.resolve(baseDir, path.basename(fileName))
  if (!absolute.startsWith(path.resolve(baseDir) + path.sep)) return null
  try {
    const info = await stat(absolute)
    if (!info.isFile()) return null
    return await readFile(absolute)
  } catch {
    return null
  }
}

async function fetchTomcatShopImage(rawPath: string): Promise<Buffer | null> {
  await warmJavaBackendBase()
  const backend = getBackendBaseForProxy().replace(/\/+$/, "")
  const upstream = `${backend}${rawPath}`
  try {
    const res = await fetch(upstream, { cache: "no-store" })
    if (!res.ok) return null
    const ct = (res.headers.get("Content-Type") || "").toLowerCase()
    if (ct.includes("json") || ct.includes("text/html")) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

function overrideFileName(overrideUrl: string): string | null {
  const m = String(overrideUrl || "").match(/\/api\/images\/shops\/([^/?#]+)/i)
  return m ? decodeURIComponent(m[1]) : null
}

/** Serve account_seller.photo paths (/img/shops/…) from Tomcat, with Next disk + override fallbacks. */
export async function GET(req: NextRequest) {
  const rawPath = (req.nextUrl.searchParams.get("path") || "").trim()
  if (!rawPath || !rawPath.startsWith("/img/shops/")) {
    return NextResponse.json({ ok: false, error: "Invalid path" }, { status: 400 })
  }
  if (rawPath.includes("..")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const basename = path.basename(rawPath)
  const accountKey = parseShopPhotoAccountFromWebPath(rawPath)
  const ext = path.extname(basename).replace(/^\./, "") || "png"
  const stableName = accountKey ? stableShopPhotoFileName(accountKey, ext) : null
  const stablePath = stableName ? `/img/shops/${stableName}` : null

  const candidates: { kind: "tomcat" | "local"; pathOrName: string }[] = [
    { kind: "tomcat", pathOrName: rawPath },
  ]
  if (stablePath && stablePath !== rawPath) {
    candidates.push({ kind: "tomcat", pathOrName: stablePath })
  }
  candidates.push({ kind: "local", pathOrName: basename })
  if (stableName && stableName !== basename) {
    candidates.push({ kind: "local", pathOrName: stableName })
  }

  if (accountKey) {
    const overrides = await readShopOverrideMap()
    const overrideUrl = overrides[accountKey]
    const overrideName = overrideUrl ? overrideFileName(overrideUrl) : null
    if (overrideName) {
      candidates.push({ kind: "local", pathOrName: overrideName })
    }
  }

  const seen = new Set<string>()
  for (const c of candidates) {
    const key = `${c.kind}:${c.pathOrName}`
    if (seen.has(key)) continue
    seen.add(key)

    if (c.kind === "tomcat") {
      const buf = await fetchTomcatShopImage(c.pathOrName)
      if (buf && buf.length > 0) {
        return imageResponse(buf, c.pathOrName)
      }
      continue
    }

    const buf = await readLocalShopFile(c.pathOrName)
    if (buf && buf.length > 0) {
      return imageResponse(buf, c.pathOrName)
    }
  }

  return NextResponse.json(
    { ok: false, error: "Not found", path: rawPath, account: accountKey },
    { status: 404 },
  )
}
