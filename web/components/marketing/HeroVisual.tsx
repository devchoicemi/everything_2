'use client'

import { ShieldCheck, Sparkles } from 'lucide-react'

const MINI = [
  { un: 'Maple_Dusk', meta: '28 · Helsinki', score: 87, av: 'M', avc: '#534AB7', chips: ['Introvert', 'Morning person'] },
  { un: 'Cedar_Mist', meta: '31 · Helsinki', score: 82, av: 'C', avc: '#C026D3', chips: ['Ambivert', 'Active'] },
]

export function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px] select-none">
      {/* connector glow */}
      <div className="absolute inset-0 rounded-full bg-radial-brand blur-2xl" />

      {/* center compatibility ring */}
      <div className="absolute left-1/2 top-1/2 z-10 flex h-[190px] w-[190px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/90 shadow-glow backdrop-blur">
        <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90">
          <defs>
            <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#6d28d9" />
              <stop offset="0.6" stopColor="#c026d3" />
              <stop offset="1" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--w1)" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="url(#ring)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="326"
            strokeDashoffset="52"
            className="cm-bar"
          />
        </svg>
        <div className="relative text-center">
          <div className="font-serif-i text-[34px] leading-none text-brand-700">87%</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-warm-400">
            Compatible
          </div>
        </div>
      </div>

      {/* floating mini cards */}
      <FloatCard data={MINI[0]} className="left-0 top-6 animate-float" />
      <FloatCard data={MINI[1]} className="bottom-4 right-0 animate-float-slow" />

      {/* badges */}
      <div className="absolute -left-2 bottom-24 z-20 flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3 py-2 text-[12px] font-semibold text-brand-800 shadow-lg animate-float-slow">
        <ShieldCheck size={15} className="text-brand-600" />
        ID verified
      </div>
      <div className="absolute right-6 top-0 z-20 flex items-center gap-2 rounded-full border border-amber-100 bg-white px-3 py-2 text-[12px] font-semibold text-amber-600 shadow-lg animate-float">
        <Sparkles size={15} />
        No photos
      </div>
    </div>
  )
}

function FloatCard({
  data,
  className,
}: {
  data: (typeof MINI)[number]
  className?: string
}) {
  return (
    <div
      className={`absolute z-20 w-[210px] overflow-hidden rounded-2xl border border-warm-100 bg-white shadow-xl ${className ?? ''}`}
    >
      <div className="h-1.5 bg-brand-cta" />
      <div className="p-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className="font-serif-i flex h-9 w-9 items-center justify-center rounded-full text-[15px] text-white"
            style={{ background: data.avc }}
          >
            {data.av}
          </span>
          <div>
            <div className="font-serif-i text-[15px] text-warm-900">{data.un}</div>
            <div className="text-[11px] text-warm-500">{data.meta}</div>
          </div>
          <span className="ml-auto text-[13px] font-bold text-brand-700">{data.score}%</span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {data.chips.map((c) => (
            <span
              key={c}
              className="rounded-full border border-warm-200 px-2 py-0.5 text-[10px] font-medium text-warm-600"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
