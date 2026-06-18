import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  /** Monorepo: lockfile may exist in parent (`Ihute-new-v/`); pin Turbopack root to this app. */
  turbopack: {
    root: path.resolve(__dirname),
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const raw = (
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.JAVA_BACKEND_BASE ||
      'http://localhost:8082/Trading'
    ).replace(/\/+$/, '')
    const javaBase = raw.toLowerCase().includes('/trading') ? raw : `${raw}/Trading`

    return [
      // Proxy B2B API requests to Java servlet (same host/port as JAVA_BACKEND_BASE / NEXT_PUBLIC_API_URL)
      {
        source: '/supplier/b2b/api/:path*',
        destination: `${javaBase}/supplier/b2b/api/:path*`,
      },
      {
        source: '/api/supplier/:path*',
        destination: `${javaBase}/api/supplier/:path*`,
      },
      // ─── Payment API proxy ───────────────────────────────────────────────
      // Routes /api/payment/* and /api/analytics/* through the Next.js
      // server so browser CORS never triggers (server-to-server has no CORS).
      {
        source: '/api/payment/:path*',
        destination: `${javaBase}/api/payment/:path*`,
      },
      {
        source: '/api/analytics/:path*',
        destination: `${javaBase}/api/analytics/:path*`,
      },
      {
        source: '/api/payers',
        destination: `${javaBase}/api/payers`,
      },
      {
        source: '/api/payers/:path*',
        destination: `${javaBase}/api/payers/:path*`,
      },
      {
        source: '/api/seller-payers',
        destination: `${javaBase}/api/seller-payers`,
      },
      {
        source: '/api/seller-payers/:path*',
        destination: `${javaBase}/api/seller-payers/:path*`,
      },
      {
        source: '/api/seller-payments/:path*',
        destination: `${javaBase}/api/seller-payments/:path*`,
      },
    ]
  },

  /** Dev: slow first compile on large pages can exceed default chunk fetch timeout → ChunkLoadError. */
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.output = { ...config.output, chunkLoadTimeout: 300_000 }
    }
    return config
  },
}

export default nextConfig
