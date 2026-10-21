import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CloudRain, FlaskConical, MapPin, Send, ShieldCheck, Thermometer } from 'lucide-react'
import { api, type EvalData, type Season } from '../lib/api'
import { usePrefs } from '../lib/prefs'
import { useListener } from '../lib/speech'
import { CropIcon, cropName, MicButton, Skeleton, TONE_BG, cx, type Tone } from '../components/ui'
import { ArtChannels, ArtDoctor, ArtGrow, ArtPlan, ArtSchemes, ArtSell, ArtYield, HeroScene, HeroSky } from '../components/art'

function greetingKey() {
  const h = new Date().getHours()
  return h < 12 ? 'greet.morning' : h < 17 ? 'greet.afternoon' : 'greet.evening'
}

function Hero() {
  const { t, lang, place } = usePrefs()
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const go = useCallback((q: string) => navigate(`/ask?q=${encodeURIComponent(q)}`), [navigate])
  const { supported, listening, toggle } = useListener(lang, setQuestion, go)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (question.trim()) go(question.trim())
  }

  return (
    <section className="relative overflow-hidden rounded-[1.9rem] border border-line/70 bg-gradient-to-b from-[#fdf0d2] via-[#f7efdd] to-[#e6efd6] dark:from-[#1d2a1f] dark:via-[#172119] dark:to-[#132016]">
      <div className="pointer-events-none absolute -right-8 -top-8 w-36 sm:right-2 sm:top-0 sm:w-72 dark:opacity-70" aria-hidden>
        <HeroSky />
      </div>
      <div className="relative z-10 px-5 pt-6 sm:px-8 sm:pt-8">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-ink/70">
          <span>{t(greetingKey() as Parameters<typeof t>[0])}</span>
          {place && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 text-leaf" aria-hidden /> {place.city}
              </span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </p>
        <h1 className="mt-2 max-w-[18ch] text-[2rem] leading-[1.1] text-ink sm:text-[2.6rem]">{t('home.title')}</h1>
        <form onSubmit={submit} className="mt-5 flex max-w-2xl items-center gap-2 rounded-[1.4rem] border border-line bg-surface p-2 shadow-card">
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
          <button type="submit" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-leaf text-on-leaf transition hover:brightness-110" aria-label={t('common.send')}>
            <Send className="size-5" aria-hidden />
          </button>
        </form>
        <p className="mt-2.5 text-xs text-ink/60">{t('home.note')}</p>
      </div>
      <div className="relative mt-3 aspect-[640/128] max-h-44 min-h-24 w-full dark:opacity-80 dark:saturate-[.8]">
        <HeroScene />
      </div>
    </section>
  )
}

function ToolCard({ to, art, title, hint, tone, featured, cta }: { to: string; art: ReactNode; title: string; hint: string; tone: Tone; featured?: boolean; cta?: string }) {
  return (
    <Link
      to={to}
      className={cx(
        'group flex overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface no-underline shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-leaf/40',
        featured ? 'col-span-2 flex-col sm:flex-row' : 'flex-col',
      )}
    >
      <span className={cx('relative grid place-items-center overflow-hidden', TONE_BG[tone], featured ? 'h-36 sm:h-auto sm:w-[46%]' : 'h-28 sm:h-32')}>
        <span className="pointer-events-none absolute -bottom-8 left-1/2 size-32 -translate-x-1/2 rounded-full bg-surface/40" aria-hidden />
        <span className={cx('relative transition duration-300 group-hover:scale-[1.06]', featured ? 'w-36 sm:w-44' : 'w-28 sm:w-32')}>{art}</span>
      </span>
      <span className={cx('flex flex-1 flex-col justify-between gap-2', featured ? 'p-5' : 'p-4')}>
        <span>
          <span className={cx('block font-bold leading-snug text-ink', featured ? 'font-display text-[1.45rem]' : 'text-[1.02rem]')}>{title}</span>
          <span className="mt-0.5 block text-sm text-muted">{hint}</span>
        </span>
        {featured ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-leaf px-3.5 py-2 text-sm font-semibold text-on-leaf transition group-hover:brightness-110">
            {cta} <ArrowRight className="size-4" aria-hidden />
          </span>
        ) : (
          <span className="grid size-8 place-items-center self-end rounded-full bg-surface-2 text-muted transition group-hover:bg-leaf group-hover:text-on-leaf">
            <ArrowRight className="size-4" aria-hidden />
          </span>
        )}
      </span>
    </Link>
  )
}

function Tools() {
  const { t } = usePrefs()
  return (
    <section aria-labelledby="tools-title">
      <h2 id="tools-title" className="mb-3 px-1 text-[1.35rem] text-ink">
        {t('home.tools')}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <ToolCard to="/grow" featured art={<ArtGrow />} tone="leaf" title={t('tile.grow')} hint="We read your soil and 30 days of weather, then suggest three crops with the reasons." cta="Read my soil" />
        <ToolCard to="/doctor" art={<ArtDoctor />} tone="clay" title={t('tile.doctor')} hint={t('hint.doctor')} />
        <ToolCard to="/impact#calculator" art={<ArtSell />} tone="amber" title={t('tile.sell')} hint={t('hint.sell')} />
        <ToolCard to="/results" art={<ArtPlan />} tone="sky" title={t('tile.plan')} hint={t('hint.plan')} />
        <ToolCard to="/yield" art={<ArtYield />} tone="leaf" title={t('tile.yield')} hint={t('hint.yield')} />
        <ToolCard to="/schemes" art={<ArtSchemes />} tone="amber" title={t('tile.schemes')} hint={t('hint.schemes')} />
        <ToolCard to="/community" art={<ArtChannels />} tone="sky" title={t('tile.community')} hint={t('hint.community')} />
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

function TodayCard() {
  const { place, t } = usePrefs()
  const city = place?.city ?? 'Hyderabad'
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
  return (
    <div className="space-y-7">
      <Hero />
      <Tools />
      <TodayCard />
      <TrustStrip />
    </div>
  )
}
