import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { SessionProvider } from '@/lib/session'

const font = localFont({
  src: [
    { path: './fonts/Figtree-Variable.ttf', weight: '300 900', style: 'normal' },
    { path: './fonts/Figtree-Italic-Variable.ttf', weight: '300 900', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: { default: 'ChoiceMi Staff', template: '%s | ChoiceMi Staff' },
  description: 'ChoiceMi staff site: venues, bookings, identity checks and the helpdesk.',
  applicationName: 'ChoiceMi Staff',
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = { themeColor: '#110E18', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
