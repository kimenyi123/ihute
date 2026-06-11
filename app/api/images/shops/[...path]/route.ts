import { NextRequest, NextResponse } from "next/server"
import { readFile, stat } from "fs/promises"
import path from "path"
import { getShopUploadsDir } from "@/lib/image-upload-paths"

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

/** Serve uploaded shop logos from disk (beta-safe when cwd/public differs from localhost). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const segments = (await ctx.params).path || []
  if (segments.length !== 1) {
    return NextResponse.json({ ok: false, error: "Invalid path" }, { status: 400 })
  }

  const fileName = path.basename(decodeURIComponent(segments[0] || ""))
  if (!fileName || fileName === "." || fileName === "overrides.json") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  }

  const baseDir = getShopUploadsDir()
  const absolute = path.resolve(baseDir, fileName)
  if (!absolute.startsWith(path.resolve(baseDir) + path.sep) && absolute !== path.resolve(baseDir)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  try {
    const info = await stat(absolute)
    if (!info.isFile()) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }
    const buf = await readFile(absolute)
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(absolute),
        "Cache-Control": "public, max-age=300",
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  }
}
