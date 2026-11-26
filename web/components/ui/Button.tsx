'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'white' | 'danger' | 'amber'
type Size = 'md' | 'sm' | 'xs'

// Full literal class names so Tailwind's content scanner keeps the component
// rules (a `btn-${variant}` template string would be invisible to it).
const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  white: 'btn-white',
  danger: 'btn-danger',
  amber: 'btn-amber',
}

const SIZE_CLASS: Record<Size, string> = {
  md: '',
  sm: 'btn-sm',
  xs: 'btn-xs',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block = true, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn('btn', VARIANT_CLASS[variant], SIZE_CLASS[size], !block && 'btn-auto', className)}
      {...props}
    />
  )
})
