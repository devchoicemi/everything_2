/**
 * The restaurant site is its own app. It has no backend of its own: it talks to the ChoiceMi API
 * (/api/v1/...) on the same address. In production the reverse proxy (Caddy) sends /api/* on
 * restaurant.choicemi.com to the ChoiceMi backend, so sign-in cookies stay on this site. In development
 * set BACKEND_URL (for example http://localhost:3000) and Next forwards /api/* there.
 */
const BACKEND = (process.env.BACKEND_URL || '').replace(/\/+$/, '')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  outputFileTracingRoot: __dirname,
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' } : {}),
  async rewrites() {
    return BACKEND ? [{ source: '/api/:path*', destination: `${BACKEND}/api/:path*` }] : []
  },
}

module.exports = nextConfig
