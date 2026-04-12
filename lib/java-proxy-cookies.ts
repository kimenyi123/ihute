/**
 * Undici / Node fetch does not expose Set-Cookie through headers.get() (it returns null).
 * Use getSetCookie() so session cookies from Java reach the browser after proxying.
 */
export function getJavaSetCookieValues(headers: Headers): string[] {
  const h = headers as Headers & { getSetCookie?: () => string[] }
  if (typeof h.getSetCookie === "function") {
    const list = h.getSetCookie()
    if (Array.isArray(list) && list.length > 0) return list
  }
  const legacy = headers.get("set-cookie")
  return legacy ? [legacy] : []
}

/** Normalize Java Tomcat cookies for the Next.js site (path + SameSite). */
export function rewriteForwardedSetCookie(raw: string): string {
  let rewritten = raw.replace(/Path=\/Trading/gi, "Path=/")
  if (!/samesite=/i.test(rewritten)) {
    rewritten += "; SameSite=Lax"
  }
  return rewritten
}
