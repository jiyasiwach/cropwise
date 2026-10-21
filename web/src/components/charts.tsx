// Small hand-made SVG visuals: no chart library, readable on a phone, labelled for screen readers.
import { cx, rupee } from './ui'

/** Confidence as a ring with the number in the middle. */
export function ConfidenceRing({ value, size = 64 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, value))
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(pct)}% match`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={pct >= 60 ? 'var(--leaf)' : pct >= 30 ? 'var(--amber)' : 'var(--muted)'}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" fontSize={size * 0.26} fontWeight="700" fill="var(--ink)">
        {Math.round(pct)}%
      </text>
    </svg>
  )
}

/** Two values side by side as horizontal bars (e.g. nearest vs best mandi net price). */
export function CompareBars({ rows, format = rupee }: { rows: { label: string; value: number; highlight?: boolean }[]; format?: (n: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  const min = Math.min(...rows.map((r) => r.value))
  // Start the axis a little below the smallest value so a 3% difference is visible, and say so.
  const floor = Math.max(0, min - (max - min) * 3 - max * 0.02)
  return (
    <div className="space-y-2.5" role="img" aria-label={rows.map((r) => `${r.label} ${format(r.value)}`).join(', ')}>
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className={cx(r.highlight ? 'font-semibold text-ink' : 'text-muted')}>{r.label}</span>
            <span className="font-semibold tabular-nums">{format(r.value)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cx('h-full rounded-full', r.highlight ? 'bg-leaf' : 'bg-muted/50')}
              style={{ width: `${Math.max(4, ((r.value - floor) / (max - floor)) * 100)}%` }}
            />
          </div>
        </div>
      ))}
      {floor > 0 && <p className="text-xs text-muted">Bars start at {format(floor)} so small differences are visible.</p>}
    </div>
  )
}

/** Costs vs income as one stacked bar, then the profit. */
export function MoneyBar({ costs, revenue }: { costs: { label: string; value: number }[]; revenue: number }) {
  const total = costs.reduce((s, c) => s + c.value, 0)
  const scale = Math.max(revenue, total, 1)
  const tones = ['bg-[#c47f17]', 'bg-[#e9a520]', 'bg-[#f2c96b]', 'bg-[#f7dfa5]']
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-muted">Income</span>
          <span className="font-semibold tabular-nums">{rupee(revenue)}</span>
        </div>
        <div className="h-4 rounded-full bg-leaf" style={{ width: `${(revenue / scale) * 100}%` }} />
      </div>
      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-muted">Costs</span>
          <span className="font-semibold tabular-nums">{rupee(total)}</span>
        </div>
        <div className="flex h-4 overflow-hidden rounded-full bg-surface-2" style={{ width: `${(total / scale) * 100}%` }}>
          {costs.map((c, i) => (
            <div key={c.label} className={tones[i % tones.length]} style={{ width: `${(c.value / Math.max(total, 1)) * 100}%` }} title={`${c.label} ${rupee(c.value)}`} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {costs.map((c, i) => (
            <span key={c.label} className="inline-flex items-center gap-1.5">
              <span className={cx('inline-block size-2.5 rounded-sm', tones[i % tones.length])} /> {c.label} {rupee(c.value)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** A price trend line with first/last labels. */
export function Sparkline({ points, height = 64 }: { points: { date: string; value: number }[]; height?: number }) {
  if (points.length < 2) return null
  const w = 320
  const values = points.map((p) => p.value)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, height - 6 - ((p.value - lo) / span) * (height - 12)])
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${height}`} className="h-16 w-full" role="img" aria-label={`Price from ${rupee(values[0])} to ${rupee(values[values.length - 1])}`}>
        <path d={`${d} L${w},${height} L0,${height} Z`} fill="var(--leaf-soft)" />
        <path d={d} fill="none" stroke="var(--leaf)" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-muted">
        <span>
          {points[0].date} · {rupee(values[0])}
        </span>
        <span>
          {points[points.length - 1].date} · {rupee(values[values.length - 1])}
        </span>
      </figcaption>
    </figure>
  )
}

/** Sow → grow → harvest with a "today" marker. Dates are ISO strings. */
export function SeasonTimeline({ sowFrom, sowBy, harvest, today = new Date() }: { sowFrom: string; sowBy: string; harvest: string; today?: Date }) {
  const a = new Date(sowFrom).getTime()
  const b = new Date(sowBy).getTime()
  const h = new Date(harvest).getTime()
  const now = today.getTime()
  const start = Math.min(a, now)
  const end = Math.max(h, now)
  const at = (t: number) => ((t - start) / Math.max(end - start, 1)) * 100
  const fmt = (t: number) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const phase = now < a ? `Sowing opens in ${Math.ceil((a - now) / 864e5)} days` : now <= b ? 'Sow now — the window is open' : now <= h ? 'Crop is growing' : 'Season over'
  return (
    <div>
      <p className="mb-3 font-semibold text-leaf">{phase}</p>
      <div className="relative h-14" role="img" aria-label={`Sow ${fmt(a)} to ${fmt(b)}, harvest about ${fmt(h)}. ${phase}.`}>
        <div className="absolute top-5 h-3 w-full rounded-full bg-surface-2" />
        <div className="absolute top-5 h-3 rounded-full bg-amber" style={{ left: `${at(a)}%`, width: `${Math.max(1.5, at(b) - at(a))}%` }} />
        <div className="absolute top-5 h-3 rounded-full bg-leaf/70" style={{ left: `${at(b)}%`, width: `${Math.max(1, at(h) - at(b))}%` }} />
        <div className="absolute top-2 h-9 w-0.5 bg-ink" style={{ left: `${at(now)}%` }}>
          <span className="absolute -top-0.5 left-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-ink">Today</span>
        </div>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-xs text-muted">Sow from</div>
          <div className="font-semibold">{fmt(a)}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Sow by</div>
          <div className="font-semibold">{fmt(b)}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Harvest ≈</div>
          <div className="font-semibold">{fmt(h)}</div>
        </div>
      </div>
    </div>
  )
}

/** The Crop Doctor pipeline as a stepper: look → safety → source → advice. */
export function Stepper({ steps }: { steps: { label: string; state: 'done' | 'stop' | 'skip' | 'pending'; detail?: string }[] }) {
  const dot = { done: 'bg-leaf text-on-leaf', stop: 'bg-amber text-[#2a1c00]', skip: 'bg-surface-2 text-muted', pending: 'bg-surface-2 text-muted' }
  const mark = { done: '✓', stop: '!', skip: '–', pending: '…' }
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={s.label} className="flex gap-3">
          <span className={cx('grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold', dot[s.state])} aria-hidden>
            {mark[s.state]}
          </span>
          <div className="min-w-0">
            <div className="font-semibold">
              {i + 1}. {s.label}
            </div>
            {s.detail && <div className="text-sm text-muted">{s.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}
