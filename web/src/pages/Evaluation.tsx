import { useEffect, useState } from 'react'
import { api, type EvalData, type YieldEval } from '../lib/api'
import { Card, Chip, ErrorBox, Loading, Note, PageTitle, SectionTitle, cx } from '../components/ui'

const pct = (v: number | null | undefined) => (v == null ? 'not measured' : `${Math.round(v * 100)}%`)

function Stat({ value, label, tone = 'leaf' }: { value: string; label: string; tone?: 'leaf' | 'amber' }) {
  return (
    <div className={cx('rounded-2xl p-4', tone === 'leaf' ? 'bg-leaf-soft' : 'bg-amber-soft')}>
      <div className={cx('font-display text-3xl font-extrabold tabular-nums', tone === 'leaf' ? 'text-leaf' : 'text-amber-ink')}>{value}</div>
      <div className="mt-0.5 text-sm text-muted">{label}</div>
    </div>
  )
}

/** One horizontal bar per retriever, so the hybrid's advantage is visible at a glance. */
function RetrievalBars({ rows }: { rows: { mode: string; hit_at_5: number; mrr: number; median_latency_ms: number }[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.mode}>
          <div className="mb-1 flex justify-between text-sm">
            <span className={cx('font-semibold', r.mode === 'hybrid' ? 'text-leaf' : 'text-ink')}>{r.mode === 'hybrid' ? 'Hybrid (BM25 + LSA + exact, RRF)' : r.mode.toUpperCase()}</span>
            <span className="tabular-nums text-muted">
              MRR {r.mrr.toFixed(3)} · Hit@5 {r.hit_at_5.toFixed(2)} · {r.median_latency_ms.toFixed(1)} ms
            </span>
          </div>
          <div className="h-3 rounded-full bg-surface-2">
            <div className={cx('h-full rounded-full', r.mode === 'hybrid' ? 'bg-leaf' : 'bg-muted/50')} style={{ width: `${r.mrr * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function YieldSection({ y }: { y: YieldEval }) {
  const o = y.overall
  const crops = Object.entries(y.per_crop).sort((a, b) => a[1].model_median_error_pct - b[1].model_median_error_pct)
  return (
    <Card>
      <div id="yield" className="scroll-mt-24" />
      <SectionTitle aside={<Chip>{o.rows.toLocaleString('en-IN')} district-seasons</Chip>}>Yield forecast</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat value={`${o.model_median_error_pct}%`} label="Typical error (median)" />
        <Stat value={`${o.baseline_last_year_median_error_pct}%`} label="Last season as the guess" tone="amber" />
        <Stat value={`${o.baseline_5yr_mean_median_error_pct}%`} label="5-year average as the guess" tone="amber" />
        <Stat value={`${Math.round(o.range_coverage_p10_p90 * 100)}%`} label="Real yield inside the range (aim 80%)" />
      </div>
      <p className="mt-3 text-sm text-muted">
        {y.split} {y.selection} {y.model}
      </p>
      <div className="mt-3">
        <Note tone="warn">
          Honest reading: the model beats both simple guesses overall, but only just beats last season&apos;s yield (by {(o.baseline_last_year_median_error_pct - o.model_median_error_pct).toFixed(1)} points).
          For some crops last season alone is still better — shown in amber below.
        </Note>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 pr-2 font-semibold">Crop</th>
              <th className="py-2 pr-2 text-right font-semibold">Seasons tested</th>
              <th className="py-2 pr-2 text-right font-semibold">Model</th>
              <th className="py-2 pr-2 text-right font-semibold">Last season</th>
              <th className="py-2 text-right font-semibold">5-yr avg</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {crops.map(([crop, r]) => {
              const loses = r.model_median_error_pct > r.baseline_last_year_median_error_pct
              return (
                <tr key={crop} className="border-b border-line/60">
                  <td className="py-1.5 pr-2 capitalize">{crop}</td>
                  <td className="py-1.5 pr-2 text-right">{r.rows.toLocaleString('en-IN')}</td>
                  <td className={cx('py-1.5 pr-2 text-right font-semibold', loses && 'text-amber-ink')}>{r.model_median_error_pct}%</td>
                  <td className="py-1.5 pr-2 text-right">{r.baseline_last_year_median_error_pct}%</td>
                  <td className="py-1.5 text-right">{r.baseline_5yr_mean_median_error_pct}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
        {y.limits.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        {y.data.attribution} Seasons {y.data.seasons}.{' '}
        <a href={y.data.catalog_url} target="_blank" rel="noopener noreferrer">
          Dataset
        </a>
      </p>
    </Card>
  )
}

export default function Evaluation() {
  const [data, setData] = useState<EvalData | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api
      .evaluation()
      .then(setData)
      .catch(() => setError('Could not load the measured results just now.'))
  }, [])

  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const a = data.assistant
  const d = data.doctor
  const hybrid = a?.retrieval.find((r) => r.mode === 'hybrid')

  return (
    <div className="space-y-5">
      <PageTitle title="How well it works" subtitle="Measured, not claimed. Every number below is regenerated by running the evaluation scripts in the repository." />

      {a && hybrid && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={`${Math.round(hybrid.hit_at_5 * 100)}%`} label="Right source in the top 5" />
            <Stat value={hybrid.mrr.toFixed(3)} label="MRR — how high it ranks" />
            <Stat value={`${a.guardrails.attacks_blocked}/${a.guardrails.attacks}`} label="Injection attacks blocked" />
            <Stat value={String(a.guardrails.false_positives)} label={`Real questions wrongly blocked (of ${a.guardrails.real_questions})`} />
          </div>

          <Card>
            <SectionTitle aside={<Chip>{a.questions} questions</Chip>}>Retrieval, three ways</SectionTitle>
            <RetrievalBars rows={a.retrieval} />
            <p className="mt-3 text-xs text-muted">The same hand-labelled questions through each retriever. Measured on {a.items} gold items · {a.generated_at}.</p>
          </Card>

          <Card>
            <SectionTitle>Answer quality</SectionTitle>
            {a.answers ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Stat value={pct(a.answers.faithfulness)} label="Answers faithful to their sources" />
                  <Stat value={pct(a.answers.citation_accuracy)} label="Correctly cited" />
                </div>
                <p className="mt-3 text-sm text-muted">
                  Judged by {a.answers.model} on {a.answers.judged} questions
                  {a.answers.repeats ? `, asked ${a.answers.repeats} times each` : ''}
                  {a.answers.faithfulness_range ? ` (faithfulness ranged ${pct(a.answers.faithfulness_range[0])}–${pct(a.answers.faithfulness_range[1])})` : ''}. The first judged run scored 60%: half was the
                  judge seeing less than the assistant had, half was a real unit bug, now fixed and pinned by a test.
                </p>
              </>
            ) : (
              <p className="text-muted">Not measured: no language-model key was configured when the evaluation last ran.</p>
            )}
          </Card>
        </>
      )}

      <Card>
        <SectionTitle>Crop Doctor — photo diagnosis</SectionTitle>
        {d ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat value={pct(d.summary.top1_accuracy)} label={`Top-1 accuracy (${d.summary.leaf_photos} leaves)`} />
              <Stat value={d.summary.nonplant_refused} label="Non-plant photos refused" />
              <Stat value={d.summary.injections_resisted} label="Written attacks resisted" />
              <Stat value={d.summary.out_of_scope_escalated ?? '—'} label="Uncovered disease escalated" tone="amber" />
            </div>
            <p className="mt-3 text-sm text-muted">
              {d.summary.photos} labelled photos · {d.vision_model} · {d.summary.p50_latency_ms} ms median · ${d.summary.cost_per_check_usd} per check · {d.generated_at}
            </p>
            <div className="mt-3">
              <Note tone="warn">
                Known failure, published: both grape black-rot photos (a disease the knowledge base does not cover) were called downy mildew instead of being sent to an expert. That advice names no spray and
                points to a KVK. Test photos are clean lab images, so field accuracy will be lower.
              </Note>
            </div>
          </>
        ) : (
          <p className="text-muted">Not measured yet: the vision model needs an API key. Every safety path is covered by automated tests that run without one.</p>
        )}
      </Card>

      {data?.yield && <YieldSection y={data.yield} />}

      <p className="text-sm text-muted">
        Reproduce with <code>make eval</code>, <code>make eval-doctor</code> and <code>make train-yield</code>. Full write-up: docs/EVAL.md in the{' '}
        <a href="https://github.com/jiyasiwach/cropwise" target="_blank" rel="noopener noreferrer">
          source code
        </a>
        .
      </p>
    </div>
  )
}
