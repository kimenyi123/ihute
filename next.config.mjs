/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const backendBase = process.env.NEXT_PUBLIC_API_URL || 'https://ihute.rw/Trading_beta'

    return [
      // Proxy B2B API requests to Java servlet
      {
        source: '/supplier/b2b/api/:path*',
        destination: 'http://localhost:8080/supplier/b2b/api/:path*',
      },
      // Proxy other supplier APIs if needed
      {
        source: '/api/supplier/:path*',
        destination: 'http://localhost:8080/api/supplier/:path*',
      },
      // ─── Payment API proxy ───────────────────────────────────────────────
      // Routes /api/payment/* and /api/analytics/* through the Next.js
      // server so browser CORS never triggers (server-to-server has no CORS).
      {
        source: '/api/payment/:path*',
        destination: `${backendBase}/api/payment/:path*`,
      },
      {
        source: '/api/analytics/:path*',
        destination: `${backendBase}/api/analytics/:path*`,
      },
    ]
  },
}

export default nextConfig
