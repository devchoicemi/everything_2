import { BrandPhoto, type BrandPhotoName } from '@/components/ui/BrandPhoto'
import { cn } from '@/lib/utils'

/** Consistent page header used across the app screens. With `photo` it becomes a banner. */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
  photo,
  photoPosition,
}: {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  photo?: BrandPhotoName
  photoPosition?: string
}) {
  if (photo) {
    return (
      <div className={cn('relative isolate mb-7 overflow-hidden rounded-3xl text-white shadow-lg', className)}>
        <BrandPhoto name={photo} position={photoPosition} className="absolute inset-0 -z-20 h-full w-full" />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(100deg, rgba(27,10,61,0.92) 0%, rgba(87,20,184,0.78) 60%, rgba(236,72,153,0.55) 100%)',
          }}
        />
        <div className="flex flex-wrap items-end justify-between gap-4 px-6 py-7 sm:px-8 sm:py-9">
          <div>
            <h1 className="font-serif text-display-md">{title}</h1>
            {subtitle && <p className="mt-1 text-[14px] text-white/75">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('mb-7 flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        <h1 className="font-serif text-display-md text-warm-900">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-warm-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
