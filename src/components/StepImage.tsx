/** Placeholder illustration for a tutorial step (no external images). */
export function StepImage({ n, caption }: { n: number; caption?: string }) {
  const hue = (n * 37 + 180) % 360
  return (
    <svg viewBox="0 0 320 180" className="step-image" role="img" aria-label={caption}>
      <defs>
        <linearGradient id={`g${n}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 45% 92%)`} />
          <stop offset="1" stopColor={`hsl(${hue} 40% 80%)`} />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#g${n})`} />
      <g transform="translate(120 30) skewY(-6)">
        <rect width="80" height="120" rx="3" fill="rgb(255 255 255 / 55%)" stroke={`hsl(${hue} 35% 45%)`} strokeWidth="2" />
        <path d="M14 18 L40 8 M14 34 L60 14" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      </g>
      <circle cx="28" cy="28" r="16" fill={`hsl(${hue} 35% 35%)`} />
      <text x="28" y="33" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff">
        {n}
      </text>
      {caption && (
        <text x="160" y="168" textAnchor="middle" fontSize="12" fill={`hsl(${hue} 30% 25%)`}>
          {caption}
        </text>
      )}
    </svg>
  )
}
