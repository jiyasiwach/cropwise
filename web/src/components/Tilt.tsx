import { useRef, type ReactNode, type PointerEvent } from 'react'
import { cx } from './ui'

const canTilt = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A card that leans toward the pointer in 3D, with a soft light glare that follows it.
 * Mouse only; touch screens and "reduce motion" get a flat card.
 */
export function Tilt({ children, className, max = 7, glare = true }: { children: ReactNode; className?: string; max?: number; glare?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse' || !canTilt()) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.style.setProperty('--rx', `${(0.5 - y) * max * 2}deg`)
    el.style.setProperty('--ry', `${(x - 0.5) * max * 2}deg`)
    el.style.setProperty('--gx', `${x * 100}%`)
    el.style.setProperty('--gy', `${y * 100}%`)
    el.style.setProperty('--glare', '1')
  }
  const leave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--glare', '0')
  }

  return (
    <div className={cx('[perspective:1000px]', className)}>
      <div
        ref={ref}
        onPointerMove={move}
        onPointerLeave={leave}
        className="relative h-full rounded-[var(--radius-card)] transition-transform duration-200 ease-out [transform-style:preserve-3d] [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]"
      >
        {children}
        {glare && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-[var(--glare,0)] transition-opacity duration-300 [background:radial-gradient(circle_at_var(--gx,50%)_var(--gy,50%),rgb(255_255_255/0.22),transparent_55%)]"
          />
        )}
      </div>
    </div>
  )
}
