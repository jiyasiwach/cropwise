import { useId } from 'react'
import { cx } from './ui'

/** The CropWise mark: a sprout rising from a field furrow under a morning sun. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 48 48" className={cx('shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="6" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34a86c" />
          <stop offset="1" stopColor="#0e4d31" />
        </linearGradient>
        <linearGradient id={`${id}-leaf`} x1="24" y1="10" x2="24" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9f5e4" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id}-bg)`} />
      <rect x="0.5" y="0.5" width="47" height="47" rx="12.5" fill="none" stroke="#fff" strokeOpacity="0.14" />
      <circle cx="13.5" cy="13" r="4" fill="#f2b33d" />
      <path d="M7 41.5Q24 33 41 41.5" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 37.5V22.5" stroke={`url(#${id}-leaf)`} strokeWidth="3" strokeLinecap="round" />
      <path d="M24 24.5C24 16.6 29.2 11.2 37 11.2C37 19 31.8 24.5 24 24.5Z" fill={`url(#${id}-leaf)`} />
      <path d="M24 30C24 24.4 20 20.3 14.2 20.3C14.2 25.9 18.3 30 24 30Z" fill="#c9ecd8" />
    </svg>
  )
}

export function Logo({ tagline, size = 'md' }: { tagline?: boolean; size?: 'sm' | 'md' }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className={cx('drop-shadow-[0_6px_10px_rgba(15,77,49,0.35)]', size === 'md' ? 'size-10' : 'size-9')} />
      <span className="leading-none">
        <span className={cx('block font-display font-extrabold tracking-tight text-ink', size === 'md' ? 'text-[1.35rem]' : 'text-xl')}>
          Crop<span className="text-leaf">Wise</span>
        </span>
        {tagline && <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Farming assistant</span>}
      </span>
    </span>
  )
}
