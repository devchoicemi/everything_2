const ITEMS = [
  'No profile photos',
  'Identity-verified members',
  'Read-verification quiz',
  'No chat, ever',
  'Partner-venue first dates',
  'Compatibility scored across 5 dimensions',
  'Mutual matches only',
  'Two-way safety feedback',
]

export function ValueMarquee() {
  return (
    <div className="bg-brand-sheen py-4">
      <div className="relative flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div className="flex shrink-0 animate-marquee items-center gap-10 pr-10">
          {[...ITEMS, ...ITEMS].map((it, i) => (
            <span
              key={i}
              className="flex items-center gap-3 whitespace-nowrap text-[13px] font-semibold uppercase tracking-wider text-white/90"
            >
              {it}
              <span className="h-1.5 w-1.5 rounded-full bg-pink-300" />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
