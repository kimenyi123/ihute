import { NextResponse, type NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase()
  const { pathname } = req.nextUrl
  const redirectParam = req.nextUrl.searchParams.get("redirect") || ""
  const referer = (req.headers.get("referer") || "").toLowerCase()

  // Keep Grandma auth fully isolated from the main Ihute /login page.
  // This catches stale links/bookmarks and sends them to /grandma/login.
  if (pathname === "/login") {
    const grandmaHost = host === "shop.ihute.rw" || host.startsWith("grandma.ihute.rw")
    const grandmaRedirect = (() => {
      if (!redirectParam) return false
      try {
        const decoded = decodeURIComponent(redirectParam)
        return decoded.startsWith("/grandma")
      } catch {
        return redirectParam.startsWith("/grandma")
      }
    })()
    const adminRedirect = (() => {
      if (!redirectParam) return false
      try {
        const decoded = decodeURIComponent(redirectParam)
        return decoded.startsWith("/admin")
      } catch {
        return redirectParam.startsWith("/admin")
      }
    })()
    const grandmaReferer = referer.includes("/grandma") && !adminRedirect
    if (!adminRedirect && (grandmaHost || grandmaRedirect || grandmaReferer)) {
      const url = req.nextUrl.clone()
      url.pathname = "/grandma/login"
      return NextResponse.redirect(url, 307)
    }
  }

  if (pathname === "/register/buyer" || pathname === "/register/seller") {
    const url = req.nextUrl.clone()
    const role = pathname.includes("buyer") ? "buyer" : "seller"
    const grandmaHost = host === "shop.ihute.rw" || host.startsWith("grandma.ihute.rw")

    // Local dev override: add ?surface=grandma to URL to simulate shop.ihute.rw
    const surfaceOverride = url.searchParams.get("surface")
    const isLocalDevHost = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0"
    const isGrandma =
      grandmaHost ||
      (process.env.NODE_ENV === "development" && (surfaceOverride === "grandma" || isLocalDevHost))

    if (isGrandma) {
      url.pathname = `/register/grandma-${role}`
      url.searchParams.delete("surface")
    } else {
      url.pathname = `/register/web-form`
      url.searchParams.set("role", role)
    }
    return NextResponse.rewrite(url)
  }

  if (pathname === "/forgot-password") {
    const url = req.nextUrl.clone()
    const grandmaHost = host === "shop.ihute.rw" || host.startsWith("grandma.ihute.rw")
    const surfaceOverride = url.searchParams.get("surface")
    const isGrandma =
      grandmaHost ||
      (process.env.NODE_ENV === "development" && surfaceOverride === "grandma")

    if (isGrandma) {
      url.pathname = "/forgot-password/grandma"
      url.searchParams.delete("surface")
    } else {
      url.pathname = "/forgot-password/web-form"
    }
    return NextResponse.rewrite(url)
  }

  if (pathname === "/reset-password") {
    const grandmaHost = host === "shop.ihute.rw" || host.startsWith("grandma.ihute.rw")
    const surfaceOverride = req.nextUrl.searchParams.get("surface")
    const isGrandma =
      grandmaHost ||
      (process.env.NODE_ENV === "development" && surfaceOverride === "grandma")
    if (isGrandma) {
      const url = req.nextUrl.clone()
      url.pathname = "/forgot-password"
      url.searchParams.delete("surface")
      return NextResponse.redirect(url, 307)
    }
  }

  // Grandma UI is served on shop.ihute.rw; apex /grandma was 404 for some deployments — send users to shop.
  if (host === "ihute.rw" || host === "www.ihute.rw") {
    if (pathname === "/grandma" || pathname.startsWith("/grandma/")) {
      const url = req.nextUrl.clone()
      url.hostname = "shop.ihute.rw"
      return NextResponse.redirect(url, 308)
    }
  }

  // Grandma shopping UI: primary subdomain shop.ihute.rw (also support legacy grandma.ihute.rw)
  if (host === "shop.ihute.rw" || host.startsWith("grandma.ihute.rw")) {
    if (pathname === "/" || pathname === "") {
      const url = req.nextUrl.clone()
      url.pathname = "/grandma"
      return NextResponse.rewrite(url)
    }
  }

  // Dedicated registration entry points (configure DNS A/CNAME to same deployment as ihute.rw)
  if (host === "seller.ihute.rw") {
    if (pathname === "/" || pathname === "") {
      const url = req.nextUrl.clone()
      url.pathname = "/register/seller"
      return NextResponse.rewrite(url)
    }
  }

  if (host === "rider.ihute.rw") {
    if (pathname === "/" || pathname === "") {
      const url = req.nextUrl.clone()
      url.pathname = "/register/rider"
      return NextResponse.rewrite(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|sw.js).*)"],
}

