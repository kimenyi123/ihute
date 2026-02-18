/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
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
    ]
  },
}

export default nextConfig
