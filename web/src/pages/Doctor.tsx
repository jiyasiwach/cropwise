import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Camera, ImagePlus, RotateCcw } from 'lucide-react'
import { api, ApiError, type Condition, type DoctorResult } from '../lib/api'
import { usePrefs } from '../lib/prefs'
import { Stepper } from '../components/charts'
import { Button, Card, Chip, CROPS, cropName, ErrorBox, HelplineButton, ListenButton, Note, PageTitle, SectionTitle, SourceChip, cx } from '../components/ui'


/** Shrink in the browser: ≤1024 px JPEG keeps uploads small on 2G and far under the 4.5 MB limit. */
function shrink(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 1024 / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that photo.'))), 'image/jpeg', 0.85)
    }
    img.onerror = () => reject(new Error('That file is not a photo this browser can open.'))
    img.src = URL.createObjectURL(file)
  })
}

const VERDICT: Record<DoctorResult['status'], { label: string; tone: 'good' | 'warn' | 'bad' }> = {
  answered: { label: 'Likely problem found', tone: 'good' },
  healthy: { label: 'Looks healthy', tone: 'good' },
  retake: { label: 'Please retake the photo', tone: 'warn' },
  not_a_plant: { label: 'Not a plant', tone: 'warn' },
  low_confidence: { label: 'Not sure — ask an expert', tone: 'warn' },
  escalate: { label: 'Ask an expert', tone: 'warn' },
  blocked: { label: 'Photo not used', tone: 'bad' },
  error: { label: 'Something went wrong', tone: 'bad' },
}

function steps(result: DoctorResult) {
  const find = (name: string) => result.trace.find((t) => t.step === name)
  const order: [string, string][] = [
    ['classify', 'Look at the photo'],
    ['guardrail', 'Safety check'],
    ['retrieve', 'Find a trusted source'],
    ['answer', 'Advice from the source'],
  ]
  let stopped = false
  return order.map(([name, label]) => {
    const t = find(name)
    if (stopped || !t) return { label, state: 'skip' as const, detail: stopped ? 'Not needed — stopped earlier' : undefined }
    const bad = ['stop', 'blocked', 'escalate', 'failed', 'skipped', 'rejected'].includes(t.decision)
    if (bad) stopped = true
    const plain: Record<string, string> = {
      'guardrail:pass': 'A clear plant photo, and sure enough to advise',
      'answer:model': 'Written by AI from the cited source only',
      'answer:extractive': 'Quoted from the cited source',
      'classify:demo': 'Demo — you chose the condition',
    }
    const detail =
      plain[`${name}:${t.decision}`] ??
      (name === 'classify' && t.condition
        ? `Looks like ${String(t.condition).replace(/_/g, ' ')}${typeof t.confidence === 'number' ? ` · ${Math.round(t.confidence * 100)}% sure` : ''}`
        : name === 'retrieve' && Array.isArray(t.documents)
          ? `Found: ${(t.documents as string[]).map((d) => d.replace(/^disease_|\.md$/g, '').replace(/_/g, ' ')).join(', ')}`
          : typeof t.reason === 'string'
            ? t.reason
            : t.decision)
    return { label, state: bad ? ('stop' as const) : ('done' as const), detail }
  })
}

export default function Doctor() {
  const { lang } = usePrefs()
  const [params] = useSearchParams()
  const [crop, setCrop] = useState(params.get('crop') ?? '')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<DoctorResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conditions, setConditions] = useState<Condition[]>([])
  const [demo, setDemo] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.conditions().then(setConditions).catch(() => {})
  }, [])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const choose = async (file?: File) => {
    if (!file) return
    setError(null)
    setResult(null)
    try {
      const blob = await shrink(file)
      setPhoto(blob)
      setPreview(URL.createObjectURL(blob))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const check = async (demoCondition?: string) => {
    if (!photo) return
    setBusy(true)
    setError(null)
    try {
      const r = await api.doctor(photo, crop, lang, demoCondition)
      setResult(r)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach the server. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const verdict = result ? VERDICT[result.status] : null
  const escalated = result && result.status !== 'answered' && result.status !== 'healthy'

  return (
    <div className="space-y-5">
      <PageTitle title="Crop Doctor" subtitle="Photograph one sick leaf. You get the likely problem, how sure it is, and what to do — only from cited sources. When it is not sure, it says so." />

      <Card>
        <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cx(
            'flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-leaf/35 bg-leaf-soft/40 p-5 text-center transition hover:border-leaf',
            preview ? 'min-h-0' : 'min-h-52',
          )}
        >
          {preview ? (
            <>
              <img src={preview} alt="Your leaf photo" className="max-h-72 rounded-xl object-contain" />
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-leaf">
                <RotateCcw className="size-4" aria-hidden /> Change photo
              </span>
            </>
          ) : (
            <>
              <span className="grid size-16 place-items-center rounded-full bg-leaf text-on-leaf">
                <Camera className="size-8" aria-hidden />
              </span>
              <span className="font-display text-lg font-bold">Take or choose a photo</span>
              <span className="text-sm text-muted">One leaf, filling the frame · daylight · hold steady</span>
            </>
          )}
        </button>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block" htmlFor="crop">
            <span className="mb-1 block text-sm font-semibold">Crop</span>
            <select id="crop" value={crop} onChange={(e) => setCrop(e.target.value)} className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-[17px]">
              <option value="">Not sure</option>
              {CROPS.map((c) => (
                <option key={c} value={c}>
                  {cropName(c)}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => check()} busy={busy} disabled={!photo} className="h-12 text-lg">
            <ImagePlus className="size-5" aria-hidden /> Check this plant
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">Your photo is shrunk on your phone, checked once and discarded — never stored, never logged. No sign-up.</p>
      </Card>

      {error && <ErrorBox message={error} />}

      {result && verdict && (
        <div ref={resultRef} className="space-y-4" aria-live="polite">
          <Card className={verdict.tone === 'good' ? 'border-leaf/50' : undefined}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={verdict.tone}>
                {result.is_mock ? 'DEMO · ' : ''}
                {verdict.label}
              </Chip>
              {result.model && <Chip>{result.model}</Chip>}
              <Chip>{(result.latency_ms / 1000).toFixed(1)} s</Chip>
            </div>
            <p className="mt-3 text-lg font-semibold">{result.message}</p>
            {!!result.diagnosis?.visible_signs.length && <p className="mt-1 text-sm text-muted">Seen: {result.diagnosis.visible_signs.join(' · ')}</p>}
            <div className="mt-3">
              <ListenButton id="doctor" text={`${result.message}. ${result.treatment ?? ''}`} />
            </div>
          </Card>

          {result.treatment && (
            <Card>
              <SectionTitle>Advice from the cited source</SectionTitle>
              <div className="whitespace-pre-wrap rounded-2xl bg-surface-2 p-4 text-[15px] leading-relaxed">{result.treatment}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.citations.map((c) => {
                  const url = c.source.match(/https?:\/\/\S+/)?.[0]
                  return <SourceChip key={c.title} source={c.source} href={url} />
                })}
              </div>
              <p className="mt-3 text-sm font-semibold text-amber-ink">Confirm with your Krishi Vigyan Kendra before spraying anything.</p>
            </Card>
          )}

          <Card>
            <SectionTitle>How this answer was reached</SectionTitle>
            <Stepper steps={steps(result)} />
          </Card>

          {(escalated || result.treatment) && <HelplineButton />}

          {result.is_mock && (
            <Card className="border-amber/50 bg-amber-soft">
              <SectionTitle>Demo mode</SectionTitle>
              <p className="text-sm text-amber-ink">
                No vision model key is set on this server, so the photo was not analysed. Choose a condition to play the classifier — every later step (safety check, source, advice) runs for real.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <select value={demo} onChange={(e) => setDemo(e.target.value)} className="h-12 flex-1 rounded-xl border border-line bg-surface px-3" aria-label="Demo condition">
                  <option value="">Choose a condition…</option>
                  {conditions.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.title.split(' —')[0]}
                    </option>
                  ))}
                  <option value="healthy">Healthy leaf</option>
                  <option value="other">Something not in the list</option>
                </select>
                <Button variant="amber" onClick={() => check(demo)} disabled={!demo} busy={busy}>
                  Run the rest
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      <Card>
        <SectionTitle>What it can and cannot do</SectionTitle>
        <p className="text-sm text-muted">
          It advises only on the {conditions.length || 10} diseases in its knowledge base, each written from a cited TNAU or Government of India page. A blurry photo, a non-plant or a guess under 60% confidence goes to a person instead; in testing it once mistook a disease it does not cover for one it does. It never invents a pesticide or a dose.
        </p>
        {conditions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {conditions.map((c) => (
              <Chip key={c.key}>{c.title.split(' —')[0]}</Chip>
            ))}
          </div>
        )}
        <Note>
          <span>
            Accuracy and known failures are measured in public on <a href="/eval">How well it works</a>.
          </span>
        </Note>
      </Card>
    </div>
  )
}
