'use client'

import { cn } from '@/lib/utils'

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  tone?: 'default' | 'brand' | 'amber'
  size?: 'md' | 'sm'
}

export function Chip({
  active,
  tone = 'default',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      className={cn(
        'chip',
        size === 'sm' && 'sm',
        active && 'on',
        !active && tone === 'brand' && 'brand',
        !active && tone === 'amber' && 'amber',
        className,
      )}
      {...props}
    />
  )
}
