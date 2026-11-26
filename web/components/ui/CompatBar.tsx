import type { CompatDimension } from '@/types'

export function CompatBar({ dim }: { dim: CompatDimension; delay?: number }) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex justify-between">
        <span className="text-[13px] text-warm-700">{dim.d}</span>
        <span className="text-[13px] font-bold text-brand-700">{dim.p}%</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-warm-100">
        <div
          className="cm-bar h-full rounded-full"
          style={{ width: `${dim.p}%`, background: dim.c ?? 'var(--t5)' }}
        />
      </div>
    </div>
  )
}
