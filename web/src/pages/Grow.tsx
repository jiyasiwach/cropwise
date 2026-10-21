import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudSun, FlaskConical, MapPin, Sprout } from 'lucide-react'
import { api, ApiError, type PredictIn, type Soil, type Weather } from '../lib/api'
import { save, usePrefs } from '../lib/prefs'
import { Button, Card, ErrorBox, Note, PageTitle, SectionTitle, SourceChip } from '../components/ui'

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
      <span className="mb-1 block text-sm font-semibold text-ink">
        {field.label} {field.unit && <span className="font-normal text-muted">({field.unit})</span>}
      </span>
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
        className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-[17px] tabular-nums text-ink"
      />
    </label>
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

  const ready = [...SOIL, ...CLIMATE].every((f) => values[f.key] !== undefined && values[f.key] !== '')

  return (
    <div className="space-y-5">
      <PageTitle title={t('grow.title')} subtitle="We read the soil and the last 30 days of weather for your area, then suggest three crops with the reasons behind each." />

      <Card>
        <form onSubmit={detect} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1" htmlFor="town">
            <span className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <MapPin className="size-4 text-leaf" aria-hidden /> {t('grow.town')}
            </span>
            <input
              id="town"
              value={town}
              onChange={(e) => setTown(e.target.value)}
              placeholder="e.g. Pune, Guntur, Ludhiana"
              autoComplete="address-level2"
              className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-[17px]"
            />
          </label>
          <Button type="submit" busy={detecting} disabled={!town.trim()} className="h-12">
            {t('grow.detect')}
          </Button>
        </form>
        {place && <p className="mt-2 text-sm text-muted">📍 {[place.city, place.district, place.state].filter(Boolean).join(', ')}</p>}
        {detectError && (
          <div className="mt-3">
            <Note tone="warn">
              {detectError} You can type the values below — a Soil Health Card is more accurate anyway.
            </Note>
          </div>
        )}
      </Card>

      <form onSubmit={recommend} className="space-y-5">
        <Card>
          <SectionTitle aside={soil && <SourceChip source={soil.source} />}>
            <span className="inline-flex items-center gap-2">
              <Sprout className="size-5 text-leaf" aria-hidden /> Soil
            </span>
          </SectionTitle>
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
          <p className="mt-2 text-xs text-muted">Map estimate (~250 m), top 5 cm. Phosphorus and potassium need a soil test — no map can measure them.</p>

          <button type="button" onClick={() => setShowLab(!showLab)} className="mt-4 inline-flex items-center gap-2 font-semibold text-leaf" aria-expanded={showLab}>
            <FlaskConical className="size-4" aria-hidden /> {showLab ? 'Hide' : 'I have a Soil Health Card'} (N-P-K)
          </button>
          {showLab && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {LAB.map((f) => (
                <NumberField key={f.key} field={f} values={values} setValues={setValues} required={false} />
              ))}
              <p className="col-span-3 text-xs text-muted">With all three, CropWise uses its soil-test model (99.6% vs 97% on the same dataset).</p>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle aside={weather && <SourceChip source={weather.source} />}>
            <span className="inline-flex items-center gap-2">
              <CloudSun className="size-5 text-leaf" aria-hidden /> Weather
            </span>
          </SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            {CLIMATE.map((f) => (
              <NumberField key={f.key} field={f} values={values} setValues={setValues} />
            ))}
          </div>
        </Card>

        <Card>
          <label htmlFor="acres" className="block max-w-xs">
            <span className="mb-1 block text-sm font-semibold">Your land (acres)</span>
            <input
              id="acres"
              type="number"
              inputMode="decimal"
              min={0.1}
              max={1000}
              step={0.1}
              value={acres}
              onChange={(e) => setAcres(Number(e.target.value))}
              className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-[17px]"
            />
          </label>
          <p className="mt-1 text-xs text-muted">Used for fertiliser bags and profit in your season plan.</p>
        </Card>

        {error && <ErrorBox message={error} />}
        <Button type="submit" busy={busy} disabled={!ready} className="w-full text-lg sm:w-auto">
          {t('grow.recommend')} →
        </Button>
        {!ready && <p className="text-sm text-muted">Fill in or detect all soil and weather values to continue.</p>}
      </form>
    </div>
  )
}
