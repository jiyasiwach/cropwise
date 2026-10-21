import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Apple, Banana, Bean, Cherry, Citrus, Coffee, Flower2, Grape, Info, Leaf, Loader2, Mic, MicOff, Phone, Sprout, Square, TreePalm, Volume2, Wheat, type LucideIcon } from 'lucide-react'
import { usePrefs } from '../lib/prefs'
import { useSpeaker } from '../lib/speech'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function Card({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={cx('rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card', className)}>{children}</As>
}

/** One look for every text/number input and select: warm fill, green focus ring. */
export const inputCls =
  'h-12 w-full rounded-xl border border-line bg-surface-2/50 px-3.5 text-[17px] text-ink transition placeholder:text-muted/70 hover:border-ink/20 focus:border-leaf focus:bg-surface focus:outline-none focus:ring-4 focus:ring-leaf/15 disabled:opacity-60'

export type Tone = 'leaf' | 'clay' | 'amber' | 'sky'

export const TONE_BG: Record<Tone, string> = {
  leaf: 'bg-leaf-soft',
  clay: 'bg-clay-soft',
  amber: 'bg-amber-soft',
  sky: 'bg-sky-soft',
}

/** Page header. With `art` it becomes a warm illustrated banner; without, a plain title. */
export function PageTitle({ title, subtitle, children, art, tone = 'leaf', eyebrow }: { title: string; subtitle?: ReactNode; children?: ReactNode; art?: ReactNode; tone?: Tone; eyebrow?: ReactNode }) {
  if (!art)
    return (
      <header className="mb-5">
        {eyebrow && <div className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-leaf">{eyebrow}</div>}
        <h1 className="text-[1.9rem] text-ink sm:text-[2.3rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[60ch] text-muted">{subtitle}</p>}
        {children}
      </header>
    )
  return (
    <header className={cx('relative mb-5 overflow-hidden rounded-[1.6rem] border border-line/70 px-5 py-5 sm:px-7 sm:py-6', TONE_BG[tone])}>
      <div className="pointer-events-none absolute -bottom-16 -right-10 size-56 rounded-full bg-surface/50 blur-2xl" aria-hidden />
      <div className="relative flex items-center gap-4 sm:gap-6">
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-ink/60">{eyebrow}</div>}
          <h1 className="text-[1.75rem] text-ink sm:text-[2.3rem]">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-[56ch] text-[15px] text-ink/70 sm:text-base">{subtitle}</p>}
          {children}
        </div>
        <div className="w-24 shrink-0 self-end sm:w-36 lg:w-40">{art}</div>
      </div>
    </header>
  )
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-ink">{children}</h2>
      {aside}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'amber'

const variants: Record<Variant, string> = {
  primary: 'bg-leaf text-on-leaf hover:brightness-110',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-leaf hover:bg-leaf-soft',
  amber: 'bg-amber text-[#2a1c00] hover:brightness-105',
}

export function Button({
  variant = 'primary',
  className,
  busy,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-2.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
    >
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function ButtonLink({ to, variant = 'primary', className, children }: { to: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-2.5 font-semibold no-underline transition',
        variants[variant],
        className,
      )}
    >
      {children}
    </Link>
  )
}

export function Chip({ children, tone = 'neutral', title }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad'; title?: string }) {
  const tones = {
    neutral: 'bg-surface-2 text-muted border-line',
    good: 'bg-leaf-soft text-leaf border-transparent',
    warn: 'bg-amber-soft text-amber-ink border-transparent',
    bad: 'bg-danger-soft text-danger border-transparent',
  }
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>
      {children}
    </span>
  )
}

/** Where a figure came from. Always shown next to data. */
export function SourceChip({ source, href }: { source: string; href?: string }) {
  const { t } = usePrefs()
  const label = source.length > 70 ? source.slice(0, 67) + '…' : source
  const body = (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <Info className="size-3.5 shrink-0" aria-hidden />
      <span>
        {t('common.source')}: {label}
      </span>
    </span>
  )
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline" title={source}>
      {body}
    </a>
  ) : (
    <span title={source}>{body}</span>
  )
}

/** Placeholder or estimate labels: nothing invented is ever shown unlabelled. */
export function HonestyBadge({ kind }: { kind: 'sample' | 'estimate' }) {
  const { t } = usePrefs()
  return kind === 'sample' ? <Chip tone="warn">⚠ {t('common.sample')}</Chip> : <Chip>≈ {t('common.estimate')}</Chip>
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'bad' }) {
  const tones = {
    info: 'bg-leaf-soft text-ink',
    warn: 'bg-amber-soft text-amber-ink',
    bad: 'bg-danger-soft text-danger',
  }
  return (
    <div className={cx('flex gap-2.5 rounded-2xl px-4 py-3 text-sm', tones[tone])} role={tone === 'bad' ? 'alert' : undefined}>
      {tone === 'info' ? <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div>{children}</div>
    </div>
  )
}

export function Loading({ label }: { label?: string }) {
  const { t } = usePrefs()
  return (
    <div className="flex items-center gap-2 py-6 text-muted" role="status" aria-live="polite">
      <Loader2 className="size-5 animate-spin" aria-hidden /> {label ?? t('common.loading')}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-surface-2', className)} aria-hidden />
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = usePrefs()
  return (
    <Note tone="bad">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-semibold underline">
          {t('common.retry')}
        </button>
      )}
    </Note>
  )
}

export function HelplineButton({ className }: { className?: string }) {
  const { t } = usePrefs()
  return (
    <a
      href="tel:18001801551"
      className={cx(
        'inline-flex min-h-11 items-center gap-2 rounded-2xl bg-amber px-4 py-2.5 font-semibold text-[#2a1c00] no-underline hover:brightness-105',
        className,
      )}
    >
      <Phone className="size-4" aria-hidden /> {t('help.call')} · 1800-180-1551
    </a>
  )
}

/** 🔊 Listen on any text, in the chosen language; says so when the phone has no such voice. */
export function ListenButton({ id, text, className }: { id: string; text: string; className?: string }) {
  const { lang, t } = usePrefs()
  const { supported, speakingId, speak, missingVoice } = useSpeaker()
  if (!supported || !text) return null
  const active = speakingId === id
  return (
    <span className={cx('inline-flex flex-wrap items-center gap-2', className)}>
      <button
        type="button"
        onClick={() => speak(id, text, lang)}
        aria-pressed={active}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-leaf/40 bg-surface px-3 py-1 text-sm font-semibold text-leaf hover:bg-leaf-soft"
      >
        {active ? <Square className="size-3.5" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
        {active ? t('common.stop') : t('common.listen')}
      </button>
      {active && missingVoice && (
        <span className="text-xs text-muted">This phone has no voice for this language; add one in text-to-speech settings.</span>
      )}
    </span>
  )
}

export function MicButton({ listening, supported, onClick, large }: { listening: boolean; supported: boolean; onClick: () => void; large?: boolean }) {
  const { t } = usePrefs()
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!supported}
      aria-pressed={listening}
      aria-label={t('common.speak')}
      title={supported ? t('common.speak') : 'This browser cannot listen — please type.'}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-2xl font-semibold transition disabled:opacity-40',
        large ? 'size-14' : 'size-11',
        listening ? 'animate-pulse bg-danger text-white' : 'bg-amber text-[#2a1c00] hover:brightness-105',
      )}
    >
      {listening ? <MicOff className={large ? 'size-6' : 'size-5'} aria-hidden /> : <Mic className={large ? 'size-6' : 'size-5'} aria-hidden />}
    </button>
  )
}

export const CROPS = [
  'apple', 'banana', 'blackgram', 'chickpea', 'coconut', 'coffee', 'cotton', 'grapes', 'jute', 'kidneybeans', 'lentil',
  'maize', 'mango', 'mothbeans', 'mungbean', 'muskmelon', 'orange', 'papaya', 'pigeonpeas', 'pomegranate', 'rice', 'watermelon',
]

const CROP_ICON: Record<string, LucideIcon> = {
  rice: Wheat, maize: Wheat, jute: Leaf, cotton: Flower2, coffee: Coffee, coconut: TreePalm,
  chickpea: Bean, kidneybeans: Bean, pigeonpeas: Bean, mothbeans: Bean, mungbean: Bean, blackgram: Bean, lentil: Bean,
  apple: Apple, pomegranate: Apple, banana: Banana, grapes: Grape, orange: Citrus, mango: Cherry, papaya: Cherry,
  watermelon: Citrus, muskmelon: Citrus,
  wheat: Wheat, bajra: Wheat, jowar: Wheat, sugarcane: Leaf, groundnut: Bean, soybean: Bean, mustard: Flower2,
}

/** A consistent line icon for a crop, in a soft tile. */
export function CropIcon({ crop, size = 'md' }: { crop: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = CROP_ICON[crop] ?? Sprout
  const box = { sm: 'size-8 rounded-lg', md: 'size-12 rounded-xl', lg: 'size-14 rounded-2xl' }[size]
  const glyph = { sm: 'size-4', md: 'size-6', lg: 'size-7' }[size]
  return (
    <span className={cx('grid shrink-0 place-items-center bg-leaf-soft text-leaf', box)} aria-hidden>
      <Icon className={glyph} strokeWidth={1.75} />
    </span>
  )
}

export function cropName(crop: string) {
  const names: Record<string, string> = { kidneybeans: 'Kidney beans', pigeonpeas: 'Pigeon peas', mothbeans: 'Moth beans', mungbean: 'Mung bean', blackgram: 'Black gram' }
  return names[crop] ?? crop.charAt(0).toUpperCase() + crop.slice(1)
}

export const rupee = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
