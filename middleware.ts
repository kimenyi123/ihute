import { NextResponse, type NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase()
  const { pathname } = req.nextUrl

  // Serve the Grandma approval page on the grandma subdomain root.
  if (host.startsWith("grandma.ihute.rw")) {
    if (pathname === "/" || pathname === "") {
      const url = req.nextUrl.clone()
      url.pathname = "/grandma"
      return NextResponse.rewrite(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|sw.js).*)"],
}

