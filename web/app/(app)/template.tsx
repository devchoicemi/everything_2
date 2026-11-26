'use client'

import { PageTransition } from '@/components/common/PageTransition'

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
