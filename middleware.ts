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
    const grandmaReferer = referer.includes("/grandma")
    if (grandmaHost || grandmaRedirect || grandmaReferer) {
      const url = req.nextUrl.clone()
      url.pathname = "/grandma/login"
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

