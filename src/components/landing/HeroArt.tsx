import { useId } from 'react'

/** Original scenic illustration: dusk sky, layered hills, a river and a bus on a winding road. No external images. */
export function HeroArt({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B3328" />
          <stop offset=".55" stopColor="#14604A" />
          <stop offset="1" stopColor="#7DB89A" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#F6E7B6" stopOpacity=".95" />
          <stop offset="1" stopColor="#F6E7B6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-river`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9BD3C3" />
          <stop offset="1" stopColor="#5FA897" />
        </linearGradient>
      </defs>
      <rect width="1200" height="640" fill={`url(#${id}-sky)`} />
      <circle cx="860" cy="250" r="190" fill={`url(#${id}-sun)`} />
      <circle cx="860" cy="250" r="46" fill="#F6E7B6" opacity=".92" />
      {/* far hills */}
      <path d="M0 360 C140 290 260 330 380 300 C520 262 600 320 740 296 C880 270 1000 320 1200 280 V640 H0Z" fill="#2E7D63" opacity=".55" />
      <path d="M0 410 C170 350 300 400 450 366 C600 332 700 400 860 372 C1000 348 1100 392 1200 360 V640 H0Z" fill="#1F6B54" opacity=".8" />
      {/* river */}
      <path d="M-20 470 C200 430 330 500 520 470 C720 438 800 380 1000 396 C1100 404 1160 420 1240 410 V470 C1160 480 1100 466 1000 456 C820 442 760 500 540 530 C340 560 200 512 -20 530Z" fill={`url(#${id}-river)`} opacity=".85" />
      {/* near hills */}
      <path d="M0 520 C160 470 320 530 520 505 C700 482 860 540 1040 506 C1120 492 1170 500 1200 494 V640 H0Z" fill="#0F4A39" />
      <path d="M0 585 C200 548 380 596 600 572 C820 548 980 602 1200 566 V640 H0Z" fill="#0A3328" />
      {/* trees */}
      {[
        [96, 520, 1], [140, 534, 0.8], [210, 548, 1.1], [1010, 540, 1], [1066, 552, 0.8], [1130, 536, 1.1], [330, 566, 0.9],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <rect x="-2" y="0" width="4" height="16" fill="#0A3328" />
          <path d="M0 -44 L20 -4 H-20Z" fill="#165842" />
          <path d="M0 -28 L24 12 H-24Z" fill="#1E6F55" />
        </g>
      ))}
      {/* road with route line */}
      <path d="M-30 612 C240 560 440 600 660 560 C860 524 980 556 1240 520" fill="none" stroke="#082A21" strokeWidth="46" strokeLinecap="round" />
      <path d="M-30 612 C240 560 440 600 660 560 C860 524 980 556 1240 520" fill="none" stroke="#F6E7B6" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 22" opacity=".9" />
      {/* stops */}
      {[[250, 573], [660, 560], [1010, 541]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y - 34})`}>
          <path d="M0 0 L-9 -22 A14 14 0 1 1 9 -22Z" fill="#F6E7B6" />
          <circle cx="0" cy="-26" r="5" fill="#0F4A39" />
        </g>
      ))}
      {/* bus */}
      <g transform="translate(430 540)">
        <rect x="-62" y="-44" width="124" height="46" rx="12" fill="#F4F1E6" />
        <rect x="-62" y="-14" width="124" height="14" fill="#2E7D63" />
        <rect x="-54" y="-36" width="22" height="16" rx="4" fill="#0F4A39" />
        <rect x="-26" y="-36" width="22" height="16" rx="4" fill="#0F4A39" />
        <rect x="2" y="-36" width="22" height="16" rx="4" fill="#0F4A39" />
        <rect x="30" y="-36" width="26" height="22" rx="4" fill="#0F4A39" />
        <circle cx="-34" cy="4" r="9" fill="#082A21" />
        <circle cx="-34" cy="4" r="3.6" fill="#BFE8D4" />
        <circle cx="34" cy="4" r="9" fill="#082A21" />
        <circle cx="34" cy="4" r="3.6" fill="#BFE8D4" />
      </g>
    </svg>
  )
}
