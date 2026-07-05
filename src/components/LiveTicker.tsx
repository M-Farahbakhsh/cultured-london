interface Props {
  items: string[]
}

// The city's pulse, straight from the database. The 88 to Dalston runs
// along the top: drives, stops, drives (see .bus-route in globals.css).
export default function LiveTicker({ items }: Props) {
  return (
    <div className="relative mt-10 mb-12">
      <svg
        width="58" height="34" viewBox="0 0 58 34" aria-hidden
        className="bus-route absolute -top-[30px]"
      >
        {/* body */}
        <rect x="1" y="1" width="52" height="26" rx="4" fill="#E32017"/>
        {/* upper deck windows */}
        <rect x="5" y="4.5" width="7" height="6" rx="1.5" fill="#FFE8ED"/>
        <rect x="14.5" y="4.5" width="7" height="6" rx="1.5" fill="#FFE8ED"/>
        <rect x="24" y="4.5" width="7" height="6" rx="1.5" fill="#FFE8ED"/>
        {/* route blind */}
        <rect x="35" y="4.5" width="14" height="6" rx="1.5" fill="#1A1817"/>
        <text x="42" y="9.6" textAnchor="middle" fill="#FFFFFF" fontSize="5.5" fontWeight="700" fontFamily="Inter, sans-serif">88</text>
        {/* lower deck windows + door */}
        <rect x="5" y="14" width="7" height="6.5" rx="1.5" fill="#FFE8ED"/>
        <rect x="14.5" y="14" width="7" height="6.5" rx="1.5" fill="#FFE8ED"/>
        <rect x="24" y="14" width="7" height="6.5" rx="1.5" fill="#FFE8ED"/>
        <rect x="42" y="13" width="8" height="14" rx="1.5" fill="#FFE8ED"/>
        {/* wheels */}
        <circle cx="13" cy="28.5" r="4.5" fill="#1A1817"/>
        <circle cx="13" cy="28.5" r="1.8" fill="#FFFFFF"/>
        <circle cx="42" cy="28.5" r="4.5" fill="#1A1817"/>
        <circle cx="42" cy="28.5" r="1.8" fill="#FFFFFF"/>
      </svg>

      <div className="ticker rounded-full bg-ink text-white overflow-hidden -rotate-[0.5deg] shadow-[5px_5px_0_0_#E32017]">
        <div className="ticker-track inline-flex whitespace-nowrap items-center py-1.5">
          {[0, 1].map(copy => (
            <span key={copy} className="inline-flex items-center">
              {items.map((item, i) => (
                <span key={i} className="inline-flex items-center">
                  <span className="mx-5 text-accent text-[13px]">✦</span>
                  {i % 2 === 1 ? (
                    <span className="font-serif italic text-accent text-[17px] tracking-normal">{item}</span>
                  ) : (
                    <span className="text-[12px] font-semibold lowercase tracking-[0.12em]">{item}</span>
                  )}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
