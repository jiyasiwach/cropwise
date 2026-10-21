import { Link } from 'react-router-dom'
import { ArrowRight, Check, TriangleAlert } from 'lucide-react'
import type { PredictIn, PredictOut, Place } from '../lib/api'
import { load, usePrefs } from '../lib/prefs'
import { ConfidenceRing } from '../components/charts'
import { ButtonLink, Chip, CropIcon, cropName, cx, ListenButton, Note, PageTitle } from '../components/ui'

interface Saved {
  result: PredictOut
  inputs: PredictIn
  place: Place | null
  at: string
}

export default function Results() {
  const { t } = usePrefs()
  const saved = load<Saved | null>('cw.result', null)

  if (!saved) {
    return (
      <div className="space-y-5">
        <PageTitle photo="results" title={t('results.title')} subtitle="Tell us where your farm is first — it takes about a minute." />
        <ButtonLink to="/grow">{t('tile.grow')} →</ButtonLink>
      </div>
    )
  }

  const { result, inputs, place } = saved
  const lab = result.model_source === 'lab'
  return (
    <div className="space-y-5">
      <PageTitle photo="results"
        title={t('results.title')}
        subtitle={
          <>
            {place?.city ?? inputs.city ?? 'Your farm'} · {new Date(saved.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ·{' '}
            <Link to="/grow">change</Link>
          </>
        }
      >
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone={lab ? 'good' : 'neutral'}>{lab ? 'Soil-test model (99.6% on test data)' : 'Town-estimate model (97% on test data)'}</Chip>
          <Chip>Trained on a public teaching dataset</Chip>
        </div>
      </PageTitle>

      {result.unusual_readings && (
        <Note tone="warn">These readings are unusual for every crop the model knows, so treat these suggestions with extra care and check with your Krishi Vigyan Kendra.</Note>
      )}

      <div className="space-y-4">
        {result.crops.map((c, i) => {
          const speech = `${cropName(c.crop)}, ${Math.round(c.confidence)} percent match. ${c.reasons.map((r) => r.text).join('. ')}`
          return (
            <article
              key={c.crop}
              className={cx(
                'overflow-hidden rounded-[var(--radius-card)] border bg-surface shadow-card',
                i === 0 ? 'border-leaf/50' : 'border-line',
              )}
            >
              <div className={cx('flex items-center gap-4 px-4 py-4 sm:px-5', i === 0 ? 'bg-leaf-soft' : 'bg-surface-2/50')}>
                <span className="relative">
                  <CropIcon crop={c.crop} size="lg" />
                  <span className={cx('absolute -left-1.5 -top-1.5 grid size-6 place-items-center rounded-full border-2 border-surface text-xs font-bold', i === 0 ? 'bg-amber text-[#2a1c00]' : 'bg-surface text-muted')}>
                    {i + 1}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  {i === 0 && <div className="text-xs font-bold uppercase tracking-[0.12em] text-leaf">Best match for your field</div>}
                  <h2 className="text-[1.6rem] text-ink">{cropName(c.crop)}</h2>
                </div>
                <ConfidenceRing value={c.confidence} />
              </div>
              <div className="px-4 pb-4 pt-3 sm:px-5">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Why</div>
                <ul className="flex flex-wrap gap-1.5" aria-label="Why">
                  {c.reasons.map((r) => (
                    <li key={r.text}>
                      <Chip tone={r.good ? 'good' : 'warn'}>
                        {r.good ? <Check className="size-3.5" aria-hidden /> : <TriangleAlert className="size-3.5" aria-hidden />} {r.text}
                      </Chip>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <ListenButton id={`crop-${c.crop}`} text={speech} />
                  <ButtonLink to={`/plan/${c.crop}`} variant={i === 0 ? 'primary' : 'secondary'}>
                    {t('results.plan')} <ArrowRight className="size-4" aria-hidden />
                  </ButtonLink>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      <p className="text-xs text-muted">Reasons are SHAP explanations of this prediction. Confidence is the model's, not a guarantee — your field's history matters too.</p>
    </div>
  )
}
