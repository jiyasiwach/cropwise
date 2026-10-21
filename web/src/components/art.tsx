/* CropWise illustrations: small flat scenes drawn for this app, one per tool, plus the home
   hero landscape. Fixed colours (they sit on their own tinted backdrops in both themes). */
import { cx } from './ui'

const C = {
  leafDeep: '#2f7a47',
  leaf: '#4f9a5a',
  leafLight: '#7dbb6c',
  leafPale: '#b9da92',
  soil: '#93603f',
  soilLight: '#b9835a',
  amber: '#f2b33d',
  amberLight: '#f8d27a',
  amberDeep: '#c98a1c',
  clay: '#d0693f',
  clayLight: '#e8956c',
  ink: '#263428',
  cream: '#fffaf0',
  paper: '#f6ead0',
  paperEdge: '#e2cfa8',
  sky: '#5aa6cf',
  skyLight: '#bfe0ee',
  white: '#ffffff',
}

type ArtProps = { className?: string }
const box = (className?: string) => cx('block h-auto w-full', className)

export function ArtGrow({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 96" className={box(className)} aria-hidden>
      <circle cx="93" cy="23" r="15" fill={C.amberLight} opacity=".55" />
      <circle cx="93" cy="23" r="10" fill={C.amber} />
      <path d="M30 20c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12Z" fill={C.sky} />
      <path d="M20 40c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8Z" fill={C.skyLight} />
      <ellipse cx="60" cy="86" rx="46" ry="5" fill={C.ink} opacity=".08" />
      <path d="M12 84Q60 50 108 84Z" fill={C.soil} />
      <path d="M22 78Q60 56 98 78" fill="none" stroke={C.soilLight} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="40" cy="79" r="2" fill={C.soilLight} />
      <circle cx="80" cy="78" r="1.6" fill={C.soilLight} />
      <path d="M60 70c0-10 0-18 1-27" stroke={C.leafDeep} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M60 57c-12 0-20-8-22-20 13 0 21 8 22 20Z" fill={C.leafLight} />
      <path d="M61 46c1-14 11-24 27-24-2 15-12 24-27 24Z" fill={C.leaf} />
      <path d="M60 56C53 51 47 45 42 39M62 45c6-6 13-12 22-20" stroke={C.white} strokeOpacity=".45" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function ArtDoctor({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 96" className={box(className)} aria-hidden>
      <ellipse cx="60" cy="88" rx="42" ry="4.5" fill={C.ink} opacity=".08" />
      <path d="M22 80C18 50 36 22 76 14c8 30-6 60-54 66Z" fill={C.leafLight} />
      <path d="M24 78Q48 52 74 18" stroke={C.leafDeep} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M38 62l-8-14M48 50l-10-14M58 38l-6-14M44 58l14 2M54 46l14 0M64 34l10-2" stroke={C.leafDeep} strokeOpacity=".5" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="46" cy="44" r="5" fill={C.clay} />
      <circle cx="46" cy="44" r="8" fill={C.clay} opacity=".25" />
      <circle cx="58" cy="58" r="3.6" fill={C.clay} />
      <circle cx="36" cy="64" r="3" fill={C.clay} opacity=".8" />
      <circle cx="84" cy="56" r="17" fill={C.skyLight} fillOpacity=".55" stroke={C.ink} strokeWidth="5" />
      <path d="M75 50a10 10 0 0 1 8-6" stroke={C.white} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M96 68l12 13" stroke={C.ink} strokeWidth="8" strokeLinecap="round" />
    </svg>
  )
}

export function ArtSell({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 96" className={box(className)} aria-hidden>
      <ellipse cx="56" cy="88" rx="42" ry="4.5" fill={C.ink} opacity=".08" />
      <circle cx="36" cy="50" r="11" fill={C.clay} />
      <path d="M36 39c-2-4-6-5-9-4 3 1 5 3 6 5M36 39c2-4 6-5 9-4-3 1-5 3-6 5" stroke={C.leafDeep} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <circle cx="32" cy="47" r="3" fill={C.white} opacity=".35" />
      <circle cx="56" cy="48" r="12" fill={C.amberLight} />
      <path d="M50 44c4-3 8-3 12 0" stroke={C.amberDeep} strokeOpacity=".5" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="75" cy="49" r="11.5" fill={C.leafLight} />
      <path d="M75 39v20M67 44c5 3 11 3 16 0M67 54c5-3 11-3 16 0" stroke={C.leafDeep} strokeOpacity=".45" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <rect x="20" y="54" width="72" height="32" rx="5" fill={C.soilLight} />
      <path d="M20 65h72M20 75h72" stroke={C.soil} strokeWidth="2.2" />
      <path d="M32 54v32M80 54v32" stroke={C.soil} strokeOpacity=".5" strokeWidth="2" />
      <circle cx="98" cy="30" r="14" fill={C.amber} stroke={C.amberDeep} strokeWidth="3" />
      <text x="98" y="36" textAnchor="middle" fontFamily="Plus Jakarta Sans, Noto Sans, sans-serif" fontWeight="800" fontSize="17" fill="#6b4300">₹</text>
    </svg>
  )
}

export function ArtPlan({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 96" className={box(className)} aria-hidden>
      <ellipse cx="62" cy="88" rx="44" ry="4.5" fill={C.ink} opacity=".08" />
      <rect x="20" y="18" width="66" height="64" rx="9" fill={C.cream} stroke={C.paperEdge} strokeWidth="2" />
      <path d="M20 27a9 9 0 0 1 9-9h48a9 9 0 0 1 9 9v7H20Z" fill={C.sky} />
      <rect x="33" y="12" width="5" height="12" rx="2.5" fill={C.ink} />
      <rect x="68" y="12" width="5" height="12" rx="2.5" fill={C.ink} />
      {[0, 1, 2, 3].map((c) =>
        [0, 1, 2].map((r) => (
          <rect key={`${c}${r}`} x={28 + c * 13} y={42 + r * 12} width="9" height="8" rx="2.5" fill={c === 2 && r === 1 ? C.amber : '#efe3c8'} />
        )),
      )}
      <path d="M30 46l2.5 2.5 4-4.5M43 46l2.5 2.5 4-4.5M56 46l2.5 2.5 4-4.5" stroke={C.leafDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M86 70h22l-3 16H89Z" fill={C.clay} />
      <rect x="84" y="66" width="26" height="6" rx="2" fill={C.clayLight} />
      <path d="M97 66c0-6 0-10 1-14" stroke={C.leafDeep} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M97 58c-7 0-11-4-12-11 7 0 11 4 12 11Z" fill={C.leafLight} />
      <path d="M98 53c1-8 6-13 14-13-1 8-6 13-14 13Z" fill={C.leaf} />
    </svg>
  )
}

export function ArtYield({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 96" className={box(className)} aria-hidden>
      <ellipse cx="54" cy="88" rx="42" ry="4.5" fill={C.ink} opacity=".08" />
      {[
        [40, 30, -14],
        [52, 22, -4],
        [64, 28, 10],
      ].map(([x, top, lean], i) => (
        <g key={i}>
          <path d={`M${x} 44Q${x + lean / 3} ${top + 10} ${x + lean / 2} ${top}`} stroke={C.amberDeep} strokeWidth="2" fill="none" />
          {[0, 1, 2, 3].map((k) => (
            <ellipse key={k} cx={x + lean / 2 + (k % 2 ? 3 : -3)} cy={top + 3 + k * 4.5} rx="2.6" ry="4" fill={C.amber} transform={`rotate(${k % 2 ? 25 : -25} ${x + lean / 2 + (k % 2 ? 3 : -3)} ${top + 3 + k * 4.5})`} />
          ))}
        </g>
      ))}
      <path d="M30 86c-8 0-10-14-6-26 4-10 12-16 14-22h34c2 6 10 12 14 22 4 12 2 26-6 26Z" fill={C.paper} stroke={C.paperEdge} strokeWidth="2" />
      <rect x="36" y="36" width="38" height="7" rx="3.5" fill={C.soilLight} />
      <path d="M44 66h22M47 73h16" stroke={C.paperEdge} strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="20" cy="84" rx="7" ry="3" fill={C.amberLight} />
      <rect x="92" y="58" width="7" height="26" rx="2" fill={C.leafPale} />
      <rect x="101" y="46" width="7" height="38" rx="2" fill={C.leafLight} />
      <rect x="110" y="34" width="7" height="50" rx="2" fill={C.leaf} />
      <path d="M90 50l10-9 9-3 9-11" stroke={C.amberDeep} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ArtSchemes({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 96" className={box(className)} aria-hidden>
      <ellipse cx="60" cy="88" rx="46" ry="4.5" fill={C.ink} opacity=".08" />
      <path d="M60 16v-8" stroke={C.ink} strokeWidth="2" />
      <rect x="61" y="6" width="16" height="3.4" fill="#f39b3d" />
      <rect x="61" y="9.4" width="16" height="3.4" fill={C.white} />
      <rect x="61" y="12.8" width="16" height="3.4" fill="#2f8a3e" />
      <path d="M20 36L60 16l40 20Z" fill={C.paper} stroke={C.paperEdge} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="60" cy="28" r="4" fill={C.amber} />
      <rect x="22" y="36" width="76" height="6" rx="1.5" fill={C.paperEdge} />
      {[30, 46, 62, 78].map((x) => (
        <rect key={x} x={x} y="44" width="9" height="30" rx="2" fill={C.cream} stroke={C.paperEdge} strokeWidth="1.6" />
      ))}
      <rect x="18" y="74" width="84" height="6" rx="1.5" fill={C.paperEdge} />
      <rect x="12" y="80" width="96" height="6" rx="2" fill={C.paper} stroke={C.paperEdge} strokeWidth="1.6" />
      <circle cx="98" cy="64" r="12" fill={C.leaf} stroke={C.white} strokeWidth="3" />
      <text x="98" y="69.5" textAnchor="middle" fontFamily="Plus Jakarta Sans, Noto Sans, sans-serif" fontWeight="800" fontSize="15" fill={C.white}>₹</text>
    </svg>
  )
}

export function ArtChannels({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 96" className={box(className)} aria-hidden>
      <ellipse cx="60" cy="89" rx="34" ry="4" fill={C.ink} opacity=".08" />
      <rect x="42" y="12" width="38" height="74" rx="9" fill={C.ink} />
      <rect x="46" y="20" width="30" height="58" rx="4" fill="#eaf4ec" />
      <rect x="56" y="15" width="10" height="2.4" rx="1.2" fill="#56655a" />
      <rect x="50" y="28" width="18" height="6" rx="3" fill={C.leafPale} />
      <rect x="54" y="38" width="18" height="6" rx="3" fill={C.skyLight} />
      <rect x="50" y="48" width="14" height="6" rx="3" fill={C.leafPale} />
      <path d="M12 24h30a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H24l-7 6v-6h-5a6 6 0 0 1-6-6V30a6 6 0 0 1 6-6Z" fill="#3cbf6c" />
      <path d="M16 32h20M16 38h13" stroke={C.white} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M78 50h28a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6h-4v6l-7-6H78a6 6 0 0 1-6-6V56a6 6 0 0 1 6-6Z" fill={C.sky} />
      <path d="M82 61l18-7-5 14-4-5Z" fill={C.white} />
    </svg>
  )
}

export function ArtAsk({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 96" className={box(className)} aria-hidden>
      <ellipse cx="60" cy="89" rx="40" ry="4" fill={C.ink} opacity=".08" />
      <path d="M22 14h60a12 12 0 0 1 12 12v30a12 12 0 0 1-12 12H48l-14 12V68H22a12 12 0 0 1-12-12V26a12 12 0 0 1 12-12Z" fill={C.cream} stroke={C.paperEdge} strokeWidth="2" />
      <path d="M52 56c0-8 0-14 1-20" stroke={C.leafDeep} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M52 46c-9 0-15-6-16-15 9 0 15 6 16 15Z" fill={C.leafLight} />
      <path d="M53 40c1-10 8-16 18-16-1 10-8 16-18 16Z" fill={C.leaf} />
      <rect x="84" y="46" width="22" height="34" rx="11" fill={C.amber} />
      <path d="M95 52v14" stroke="#6b4300" strokeOpacity=".35" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M80 66a15 15 0 0 0 30 0M95 81v7" stroke={C.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function ArtStats({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 96" className={box(className)} aria-hidden>
      <ellipse cx="60" cy="89" rx="40" ry="4" fill={C.ink} opacity=".08" />
      <rect x="26" y="14" width="60" height="72" rx="8" fill={C.cream} stroke={C.paperEdge} strokeWidth="2" />
      <rect x="42" y="9" width="28" height="11" rx="4" fill={C.soilLight} />
      <rect x="36" y="54" width="8" height="22" rx="2" fill={C.leafPale} />
      <rect x="48" y="44" width="8" height="32" rx="2" fill={C.leafLight} />
      <rect x="60" y="34" width="8" height="42" rx="2" fill={C.leaf} />
      <path d="M36 30h32" stroke={C.paperEdge} strokeWidth="3" strokeLinecap="round" />
      <circle cx="92" cy="66" r="15" fill={C.leaf} stroke={C.white} strokeWidth="3" />
      <path d="M85 66l5 5 9-10" stroke={C.white} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function ArtIdea({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 96" className={box(className)} aria-hidden>
      <ellipse cx="60" cy="90" rx="30" ry="4" fill={C.ink} opacity=".08" />
      <circle cx="60" cy="38" r="30" fill={C.amberLight} opacity=".35" />
      <path d="M60 12a26 26 0 0 0-15 47c3 2 5 6 5 10h20c0-4 2-8 5-10a26 26 0 0 0-15-47Z" fill={C.cream} stroke={C.amberDeep} strokeWidth="2.4" />
      <rect x="49" y="70" width="22" height="7" rx="2" fill={C.paperEdge} />
      <rect x="51" y="78" width="18" height="6" rx="3" fill={C.soilLight} />
      <path d="M60 60c0-8 0-14 1-20" stroke={C.leafDeep} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M60 50c-8 0-13-5-14-13 8 0 13 5 14 13Z" fill={C.leafLight} />
      <path d="M61 44c1-9 7-14 15-14-1 9-7 14-15 14Z" fill={C.leaf} />
    </svg>
  )
}

export function ArtHistory({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 96" className={box(className)} aria-hidden>
      <ellipse cx="60" cy="89" rx="40" ry="4" fill={C.ink} opacity=".08" />
      <rect x="24" y="16" width="56" height="70" rx="6" fill={C.paper} stroke={C.paperEdge} strokeWidth="2" />
      <rect x="24" y="16" width="10" height="70" rx="4" fill={C.leaf} />
      <path d="M42 34h28M42 44h24M42 54h28M42 64h18" stroke={C.paperEdge} strokeWidth="3" strokeLinecap="round" />
      <circle cx="88" cy="58" r="17" fill={C.cream} stroke={C.sky} strokeWidth="4" />
      <path d="M88 48v10l7 5" stroke={C.ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function ArtSettings({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 96" className={box(className)} aria-hidden>
      <ellipse cx="60" cy="89" rx="36" ry="4" fill={C.ink} opacity=".08" />
      <g transform="translate(56 48)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect key={a} x="-6" y="-34" width="12" height="14" rx="3" fill={C.sky} transform={`rotate(${a})`} />
        ))}
        <circle r="24" fill={C.sky} />
        <circle r="11" fill={C.cream} />
      </g>
      <path d="M92 80c0-8 0-14 1-20" stroke={C.leafDeep} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M92 70c-8 0-13-5-14-13 8 0 13 5 14 13Z" fill={C.leafLight} />
      <path d="M93 64c1-9 7-14 15-14-1 9-7 14-15 14Z" fill={C.leaf} />
    </svg>
  )
}

/** The home hero: rolling fields with crop rows, a tree, a farmhouse and the morning sun. */
export function HeroScene({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 640 200" preserveAspectRatio="xMidYMax slice" className={cx('block h-full w-full', className)} aria-hidden>
      <path d="M0 132C110 104 230 110 330 122 430 134 530 108 640 116V200H0Z" fill="#a9cf8c" />
      <path d="M0 146C130 112 290 128 410 140 510 150 580 128 640 132V200H0Z" fill="#74ad65" />
      <g stroke="#8cc077" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M20 160C140 132 300 146 420 156" />
        <path d="M40 172C160 148 320 160 470 168" />
        <path d="M70 184C190 164 360 174 520 180" />
      </g>
      <g transform="translate(470 114) scale(.9)">
        <rect x="0" y="14" width="44" height="26" rx="2" fill="#f6e6c6" />
        <path d="M-6 16L22 -4 50 16Z" fill="#cf6a40" />
        <rect x="17" y="24" width="10" height="16" rx="1.5" fill="#8a5a3b" />
        <rect x="5" y="20" width="8" height="7" rx="1" fill="#9fd0e6" />
        <rect x="31" y="20" width="8" height="7" rx="1" fill="#9fd0e6" />
      </g>
      <g transform="translate(92 118) scale(.85)">
        <rect x="-3" y="14" width="7" height="30" rx="2" fill="#7a5134" />
        <circle cx="0" cy="8" r="20" fill="#3d8a4c" />
        <circle cx="-13" cy="16" r="13" fill="#2f7a47" />
        <circle cx="14" cy="15" r="14" fill="#4f9a5a" />
      </g>
      <path d="M0 176C170 158 380 166 640 160V200H0Z" fill="#3f8a4e" />
      <g fill="#5fa35e">
        {[30, 70, 110, 150, 190, 230, 270, 310, 350, 390, 430, 470, 510, 550, 590, 625].map((x, i) => (
          <path key={x} d={`M${x} ${178 - (i % 3)}c-3-6-3-10 0-14 3 4 3 8 0 14Z`} />
        ))}
      </g>
    </svg>
  )
}

/** The hero's sky: morning sun with a soft glow, two clouds and a pair of birds. */
export function HeroSky({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 280 140" className={cx('block h-auto w-full', className)} aria-hidden>
      <defs>
        <radialGradient id="cw-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd56b" />
          <stop offset="0.5" stopColor="#ffd56b" stopOpacity=".35" />
          <stop offset="1" stopColor="#ffd56b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="62" r="62" fill="url(#cw-sun)" />
      <circle cx="200" cy="62" r="26" fill="#f6b93b" />
      <g fill="#ffffff" opacity=".9">
        <path d="M60 52a16 16 0 0 1 31-6 12 12 0 0 1 15 12H48a12 12 0 0 1 12-6Z" />
        <path d="M150 112a12 12 0 0 1 23-4 9 9 0 0 1 11 9h-42a8 8 0 0 1 8-5Z" />
      </g>
      <path d="M110 84l6 4 6-4M128 76l5 3 5-3" stroke="#3a4a3c" strokeOpacity=".45" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
