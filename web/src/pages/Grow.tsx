import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, CloudSun, FlaskConical, LandPlot, MapPin, Sprout } from 'lucide-react'
import { api, ApiError, type PredictIn, type Soil, type Weather } from '../lib/api'
import { save, usePrefs } from '../lib/prefs'
import { Button, ErrorBox, Note, PageTitle, SourceChip, TONE_BG, cx, inputCls, type Tone } from '../components/ui'

// No `step`: detected values (27.31 °C) must never fail the browser's own form check.
type Field = { key: keyof PredictIn; label: string; unit: string; min: number; max: number; step: number }

const SOIL: Field[] = [
  { key: 'nitrogen', label: 'Nitrogen', unit: 'g/kg', min: 0, max: 50, step: 0.01 },
  { key: 'ph', label: 'Soil pH', unit: '', min: 0, max: 14, step: 0.1 },
  { key: 'clay', label: 'Clay', unit: '%', min: 0, max: 100, step: 0.1 },
  { key: 'organic_carbon', label: 'Organic carbon', unit: 'g/kg', min: 0, max: 200, step: 0.1 },
]
const CLIMATE: Field[] = [
  { key: 'temperature', label: 'Temperature', unit: '°C', min: -30, max: 60, step: 0.1 },
  { key: 'humidity', label: 'Humidity', unit: '%', min: 0, max: 100, step: 1 },
  { key: 'rainfall', label: 'Rainfall (30 days)', unit: 'mm', min: 0, max: 5000, step: 0.1 },
]
const LAB: Field[] = [
  { key: 'lab_nitrogen', label: 'N', unit: 'kg/ha', min: 0, max: 500, step: 1 },
  { key: 'lab_phosphorus', label: 'P', unit: 'kg/ha', min: 0, max: 500, step: 1 },
  { key: 'lab_potassium', label: 'K', unit: 'kg/ha', min: 0, max: 500, step: 1 },
]

type Values = Partial<Record<keyof PredictIn, string>>

function NumberField({ field, values, setValues, required = true }: { field: Field; values: Values; setValues: (v: Values) => void; required?: boolean }) {
  const id = `f-${field.key}`
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink/80">{field.label}</span>
      <span className="relative block">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          step="any"
          required={required}
          value={values[field.key] ?? ''}
          onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
          className={cx(inputCls, 'tabular-nums', field.unit && 'pr-14')}
        />
        {field.unit && <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted">{field.unit}</span>}
      </span>
    </label>
  )
}

/** A numbered step: its badge turns into a tick once the step is complete. */
function Step({ n, done, icon, tone, title, hint, aside, children }: { n: number; done: boolean; icon: React.ReactNode; tone: Tone; title: string; hint?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className={cx('relative grid size-11 shrink-0 place-items-center rounded-2xl', TONE_BG[tone])}>
          {icon}
          <span
            className={cx(
              'absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border-2 border-surface text-[10px] font-bold',
              done ? 'bg-leaf text-on-leaf' : 'bg-surface-2 text-muted',
            )}
          >
            {done ? <Check className="size-3" strokeWidth={3.5} aria-label="done" /> : n}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.25rem] text-ink">{title}</h2>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

export default function Grow() {
  const { t, place, setPlace, acres, setAcres } = usePrefs()
  const navigate = useNavigate()
  const [town, setTown] = useState(place?.city ?? '')
  const [values, setValues] = useState<Values>({})
  const [soil, setSoil] = useState<Soil | null>(null)
  const [weather, setWeather] = useState<Weather | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [detectError, setDetectError] = useState<string | null>(null)
  const [showLab, setShowLab] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detect = async (e?: FormEvent) => {
    e?.preventDefault()
    const city = town.trim()
    if (!city) return
    setDetecting(true)
    setDetectError(null)
    try {
      const [p, s, w] = await Promise.allSettled([api.place(city), api.soil(city), api.weather(city)])
      if (p.status === 'fulfilled') setPlace(p.value)
      else throw p.reason
      const next: Values = { ...values }
      if (s.status === 'fulfilled') {
        setSoil(s.value)
        for (const k of ['nitrogen', 'ph', 'clay', 'organic_carbon'] as const) if (s.value[k] != null) next[k] = String(s.value[k])
      } else setSoil(null)
      if (w.status === 'fulfilled') {
        setWeather(w.value)
        next.temperature = String(w.value.temperature)
        next.humidity = String(w.value.humidity)
        next.rainfall = String(w.value.rainfall)
      } else setWeather(null)
      setValues(next)
      const problems = [s, w].filter((r) => r.status === 'rejected').map((r) => ((r as PromiseRejectedResult).reason as Error).message)
      if (problems.length) setDetectError(problems.join(' '))
    } catch (err) {
      setDetectError(err instanceof ApiError ? err.message : 'Could not look up that town. Check the spelling and try again.')
    } finally {
      setDetecting(false)
    }
  }

  const recommend = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const body: PredictIn = {
      nitrogen: Number(values.nitrogen),
      ph: Number(values.ph),
      clay: Number(values.clay),
      organic_carbon: Number(values.organic_carbon),
      temperature: Number(values.temperature),
      humidity: Number(values.humidity),
      rainfall: Number(values.rainfall),
      city: place?.city ?? (town.trim() || undefined),
      latitude: place?.latitude,
      longitude: place?.longitude,
    }
    if (showLab) {
      for (const f of LAB) if (values[f.key]) (body as unknown as Record<string, number>)[f.key] = Number(values[f.key])
    }
    try {
      const result = await api.predict(body)
      save('cw.result', { result, inputs: body, place, at: new Date().toISOString() })
      navigate('/results')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not get a recommendation. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const has = (f: Field) => values[f.key] !== undefined && values[f.key] !== ''
  const soilDone = SOIL.every(has)
  const weatherDone = CLIMATE.every(has)
  const total = SOIL.length + CLIMATE.length
  const filled = [...SOIL, ...CLIMATE].filter(has).length
  const ready = filled === total

  return (
    <div className="space-y-5">
      <PageTitle photo="grow" title={t('grow.title')} subtitle="We read the soil and the last 30 days of weather for your area, then suggest three crops with the reasons behind each." />

      <Step n={1} done={!!place} icon={<MapPin className="size-5 text-clay" aria-hidden />} tone="clay" title="Your farm's town" hint="We look up the soil map and 30 days of weather there.">
        <form onSubmit={detect} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1" htmlFor="town">
            <span className="sr-only">{t('grow.town')}</span>
            <input
              id="town"
              value={town}
              onChange={(e) => setTown(e.target.value)}
              placeholder="e.g. Pune, Guntur, Ludhiana"
              autoComplete="address-level2"
              className={inputCls}
            />
          </label>
          <Button type="submit" busy={detecting} disabled={!town.trim()} className="h-12">
            {t('grow.detect')}
          </Button>
        </form>
        {place && (
          <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-leaf-soft px-3 py-1 text-sm font-semibold text-leaf">
            <Check className="size-3.5" strokeWidth={3} aria-hidden /> {[place.city, place.district, place.state].filter(Boolean).join(', ')}
          </p>
        )}
        {detectError && (
          <div className="mt-3">
            <Note tone="warn">
              {detectError} You can type the values below — a Soil Health Card is more accurate anyway.
            </Note>
          </div>
        )}
      </Step>

      <form onSubmit={recommend} className="space-y-5">
        <Step
          n={2}
          done={soilDone}
          icon={<Sprout className="size-5 text-leaf" aria-hidden />}
          tone="leaf"
          title="Soil"
          hint="Filled in from the soil map — change anything you know better."
          aside={soil && <SourceChip source={soil.source} />}
        >
          {soil?.sample_note && (
            <div className="mb-3">
              <Note>{soil.sample_note}</Note>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SOIL.map((f) => (
              <NumberField key={f.key} field={f} values={values} setValues={setValues} />
            ))}
          </div>
          <p className="mt-2.5 text-xs text-muted">Map estimate (~250 m), top 5 cm. Phosphorus and potassium need a soil test — no map can measure them.</p>

          <button
            type="button"
            onClick={() => setShowLab(!showLab)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-leaf/50 px-3.5 py-2 text-sm font-semibold text-leaf hover:bg-leaf-soft"
            aria-expanded={showLab}
          >
            <FlaskConical className="size-4" aria-hidden /> {showLab ? 'Hide soil test values' : 'I have a Soil Health Card (N-P-K)'}
          </button>
          {showLab && (
            <div className="mt-3 grid grid-cols-3 gap-3 rounded-2xl bg-surface-2/60 p-3">
              {LAB.map((f) => (
                <NumberField key={f.key} field={f} values={values} setValues={setValues} required={false} />
              ))}
              <p className="col-span-3 text-xs text-muted">With all three, CropWise uses its soil-test model (99.6% vs 97% on the same dataset).</p>
            </div>
          )}
        </Step>

        <Step
          n={3}
          done={weatherDone}
          icon={<CloudSun className="size-5 text-sky" aria-hidden />}
          tone="sky"
          title="Weather"
          hint="Averages for the last 30 days."
          aside={weather && <SourceChip source={weather.source} />}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {CLIMATE.map((f) => (
              <NumberField key={f.key} field={f} values={values} setValues={setValues} />
            ))}
          </div>
        </Step>

        <Step n={4} done={acres > 0} icon={<LandPlot className="size-5 text-amber-ink" aria-hidden />} tone="amber" title="Your land" hint="Used for fertiliser bags and profit in your season plan.">
          <label htmlFor="acres" className="block max-w-xs">
            <span className="relative block">
              <input
                id="acres"
                type="number"
                inputMode="decimal"
                min={0.1}
                max={1000}
                step="any"
                value={acres}
                onChange={(e) => setAcres(Number(e.target.value))}
                className={cx(inputCls, 'pr-16 tabular-nums')}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted">acres</span>
            </span>
          </label>
        </Step>

        {error && <ErrorBox message={error} />}
        <div className="sticky bottom-24 z-20 flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface/95 p-3 shadow-card backdrop-blur sm:flex-row sm:items-center lg:bottom-4">
          <div className="flex-1 px-1">
            <div className="text-sm font-semibold text-ink">{ready ? 'All set — ready for your crops' : `${filled} of ${total} values filled`}</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-leaf transition-all" style={{ width: `${(filled / total) * 100}%` }} />
            </div>
          </div>
          <Button type="submit" busy={busy} disabled={!ready} className="text-base sm:px-6">
            {t('grow.recommend')} →
          </Button>
        </div>
      </form>
    </div>
  )
}
