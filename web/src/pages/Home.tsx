import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Camera, CalendarDays, CloudRain, FlaskConical, IndianRupee, Landmark, MapPin, Radio, Scale, Send, ShieldCheck, Sprout, Thermometer, type LucideIcon } from 'lucide-react'
import { api, type EvalData, type Season } from '../lib/api'
import { usePrefs } from '../lib/prefs'
import { useListener } from '../lib/speech'
import { CropIcon, cropName, MicButton, Skeleton, TONE_BG, cx, type Tone } from '../components/ui'
import { Photo, PhotoCredit } from '../components/Photo'
import { Tilt } from '../components/Tilt'
import type { PhotoKey } from '../lib/photos'

function greetingKey() {
  const h = new Date().getHours()
  return h < 12 ? 'greet.morning' : h < 17 ? 'greet.afternoon' : 'greet.evening'
}

/** Glass cards floating in 3D over the hero photo, showing the field's live readings. */
function FloatingCards({ season }: { season: Season | null }) {
  const sow = season?.sowable[0]
  const ph = season?.soil?.ph
  const cards = [
    { k: 'Soil pH', v: ph != null ? String(ph) : '—', sub: ph == null ? 'Reading…' : ph < 5.5 ? 'Acidic' : ph <= 7.5 ? 'Good for most crops' : 'Alkaline', icon: FlaskConical, z: 60, x: 0, y: 0, delay: '0s' },
    { k: 'Rain · 30 days', v: season?.weather ? `${Math.round(season.weather.rainfall)} mm` : '—', sub: season?.weather ? `${Math.round(season.weather.temperature)}°C average` : 'Reading…', icon: CloudRain, z: 20, x: 56, y: 96, delay: '1.2s' },
    { k: 'Sow now', v: sow ? cropName(sow.crop) : '—', sub: sow ? `${sow.days_left} days left` : 'Checking the calendar…', icon: Sprout, z: 90, x: 8, y: 192, delay: '2.4s' },
  ]
  return (
    <div className="pointer-events-none absolute right-8 top-1/2 hidden h-[19rem] w-64 -translate-y-1/2 [perspective:1100px] xl:block" aria-hidden>
      <div className="relative size-full [transform-style:preserve-3d] [transform:rotateY(-22deg)_rotateX(10deg)]">
        {cards.map(({ k, v, sub, icon: Icon, z, x, y, delay }) => (
          <div
            key={k}
            className="cw-float absolute w-56 rounded-2xl border border-white/25 bg-white/12 p-3.5 text-white shadow-[0_24px_48px_-20px_rgb(0_0_0/0.7)] backdrop-blur-md"
            style={{ left: x, top: y, transform: `translateZ(${z}px)`, animationDelay: delay }}
          >
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
              <span className="grid size-6 place-items-center rounded-lg bg-[#e6c46f] text-[#2a1f05]">
                <Icon className="size-3.5" />
              </span>
              {k}
            </div>
            <div className="mt-1.5 text-2xl font-extrabold tracking-tight">{v}</div>
            <div className="text-xs text-white/70">{sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Hero({ season }: { season: Season | null }) {
  const { t, lang, place } = usePrefs()
  const photo = useRef<HTMLDivElement>(null)
  // Parallax: the photo drifts a little against the pointer, so the hero has depth.
  const drift = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || !photo.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    photo.current.style.transform = `scale(1.08) translate(${-x * 14}px, ${-y * 10}px)`
  }
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const go = useCallback((q: string) => navigate(`/ask?q=${encodeURIComponent(q)}`), [navigate])
  const { supported, listening, toggle } = useListener(lang, setQuestion, go)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (question.trim()) go(question.trim())
  }

  return (
    <section onPointerMove={drift} className="relative isolate overflow-hidden rounded-[1.6rem] bg-[#0d2a1c] shadow-[0_30px_60px_-30px_rgb(6_20_13/0.8)]">
      <div ref={photo} className="absolute inset-0 -z-10 scale-[1.08] transition-transform duration-500 ease-out">
        <Photo k="hero" eager className="size-full object-[30%_70%] sm:object-center" />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#06140d]/90 via-[#06140d]/35 to-[#06140d]/5 sm:bg-gradient-to-r sm:from-[#06140d]/85 sm:via-[#06140d]/40 sm:to-transparent" aria-hidden />
      <div className="px-5 pb-6 pt-24 sm:px-9 sm:pb-9 sm:pt-28 lg:pt-32">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-white/80">
          <span className="text-[#e6c46f]">{t(greetingKey() as Parameters<typeof t>[0])}</span>
          {place && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden /> {place.city}
              </span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </p>
        <h1 className="mt-2 max-w-[17ch] text-[2.1rem] leading-[1.08] text-white sm:text-[3rem]">{t('home.title')}</h1>
        <form onSubmit={submit} className="mt-6 flex max-w-2xl items-center xl:max-w-xl gap-2 rounded-2xl bg-white/95 p-2 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.6)] backdrop-blur dark:bg-[#121b16]/90">
          <MicButton listening={listening} supported={supported} onClick={toggle} />
          <label className="sr-only" htmlFor="home-ask">
            {t('home.ask')}
          </label>
          <input
            id="home-ask"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('home.ask')}
            className="h-12 min-w-0 flex-1 border-0 bg-transparent px-2 text-[17px] text-ink outline-none placeholder:text-muted"
          />
          <button type="submit" className="grid size-12 shrink-0 place-items-center rounded-xl bg-leaf text-on-leaf transition hover:brightness-110" aria-label={t('common.send')}>
            <Send className="size-5" aria-hidden />
          </button>
        </form>
        <p className="mt-3 text-xs text-white/70">{t('home.note')}</p>
      </div>
      <FloatingCards season={season} />
      <PhotoCredit k="hero" className="absolute right-3 top-3 sm:bottom-3 sm:top-auto" />
    </section>
  )
}

function ToolCard({ to, photo, icon: Icon, title, hint, featured, wide, cta }: { to: string; photo: PhotoKey; icon: LucideIcon; title: string; hint: string; featured?: boolean; wide?: boolean; cta?: string }) {
  return (
    <Tilt className={cx(featured ? 'col-span-2 sm:row-span-2' : '', wide && 'sm:col-span-2')} max={featured ? 4 : 7}>
    <Link
      to={to}
      className={cx(
        'group relative isolate flex h-full flex-col justify-end overflow-hidden rounded-[var(--radius-card)] bg-[#0d2a1c] no-underline shadow-[0_18px_40px_-22px_rgb(6_20_13/0.75)] ring-1 ring-black/5 transition-shadow duration-300 hover:shadow-[0_28px_56px_-24px_rgb(6_20_13/0.85)]',
        featured ? 'min-h-64 sm:min-h-[22rem]' : 'min-h-44 sm:min-h-48',
      )}
    >
      <Photo k={photo} className="absolute inset-0 -z-10 size-full transition duration-500 group-hover:scale-[1.05]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#06140d]/92 via-[#06140d]/40 to-transparent" aria-hidden />
      <span className="absolute left-3 top-3 grid size-9 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-md">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 text-[#0d2a1c] opacity-0 transition duration-300 group-hover:opacity-100 sm:opacity-80">
        <ArrowUpRight className="size-4" aria-hidden />
      </span>
      <span className={cx('block [transform:translateZ(30px)]', featured ? 'p-5 sm:p-6' : 'p-4')}>
        <span className={cx('block font-display font-extrabold tracking-tight text-white', featured ? 'text-[1.7rem] sm:text-[2rem]' : 'text-[1.05rem] leading-snug')}>{title}</span>
        <span className={cx('mt-1 block text-white/75', featured ? 'max-w-sm text-[15px]' : 'text-sm')}>{hint}</span>
        {featured && (
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#e6c46f] px-4 py-2.5 text-sm font-bold text-[#2a1f05] transition group-hover:brightness-105">
            {cta} <ArrowRight className="size-4" aria-hidden />
          </span>
        )}
      </span>
    </Link>
    </Tilt>
  )
}

function Tools() {
  const { t } = usePrefs()
  return (
    <section aria-labelledby="tools-title">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <h2 id="tools-title" className="text-[1.45rem] text-ink">
          {t('home.tools')}
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <ToolCard to="/grow" featured photo="grow" icon={Sprout} title={t('tile.grow')} hint="We read your soil and 30 days of weather, then suggest three crops with the reasons." cta="Read my soil" />
        <ToolCard to="/doctor" photo="doctor" icon={Camera} title={t('tile.doctor')} hint={t('hint.doctor')} />
        <ToolCard to="/impact#calculator" photo="sell" icon={IndianRupee} title={t('tile.sell')} hint={t('hint.sell')} />
        <ToolCard to="/results" photo="plan" icon={CalendarDays} title={t('tile.plan')} hint={t('hint.plan')} />
        <ToolCard to="/yield" photo="yield" icon={Scale} title={t('tile.yield')} hint={t('hint.yield')} />
        <ToolCard to="/schemes" wide photo="schemes" icon={Landmark} title={t('tile.schemes')} hint={t('hint.schemes')} />
        <ToolCard to="/community" wide photo="community" icon={Radio} title={t('tile.community')} hint={t('hint.community')} />
      </div>
    </section>
  )
}

/** Where a pH sits between acidic (red), neutral (green) and alkaline (blue). */
function PhScale({ ph }: { ph: number }) {
  const pos = Math.min(100, Math.max(0, ((ph - 4) / 5) * 100))
  const label = ph < 5.5 ? 'Acidic' : ph <= 7.5 ? 'Good for most crops' : 'Alkaline'
  return (
    <div className="mt-2">
      <div className="relative h-2 rounded-full bg-gradient-to-r from-[#d9734a] via-[#7cc58c] to-[#5aa6cf]">
        <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-ink shadow" style={{ left: `${pos}%` }} />
      </div>
      <div className="mt-1.5 text-xs text-muted">{label}</div>
    </div>
  )
}

function Metric({ icon, tone, label, value, children }: { icon: ReactNode; tone: Tone; label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line/70 bg-surface p-3.5">
      <div className="flex items-center gap-2.5">
        <span className={cx('grid size-9 place-items-center rounded-xl', TONE_BG[tone])}>{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      </div>
      <div className="mt-2 font-display text-[1.7rem] font-bold leading-none tabular-nums text-ink">{value}</div>
      {children}
    </div>
  )
}

function useSeason(city: string) {
  const [season, setSeason] = useState<Season | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    setSeason(null)
    setFailed(false)
    api
      .season(city)
      .then((s) => live && setSeason(s))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [city])
  return { season, failed }
}

function TodayCard({ city, season, failed }: { city: string; season: Season | null; failed: boolean }) {
  const { place, t } = usePrefs()

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface-2/60 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[1.35rem] text-ink">
          {t('home.now')} {city}
        </h2>
        <Link to="/grow" className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-leaf no-underline shadow-sm">
          <MapPin className="size-4" aria-hidden /> {place ? 'Change' : 'Set my town'}
        </Link>
      </div>
      {failed && <p className="text-sm text-muted">Live soil and weather are slow to answer just now. Your plan still works — try again in a minute.</p>}
      {!season && !failed && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      )}
      {season && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric icon={<Thermometer className="size-[18px] text-clay" aria-hidden />} tone="clay" label="Temperature" value={season.weather ? `${Math.round(season.weather.temperature)}°C` : '—'}>
              <div className="mt-1.5 text-xs text-muted">Average, last 30 days</div>
            </Metric>
            <Metric icon={<CloudRain className="size-[18px] text-sky" aria-hidden />} tone="sky" label="Rain" value={season.weather ? `${Math.round(season.weather.rainfall)} mm` : '—'}>
              <div className="mt-1.5 text-xs text-muted">Total, last 30 days</div>
            </Metric>
            <Metric icon={<FlaskConical className="size-[18px] text-leaf" aria-hidden />} tone="leaf" label="Soil pH" value={season.soil?.ph ?? '—'}>
              {typeof season.soil?.ph === 'number' && <PhScale ph={season.soil.ph} />}
            </Metric>
          </div>
          {season.sowable.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-sm font-semibold text-ink/80">You can still sow this {season.month}</div>
              <div className="flex flex-wrap gap-2">
                {season.sowable.slice(0, 5).map((s) => (
                  <Link
                    key={s.crop}
                    to={`/plan/${s.crop}`}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm font-semibold text-ink no-underline transition hover:border-leaf/50"
                  >
                    <CropIcon crop={s.crop} size="sm" /> {cropName(s.crop)}
                    <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-semibold text-amber-ink">{s.days_left} days left</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {season.soil?.sample_note && <p className="mt-3 text-xs text-muted">{season.soil.sample_note}</p>}
          <p className="mt-2 text-xs text-muted">Soil: ISRIC SoilGrids · Weather: Open-Meteo</p>
        </>
      )}
    </section>
  )
}

function TrustStrip() {
  const [data, setData] = useState<EvalData | null>(null)
  useEffect(() => {
    api.evaluation().then(setData).catch(() => {})
  }, [])
  const a = data?.assistant
  const d = data?.doctor?.summary
  const best = a?.retrieval.find((r) => r.mode === 'hybrid')
  const items = [
    best && { k: `${Math.round(best.hit_at_5 * 100)}%`, v: 'right source in top 5' },
    a && { k: `${a.guardrails.attacks_blocked}/${a.guardrails.attacks}`, v: 'attacks blocked' },
    d?.top1_accuracy != null && { k: `${Math.round(d.top1_accuracy * 100)}%`, v: 'Crop Doctor accuracy' },
    a?.answers && { k: `${Math.round(a.answers.faithfulness * 100)}%`, v: 'answers true to source' },
  ].filter(Boolean) as { k: string; v: string }[]
  if (!items.length) return null
  return (
    <Link to="/eval" className="group block rounded-[var(--radius-card)] border border-line bg-surface p-4 no-underline shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-ink">
          <span className="grid size-8 place-items-center rounded-lg bg-leaf-soft text-leaf">
            <ShieldCheck className="size-[18px]" aria-hidden />
          </span>
          Measured, not claimed
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-leaf">
          See how <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.v}>
            <div className="font-display text-[1.6rem] font-bold leading-none tabular-nums text-ink">{i.k}</div>
            <div className="mt-1 text-xs text-muted">{i.v}</div>
          </div>
        ))}
      </div>
    </Link>
  )
}

export default function Home() {
  const { place } = usePrefs()
  const city = place?.city ?? 'Hyderabad'
  const { season, failed } = useSeason(city)
  return (
    <div className="space-y-7">
      <Hero season={season} />
      <Tools />
      <TodayCard city={city} season={season} failed={failed} />
      <TrustStrip />
    </div>
  )
}
