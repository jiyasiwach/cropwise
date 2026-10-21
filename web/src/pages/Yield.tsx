import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, CalendarRange, Database, MapPin, Scale, Target } from 'lucide-react'
import { api, type YieldForecast, type YieldOptions } from '../lib/api'
import { usePrefs } from '../lib/prefs'
import { Button, Card, Chip, CropIcon, ErrorBox, ListenButton, Loading, Note, PageTitle, SectionTitle, inputCls } from '../components/ui'

const SEASON_LABEL: Record<string, string> = {
  Kharif: 'Kharif (monsoon, Jun–Oct)',
  Rabi: 'Rabi (winter, Oct–Mar)',
  Summer: 'Summer / Zaid (Mar–Jun)',
}

function seasonNow(): string {
  const m = new Date().getMonth() + 1
  if (m >= 6 && m <= 9) return 'Kharif'
  if (m >= 10 || m <= 2) return 'Rabi'
  return 'Summer'
}

const num = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 1 })

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  )
}

const selectCls = inputCls

function RangeBar({ low, likely, high, min, max }: { low: number; likely: number; high: number; min: number; max: number }) {
  const span = max - min || 1
  const pos = (v: number) => `${((v - min) / span) * 100}%`
  return (
    <div className="relative mt-6 h-3 rounded-full bg-surface-2" role="img" aria-label={`Likely ${num(likely)}, range ${num(low)} to ${num(high)} quintal per acre`}>
      <div className="absolute inset-y-0 rounded-full bg-leaf/30" style={{ left: pos(low), width: `calc(${pos(high)} - ${pos(low)})` }} />
      <div className="absolute -top-1.5 h-6 w-1.5 -translate-x-1/2 rounded-full bg-leaf" style={{ left: pos(likely) }} />
      <span className="absolute top-5 -translate-x-1/2 text-xs text-muted tabular-nums" style={{ left: pos(low) }}>
        {num(low)}
      </span>
      <span className="absolute top-5 -translate-x-1/2 text-xs text-muted tabular-nums" style={{ left: pos(high) }}>
        {num(high)}
      </span>
    </div>
  )
}

function HistoryBars({ result }: { result: YieldForecast }) {
  const rows = [...result.history.map((h) => ({ label: h.season, value: h.quintal_per_acre, forecast: false })), { label: result.forecast_for, value: result.quintal_per_acre.likely, forecast: true }]
  const max = Math.max(...rows.map((r) => r.value), result.quintal_per_acre.high)
  return (
    <figure>
      <div className="flex h-36 items-end gap-2" role="img" aria-label="District yield in recent seasons and the forecast">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[11px] font-semibold tabular-nums text-muted">{num(r.value)}</span>
            <div
              className={r.forecast ? 'w-full rounded-t-md border-2 border-dashed border-leaf bg-leaf/15' : 'w-full rounded-t-md bg-leaf/70'}
              style={{ height: `${Math.max(6, (r.value / max) * 100)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {rows.map((r) => (
          <span key={r.label} className="flex-1 text-center text-[10px] text-muted">
            {r.label.slice(2)}{r.forecast ? '*' : ''}
          </span>
        ))}
      </div>
      <figcaption className="mt-2 text-xs text-muted">Quintal per acre, district average. * Dashed bar = this forecast.</figcaption>
    </figure>
  )
}

export default function Yield() {
  const { place, acres, setAcres, t } = usePrefs()
  const resultRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<string>(place?.state ?? '')
  const [district, setDistrict] = useState<string>(place?.district ?? '')
  const [opts, setOpts] = useState<YieldOptions | null>(null)
  const [crop, setCrop] = useState('')
  const [season, setSeason] = useState('')
  const [result, setResult] = useState<YieldForecast | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api
      .yieldOptions(state || null, district || null)
      .then((o) => {
        if (!live) return
        setOpts(o)
        if (o.state && o.state !== state) setState(o.state)
        if (o.district && o.district !== district) setDistrict(o.district)
      })
      .catch(() => live && setError('Could not load the list of districts just now.'))
    return () => {
      live = false
    }
  }, [state, district])

  const crops = useMemo(() => opts?.crops ?? [], [opts])
  const cropInfo = crops.find((c) => c.crop === crop)

  useEffect(() => {
    if (crops.length && !crops.some((c) => c.crop === crop)) setCrop(crops.find((c) => c.crop === 'rice')?.crop ?? crops[0].crop)
  }, [crops, crop])

  useEffect(() => {
    if (!cropInfo) return
    if (!cropInfo.seasons.includes(season)) setSeason(cropInfo.seasons.includes(seasonNow()) ? seasonNow() : cropInfo.seasons[0])
  }, [cropInfo, season])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!crop || !season || !opts?.state || !opts.district) return
    setBusy(true)
    setError(null)
    try {
      setResult(await api.yieldForecast(crop, opts.state, opts.district, season, acres || undefined))
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : 'Could not make a forecast just now.')
    } finally {
      setBusy(false)
    }
  }

  if (opts && !opts.available) return <ErrorBox message="The yield forecast is not available right now." />

  const r = result
  const lo = r ? Math.min(r.quintal_per_acre.low, ...r.history.map((h) => h.quintal_per_acre)) * 0.9 : 0
  const hi = r ? Math.max(r.quintal_per_acre.high, ...r.history.map((h) => h.quintal_per_acre)) * 1.05 : 1

  return (
    <div className="space-y-5">
      <PageTitle photo="yield"
        title={t('tile.yield')}
        subtitle="How much your crop is likely to give next season, per acre and for your whole field — learned from 25+ years of Government of India district crop records."
      />

      <form onSubmit={submit}>
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="State">
              <select
                className={selectCls}
                value={opts?.state ?? state}
                onChange={(e) => {
                  setState(e.target.value)
                  setDistrict('')
                  setResult(null)
                }}
              >
                <option value="">Choose your state</option>
                {opts?.states?.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="District">
              <select
                className={selectCls}
                value={opts?.district ?? ''}
                disabled={!opts?.districts?.length}
                onChange={(e) => {
                  setDistrict(e.target.value)
                  setResult(null)
                }}
              >
                <option value="">Choose your district</option>
                {opts?.districts?.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Crop">
              <select className={selectCls} value={crop} disabled={!crops.length} onChange={(e) => (setCrop(e.target.value), setResult(null))}>
                {!crops.length && <option value="">Choose a district first</option>}
                {crops.map((c) => (
                  <option key={c.crop} value={c.crop}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Season">
              <select className={selectCls} value={season} disabled={!cropInfo} onChange={(e) => (setSeason(e.target.value), setResult(null))}>
                {cropInfo?.seasons.map((s) => (
                  <option key={s} value={s}>
                    {SEASON_LABEL[s] ?? s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Your field (acres)">
              <input
                type="number"
                inputMode="decimal"
                min={0.1}
                max={1000}
                step="any"
                value={acres}
                onChange={(e) => setAcres(Number(e.target.value))}
                className={inputCls}
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" busy={busy} disabled={!crop || !season || !opts?.district} className="w-full">
                <Scale className="size-5" aria-hidden /> Forecast my yield
              </Button>
            </div>
          </div>
          {!place && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <MapPin className="size-3.5" aria-hidden /> Tip: <Link to="/grow">set your town</Link> once and your state and district fill in by themselves.
            </p>
          )}
        </Card>
      </form>

      {!opts && !error && <Loading />}
      {error && <ErrorBox message={error} />}

      {!r && opts && !error && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Database, k: '25+ years', v: 'of Government of India district crop records' },
            { icon: Target, k: 'Low · likely · high', v: 'a range, not a single guess — right 8 times in 10' },
            { icon: CalendarRange, k: 'Your district', v: 'its own recent seasons and trend, not a national average' },
          ].map(({ icon: Icon, k, v }) => (
            <div key={k} className="flex items-start gap-3 rounded-[var(--radius-card)] border border-dashed border-line px-4 py-3.5">
              <Icon className="mt-0.5 size-5 shrink-0 text-leaf" aria-hidden />
              <div>
                <div className="font-display font-bold text-ink">{k}</div>
                <div className="text-sm text-muted">{v}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {r && (
        <div ref={resultRef} className="scroll-mt-20 space-y-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <CropIcon crop={r.crop} size="lg" />
                <div>
                  <div className="text-sm text-muted">
                    {r.crop_name} · {r.season} {r.forecast_for} · {r.district}, {r.state}
                  </div>
                  <div className="font-display text-4xl font-extrabold tabular-nums text-ink">
                    {num(r.quintal_per_acre.likely)} <span className="text-lg font-bold text-muted">quintal / acre</span>
                  </div>
                </div>
              </div>
              <ListenButton
                id="yield"
                text={`${r.crop_name} in ${r.district}: about ${num(r.quintal_per_acre.likely)} quintal per acre, between ${num(r.quintal_per_acre.low)} and ${num(r.quintal_per_acre.high)}.${r.field_quintal ? ` For ${r.acres} acres, about ${num(r.field_quintal.likely)} quintal.` : ''}`}
              />
            </div>
            <RangeBar low={r.quintal_per_acre.low} likely={r.quintal_per_acre.likely} high={r.quintal_per_acre.high} min={lo} max={hi} />
            <p className="mt-8 text-sm text-muted">8 times in 10 the real district yield lands inside this range (measured on past seasons).</p>

            {r.field_quintal && (
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                {(['low', 'likely', 'high'] as const).map((k) => (
                  <div key={k} className={k === 'likely' ? 'rounded-2xl bg-leaf-soft px-3 py-3' : 'rounded-2xl bg-surface-2 px-3 py-3'}>
                    <div className="text-xs capitalize text-muted">{k === 'likely' ? 'Most likely' : k === 'low' ? 'Poor season' : 'Good season'}</div>
                    <div className="font-display text-xl font-bold tabular-nums">{num(r.field_quintal![k])} q</div>
                    <div className="text-[11px] text-muted">for {r.acres} {r.acres === 1 ? 'acre' : 'acres'}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip>5-year district average: {num(r.district_5yr_avg_quintal_per_acre)} q/acre</Chip>
              <Chip>{num(r.tonne_per_hectare.likely)} t/ha</Chip>
            </div>
          </Card>

          <Card>
            <SectionTitle>Recent seasons in {r.district}</SectionTitle>
            <HistoryBars result={r} />
          </Card>

          <Note>{r.note}</Note>

          {r.accuracy && (
            <Card className="bg-surface-2">
              <div className="flex items-start gap-3">
                <BarChart3 className="mt-0.5 size-5 shrink-0 text-leaf" aria-hidden />
                <div className="text-sm">
                  <p>
                    <strong>How accurate is this?</strong> Tested on {r.accuracy.rows.toLocaleString('en-IN')} district-seasons from 2018-19 onwards that the model never saw: typical
                    error <strong>{r.accuracy.model_median_error_pct}%</strong> (last season&apos;s yield as a guess: {r.accuracy.baseline_last_year_median_error_pct}%; 5-year
                    average: {r.accuracy.baseline_5yr_mean_median_error_pct}%).{' '}
                    <Link to="/eval#yield" className="font-semibold text-leaf underline underline-offset-2">
                      Full results by crop
                    </Link>
                  </p>
                  {r.source && <p className="mt-1.5 text-xs text-muted">{r.source}</p>}
                </div>
              </div>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Link to={`/plan/${r.crop}`} className="inline-flex min-h-11 items-center rounded-2xl border border-line bg-surface px-4 font-semibold no-underline">
              Season plan for {r.crop_name}
            </Link>
            <Link to="/schemes" className="inline-flex min-h-11 items-center rounded-2xl border border-line bg-surface px-4 font-semibold no-underline">
              Crop insurance &amp; schemes
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
