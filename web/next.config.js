const path = require('path')

// STANDALONE=1 → static export bundled into the offline Android app (see
// scripts/build-standalone.mjs). Everything server-side runs in the app instead.
const STANDALONE = process.env.STANDALONE === '1'

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development' || STANDALONE,
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    // Never cache API routes — the compat engine, verification gate and
    // propose flow must always hit the real server, never a stale response.
    runtimeCaching: [
      {
        urlPattern: /^\/api\/.*/i,
        handler: 'NetworkOnly',
      },
      {
        // Pages: ask the network first so a new deploy shows on the very next
        // load, and only fall back to the cached copy when offline.
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: { cacheName: 'pages', networkTimeoutSeconds: 3 },
      },
    ],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Always defined so webpack can constant-fold the standalone branch in services/api.ts
  // away in normal builds (otherwise the in-app router drags fs-backed handlers into the client bundle).
  env: { NEXT_PUBLIC_STANDALONE: STANDALONE ? '1' : '0' },
  // Trace files from this folder only (a stray lockfile higher up would otherwise move the root).
  outputFileTracingRoot: __dirname,
  // Database drivers load native/WASM assets at runtime, so keep them out of the server bundle.
  serverExternalPackages: ['pg', '@electric-sql/pglite'],
  experimental: {
    typedRoutes: false,
  },
  // The app never uses next/image (all pictures are plain, pre-optimised files), so Next's image
  // optimiser endpoint is switched off entirely. That removes the attack surface of several published
  // Next.js flaws (image optimiser DoS, cache and AVIF issues) without affecting anything on screen.
  images: { unoptimized: true },
  ...(STANDALONE
    ? {
        output: 'export',
        trailingSlash: true,
        distDir: '.next-standalone',
        typescript: { tsconfigPath: 'tsconfig.standalone.json' },
      }
    : {}),
  // Docker image: a self-contained server in .next/standalone (see web/Dockerfile).
  // Off by default so Vercel and the offline app build are unaffected.
  ...(process.env.NEXT_OUTPUT === 'standalone' && !STANDALONE ? { output: 'standalone' } : {}),
  webpack(config, { webpack }) {
    // The build script moves app/api → app/_api (a private, non-routable folder)
    // because a static export can't contain API routes but the in-app router
    // still imports their handlers.
    config.resolve.alias['@api'] = path.resolve(__dirname, STANDALONE ? 'app/_api' : 'app/api')

    if (STANDALONE) {
      // Swap the two server-only modules the route handlers depend on for
      // on-device versions (cookie session → localStorage id, fs store → localStorage).
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^@\/lib\/server\/(jsonStore|session)$/, (resource) => {
          const name = resource.request.split('/').pop()
          resource.request = path.resolve(__dirname, 'lib/standalone', name)
        }),
      )
    }
    return config
  },
}

module.exports = withPWA(nextConfig)
