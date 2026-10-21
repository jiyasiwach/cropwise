import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Camera, IndianRupee, MapPin, Send, ShieldCheck, Sprout, CalendarDays } from 'lucide-react'
import { api, type EvalData, type Season } from '../lib/api'
import { usePrefs } from '../lib/prefs'
import { useListener } from '../lib/speech'
import { Card, Chip, CROP_ICONS, cropName, MicButton, SectionTitle, Skeleton, cx } from '../components/ui'

function Tile({ to, icon, title, hint, tone }: { to: string; icon: React.ReactNode; title: string; hint: string; tone: string }) {
  return (
    <Link
      to={to}
      className="group flex min-h-32 flex-col justify-between rounded-[var(--radius-card)] border border-line bg-surface p-4 no-underline shadow-card transition hover:-translate-y-0.5 hover:border-leaf/40"
    >
      <span className={cx('grid size-12 place-items-center rounded-2xl', tone)}>{icon}</span>
      <span>
        <span className="block font-display text-lg font-bold leading-tight text-ink">{title}</span>
        <span className="mt-0.5 flex items-center gap-1 text-sm text-muted">
          {hint} <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </span>
    </Link>
  )
}

function SeasonCard() {
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
    <Card>
      <SectionTitle
        aside={
          <Link to="/grow" className="inline-flex items-center gap-1 text-sm font-semibold text-leaf no-underline">
            <MapPin className="size-4" aria-hidden /> {place ? 'Change' : 'Set my town'}
          </Link>
        }
      >
        {t('home.now')} {city}
      </SectionTitle>
      {failed && <p className="text-sm text-muted">Live soil and weather are slow to answer just now. Your plan still works — try again in a minute.</p>}
      {!season && !failed && (
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}
      {season && (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: 'Soil pH', value: season.soil?.ph ?? '—' },
              { label: 'Rain (30 d)', value: season.weather ? `${Math.round(season.weather.rainfall)} mm` : '—' },
              { label: 'Temperature', value: season.weather ? `${Math.round(season.weather.temperature)}°C` : '—' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-surface-2 px-3 py-2.5">
                <div className="text-xs text-muted">{s.label}</div>
                <div className="font-display text-xl font-bold tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>
          {season.sowable.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-sm font-semibold text-muted">You can still sow this {season.month}</div>
              <div className="flex flex-wrap gap-2">
                {season.sowable.slice(0, 4).map((s) => (
                  <Link
                    key={s.crop}
                    to={`/plan/${s.crop}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink no-underline hover:border-leaf/50"
                  >
                    <span aria-hidden>{CROP_ICONS[s.crop] ?? '🌱'}</span> {cropName(s.crop)}
                    <Chip>{s.days_left} days left</Chip>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {season.soil?.sample_note && <p className="mt-3 text-xs text-muted">{season.soil.sample_note}</p>}
          <p className="mt-2 text-xs text-muted">Soil: ISRIC SoilGrids · Weather: Open-Meteo</p>
        </>
      )}
    </Card>
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
    <Link to="/eval" className="block no-underline">
      <div className="flex items-center gap-2 text-sm font-semibold text-leaf">
        <ShieldCheck className="size-4" aria-hidden /> Measured, not claimed — see how
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.v} className="rounded-2xl border border-line bg-surface px-3 py-2">
            <div className="font-display text-xl font-extrabold text-ink tabular-nums">{i.k}</div>
            <div className="text-xs text-muted">{i.v}</div>
          </div>
        ))}
      </div>
    </Link>
  )
}

export default function Home() {
  const { t, lang } = usePrefs()
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')

  const go = useCallback((q: string) => navigate(`/ask?q=${encodeURIComponent(q)}`), [navigate])
  const { supported, listening, toggle } = useListener(lang, setQuestion, go)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (question.trim()) go(question.trim())
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] bg-leaf-strong px-5 pb-5 pt-6 text-white dark:bg-leaf-soft">
        <p className="text-sm font-semibold text-white/75 dark:text-leaf">🙏 Namaste</p>
        <h1 className="mt-1 text-[1.65rem] font-extrabold leading-tight text-white sm:text-3xl dark:text-ink">{t('home.title')}</h1>
        <form onSubmit={submit} className="mt-4 flex items-center gap-2">
          <MicButton listening={listening} supported={supported} onClick={toggle} large />
          <label className="sr-only" htmlFor="home-ask">
            {t('home.ask')}
          </label>
          <input
            id="home-ask"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('home.ask')}
            className="h-14 min-w-0 flex-1 rounded-2xl border-0 bg-white px-4 text-[17px] text-[#15211a] placeholder:text-[#6b7a70]"
          />
          <button type="submit" className="grid size-14 shrink-0 place-items-center rounded-2xl bg-amber text-[#2a1c00]" aria-label={t('common.send')}>
            <Send className="size-5" aria-hidden />
          </button>
        </form>
        <p className="mt-2.5 text-xs text-white/70 dark:text-muted">{t('home.note')}</p>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile to="/grow" title={t('tile.grow')} hint={t('hint.grow')} icon={<Sprout className="size-6 text-leaf" />} tone="bg-leaf-soft" />
        <Tile to="/doctor" title={t('tile.doctor')} hint={t('hint.doctor')} icon={<Camera className="size-6 text-[#b5481e]" />} tone="bg-[#fde7dc] dark:bg-[#3a2016]" />
        <Tile to="/impact#calculator" title={t('tile.sell')} hint={t('hint.sell')} icon={<IndianRupee className="size-6 text-amber-ink" />} tone="bg-amber-soft" />
        <Tile to="/results" title={t('tile.plan')} hint={t('hint.plan')} icon={<CalendarDays className="size-6 text-[#2f5fb3]" />} tone="bg-[#e3ecfb] dark:bg-[#18263f]" />
      </div>

      <SeasonCard />
      <TrustStrip />
    </div>
  )
}
