import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import {
  getLegacyShopOverridesFile,
  getShopOverridesFile,
  getShopUploadsDir,
  normalizeShopImagePublicUrl,
  shopImagePublicUrl,
} from "@/lib/image-upload-paths"
import {
  normalizeShopAccountKey,
  stableShopPhotoFileName,
  stableShopPhotoWebPath,
} from "@/lib/shop-photo-stable"

export { normalizeShopAccountKey }

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

export async function readShopOverrideMap(): Promise<Record<string, string>> {
  const legacy = await readJsonMap(getLegacyShopOverridesFile())
  const published = await readJsonMap(getShopOverridesFile())
  const merged = { ...legacy, ...published }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(merged)) {
    out[k] = normalizeShopImagePublicUrl(v)
  }
  return out
}

export async function writeShopOverrideMap(map: Record<string, string>): Promise<void> {
  await writeJsonMap(getShopOverridesFile(), map)
  await writeJsonMap(getLegacyShopOverridesFile(), map)
}

/** Persist shop logo on Next.js disk + overrides map (survives Tomcat redeploy on beta). */
export async function persistShopImageUpload(
  account: string,
  fileData: Buffer | File,
  contentType?: string,
  originalName?: string
): Promise<{ fileName: string; imageUrl: string; storedPath: string; webPath: string }> {
  let mime = (contentType || "").trim()
  if (!mime && fileData instanceof File) {
    mime = fileData.type
  }

  const ext = (() => {
    const byType = (mime.split("/")[1] || "jpg").toLowerCase()
    if (byType === "jpeg" || byType === "png" || byType === "webp" || byType === "gif") return byType
    return "jpg"
  })()

  const fileName = stableShopPhotoFileName(account, ext)
  const uploadDir = getShopUploadsDir()
  const absolutePath = path.join(uploadDir, fileName)

  await mkdir(uploadDir, { recursive: true })
  const buf =
    fileData instanceof File ? Buffer.from(await fileData.arrayBuffer()) : fileData
  await writeFile(absolutePath, buf)

  // Store relative path so overrides survive env / domain changes; normalized on read.
  const imageUrl = `/api/images/shops/${encodeURIComponent(fileName)}`
  const map = await readShopOverrideMap()
  map[normalizeShopAccountKey(account)] = imageUrl
  await writeShopOverrideMap(map)

  return {
    fileName,
    imageUrl: shopImagePublicUrl(fileName),
    storedPath: absolutePath,
    webPath: stableShopPhotoWebPath(account, ext),
  }
}
