import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { ToastViewport } from '@/components/ui/Toast'

// Self-hosted Figtree (variable, weights 300-900) so the build has no network
// dependency and the app works fully offline. One clean geometric sans for
// headings, body and UI, close to the Proxima-style type dating apps use.
// Real weights come from the variable file, so bold headings are drawn, not
// faked. `--font-serif` and `--font-ui` are aliases of this family (globals.css).
const brandFont = localFont({
  src: [
    { path: './fonts/Figtree-Variable.ttf', weight: '300 900', style: 'normal' },
    { path: './fonts/Figtree-Italic-Variable.ttf', weight: '300 900', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-sans',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'ChoiceMi | Blind dates, built on compatibility',
  description:
    'Anonymous, compatibility-first blind dating. No photos and no small talk. Read the person, pass the quiz, meet for real.',
  applicationName: 'ChoiceMi',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'ChoiceMi' },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#2E1065',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={brandFont.variable}>
      <body>
        {children}
        <ToastViewport />
      </body>
    </html>
  )
}
