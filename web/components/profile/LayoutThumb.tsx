import type { ProfileLayout } from '@/types'

/** A tiny drawing of each profile design, so members can compare them at a glance. */
export function LayoutThumb({ id }: { id: ProfileLayout }) {
  const line = 'h-1 rounded-full bg-warm-200'
  if (id === 'timeline')
    return (
      <div className="h-[86px] rounded-lg border border-warm-100 bg-white p-2">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-5 w-5 rounded-full border-2 border-brand-500" />
          <span className="h-1.5 w-12 rounded-full bg-brand-300" />
        </div>
        <div className="ml-2 space-y-1.5 border-l-2 border-brand-200 pl-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative">
              <span className="absolute -left-[15px] top-0 h-2 w-2 rounded-full border-2 border-brand-500 bg-white" />
              <div className={`${line} w-3/4`} />
            </div>
          ))}
        </div>
      </div>
    )
  if (id === 'sidebar')
    return (
      <div className="flex h-[86px] overflow-hidden rounded-lg border border-warm-100 bg-white">
        <div className="w-1/3 bg-brand-sheen p-1.5">
          <span className="mb-1.5 block h-4 w-4 rounded-full bg-white/40" />
          <div className="mb-1 h-1 w-full rounded-full bg-white/50" />
          <div className="h-1 w-2/3 rounded-full bg-white/40" />
        </div>
        <div className="flex-1 space-y-2 p-2">
          <div className="h-1.5 w-1/2 rounded-full bg-brand-300" />
          <div className={line} />
          <div className={`${line} w-5/6`} />
          <div className="h-1.5 w-1/3 rounded-full bg-brand-300" />
          <div className={`${line} w-2/3`} />
        </div>
      </div>
    )
  if (id === 'colorblock')
    return (
      <div className="h-[86px] overflow-hidden rounded-lg border border-warm-100 bg-white">
        <div className="flex h-8">
          <div className="w-3/5 bg-warm-900" />
          <div className="w-2/5 bg-brand-600" />
        </div>
        <div className="flex">
          <div className="w-3/5 space-y-1.5 p-2">
            <div className="-mx-2 h-2 bg-brand-600" />
            <div className={line} />
            <div className={`${line} w-3/4`} />
          </div>
          <div className="w-2/5 space-y-1.5 bg-warm-50 p-2">
            <div className="-mx-2 h-2 bg-warm-800" />
            <div className={line} />
            <div className={`${line} w-2/3`} />
          </div>
        </div>
      </div>
    )
  return (
    <div className="h-[86px] rounded-lg border-2 border-rose-200 bg-[#fff8fa] p-2 text-center">
      <div className="mx-auto mb-1 flex h-5 w-8 items-center justify-center">
        <span className="h-3 w-3 rounded-full bg-rose-300 ring-2 ring-rose-100" />
      </div>
      <div className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-rose-400" />
      <div className="mx-auto w-5/6 space-y-1.5">
        <div className="h-1 rounded-full bg-rose-100" />
        <div className="h-1 w-4/5 rounded-full bg-rose-100" />
        <div className="h-1 w-3/5 rounded-full bg-rose-100" />
      </div>
    </div>
  )
}
