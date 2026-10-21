import { PHOTOS, type PhotoKey } from '../lib/photos'
import { cx } from './ui'

/** One of the app's credited photographs (see lib/photos.ts and the credits on the More page). */
export function Photo({ k, className, eager }: { k: PhotoKey; className?: string; eager?: boolean }) {
  const p = PHOTOS[k]
  return (
    <img
      src={p.src}
      alt={p.alt}
      width={p.w}
      height={p.h}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={cx('object-cover', className)}
    />
  )
}

/** "Photo: author · licence", linked to the source page, as the licence asks. */
export function PhotoCredit({ k, className }: { k: PhotoKey; className?: string }) {
  const p = PHOTOS[k]
  return (
    <a
      href={p.page}
      target="_blank"
      rel="noopener noreferrer"
      className={cx('rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/85 no-underline backdrop-blur-sm hover:text-white', className)}
    >
      Photo: {p.author} · {p.license}
    </a>
  )
}
