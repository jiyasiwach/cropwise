import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api, ApiError, type MandiGain } from '../lib/api'
import { usePrefs } from '../lib/prefs'
import { CompareBars } from '../components/charts'
import { Button, Card, Chip, CROP_ICONS, cropName, ErrorBox, HonestyBadge, Note, PageTitle, rupee, SectionTitle } from '../components/ui'

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
)

const FACTS = [
  {
    big: 'Once in 3 years',
    title: 'Choosing a crop the soil suits',
    body: 'A Soil Health Card is a printed lab report, issued once every three years per holding. Over 25 crore have been distributed. Between cards, the choice of crop rests on habit and memory.',
    source: <A href="https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/aug/doc2025816613501.pdf">PIB factsheet, Aug 2025</A>,
  },
  {
    big: '8.2 : 3.2 : 1',
    title: 'Fertiliser by guesswork',
    body: "India's nitrogen : phosphorus : potassium use in 2012-13, against the officially recommended 4 : 2 : 1 — heavily skewed to nitrogen (urea). The same paper argues the norm itself needs updating, which is why CropWise works from the crop's own dose, not the ratio.",
    source: (
      <>
        Chand &amp; Pavithra, EPW 2015, <A href="https://niti.gov.in/sites/default/files/2023-02/4_EPW_Article_Fertiliser_Use_and_Imbalance_in_India.pdf">hosted by NITI Aayog</A>
      </>
    ),
  },
  {
    big: 'Not measured',
    title: 'Selling at the nearest mandi',
    body: 'The highest headline price is not the money a farmer keeps once the lorry is paid. We did not find a national figure we could verify for how much this costs farmers, so we quote none — work it out for one farm with the calculator below.',
    source: <Chip tone="warn">no public figure found</Chip>,
  },
  {
    big: '43.6%',
    title: 'Advice in the wrong language',
    body: 'Hindi is the mother tongue of 43.6% of Indians — the largest single language, and still less than half. Advice written only in Hindi or English misses most farmers.',
    source: (
      <>
        Census of India 2011, Paper 1 of 2018 (Language), Statement 4 —{' '}
        <A href="https://cdn.downtoearth.org.in/library/0.58521300_1530794876_census-of-india-2011.pdf">copy hosted by Down To Earth</A> (the census site's original link has moved).
      </>
    ),
  },
]

function Calculator() {
  const { place, acres: savedAcres } = usePrefs()
  const [crop, setCrop] = useState('rice')
  const [acres, setAcres] = useState(String(savedAcres || 2))
  const [town, setTown] = useState(place?.city ?? 'Hyderabad')
  const [result, setResult] = useState<MandiGain | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await api.mandiGain(crop, Number(acres), town.trim())
      if (!r.nearest || !r.best) throw new ApiError(404, `No priced mandis found for this crop near ${r.town || town}.`)
      setResult(r)
    } catch (err) {
      setResult(null)
      setError(err instanceof ApiError ? err.message : 'Please check the crop, acres and town.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <span id="calculator" className="relative -top-20 block" />
      <SectionTitle aside={<HonestyBadge kind="estimate" />}>What a better mandi is worth on your farm</SectionTitle>
      <p className="mb-4 text-sm text-muted">Typical yield for your acres × (best net price − nearest mandi's net price). An estimate, not a promise.</p>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4 sm:items-end">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Crop</span>
          <select value={crop} onChange={(e) => setCrop(e.target.value)} className="h-12 w-full rounded-xl border border-line bg-surface px-3">
            {Object.keys(CROP_ICONS)
              .sort()
              .map((c) => (
                <option key={c} value={c}>
                  {CROP_ICONS[c]} {cropName(c)}
                </option>
              ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Acres</span>
          <input type="number" min={0.1} max={1000} step={0.1} inputMode="decimal" value={acres} onChange={(e) => setAcres(e.target.value)} className="h-12 w-full rounded-xl border border-line bg-surface px-3" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Town</span>
          <input value={town} onChange={(e) => setTown(e.target.value)} className="h-12 w-full rounded-xl border border-line bg-surface px-3" />
        </label>
        <Button type="submit" busy={busy} className="h-12">
          Work it out
        </Button>
      </form>
      {error && (
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
      )}
      {result?.nearest && result.best && (
        <div className="mt-5 space-y-4" aria-live="polite">
          <CompareBars
            rows={[
              { label: `Nearest: ${result.nearest.market} · ${result.nearest.distance_km} km`, value: result.nearest.net_per_quintal },
              { label: `Best after transport: ${result.best.market} · ${result.best.distance_km} km`, value: result.best.net_per_quintal, highlight: true },
            ]}
          />
          <div className="rounded-2xl bg-leaf-soft p-4">
            {(result.gain_total ?? 0) > 0 ? (
              <>
                <div className="font-display text-3xl font-extrabold text-leaf">+{rupee(result.gain_total ?? 0)}</div>
                <div className="text-sm">
                  more on about {result.yield_quintals} quintals of {cropName(result.crop)} from {result.acres} acres near {result.town}, {result.state} — an estimate.
                </div>
              </>
            ) : (
              <div className="font-semibold">Your nearest mandi is already the best after transport.</div>
            )}
          </div>
          {result.is_mock && <Note tone="warn">Sample prices: {result.source} The sum is real; the prices are not yet.</Note>}
          <p className="text-xs text-muted">
            How: {result.method} {result.assumptions.join(' ')}
          </p>
        </div>
      )}
    </Card>
  )
}

export default function Impact() {
  const { hash } = useLocation()
  useEffect(() => {
    if (hash === '#calculator') setTimeout(() => document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' }), 150)
  }, [hash])

  return (
    <div className="space-y-5">
      <PageTitle
        title="The problem CropWise works on"
        subtitle="Four decisions a small farmer makes every season, usually without data. Every figure below links to its public source; where we could not find one we could check, we say so."
      />

      <Card>
        <SectionTitle>Who it is for</SectionTitle>
        <p>
          <strong>About 86% of India's farm holdings are small or marginal</strong> (under 2 hectares), and the average holding is <strong>1.08 hectares</strong>, down from 1.15 in 2010-11. On a farm that size one wrong
          crop, one extra bag of urea or one bad sale is a large share of the year's income.
        </p>
        <p className="mt-2 text-sm text-muted">
          Sources: Agriculture Census 2015-16, as cited by the Ministry of Agriculture in <A href="https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=1906888">PIB, Lok Sabha reply</A> and{' '}
          <A href="https://www.pib.gov.in/PressReleasePage.aspx?PRID=2246182">PIB, 27 Mar 2026</A>. 2015-16 is the latest census with published all-India results.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {FACTS.map((f) => (
          <Card key={f.title} as="article">
            <div className="font-display text-3xl font-extrabold text-leaf">{f.big}</div>
            <h3 className="mt-1 text-lg font-bold">{f.title}</h3>
            <p className="mt-1.5 text-[15px]">{f.body}</p>
            <div className="mt-3 text-sm text-muted">{f.source}</div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionTitle>How CropWise answers each</SectionTitle>
        <ul className="space-y-2.5">
          <li>
            <strong>Crop:</strong> soil estimated for any town from ISRIC SoilGrids plus live weather → three crops, each with the reasons behind it. <Link to="/grow">Get a crop plan</Link>
          </li>
          <li>
            <strong>Fertiliser:</strong> the crop's recommended dose turned into bags of urea, DAP and MOP for your acres, with nearby shops from OpenStreetMap. <Link to="/plan/rice">See a sample plan</Link>
          </li>
          <li>
            <strong>Mandi:</strong> markets ranked by what you keep after transport, not by headline price. <a href="#calculator">Try the calculator</a>
          </li>
          <li>
            <strong>Language:</strong> KrishiMitra answers in six languages, by voice or text, with the source of every answer shown. <Link to="/ask">Ask KrishiMitra</Link>
          </li>
          <li>
            <strong>Trust:</strong> accuracy, retrieval and guardrail results are measured and published. <Link to="/eval">How well it works</Link>
          </li>
        </ul>
      </Card>

      <Calculator />

      <Card className="border-amber/40 bg-amber-soft">
        <SectionTitle>What it does not do yet</SectionTitle>
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-amber-ink">
          <li>
            It is a working prototype. It has <strong>not been field-tested with farmers</strong>, and it has no user numbers to report.
          </li>
          <li>The crop model is trained on a public Kaggle teaching dataset, not on Indian field trials.</li>
          <li>Soil comes from SoilGrids, a ~250 m satellite-and-model estimate. A Soil Health Card is more accurate, and CropWise uses one when you enter it.</li>
          <li>Mandi prices are placeholders, clearly labelled, until a data.gov.in key is configured.</li>
          <li>
            For anything that matters — pests, disease, a costly input — confirm with your Krishi Vigyan Kendra or the Kisan Call Centre, <a href="tel:18001801551">1800-180-1551</a>.
          </li>
        </ul>
      </Card>
    </div>
  )
}
