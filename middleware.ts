import { NextResponse, type NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase()
  const { pathname } = req.nextUrl

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

