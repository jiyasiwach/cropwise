import { lazy, Suspense, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Camera, IndianRupee, Leaf, LineChart, MapPin, Phone, Sprout, Store, Trophy } from 'lucide-react'
import { api, ApiError, type BestMarket, type Mandi, type Plan, type Profit, type Stores } from '../lib/api'
import { usePrefs } from '../lib/prefs'
import { CompareBars, MoneyBar, SeasonTimeline, Sparkline } from '../components/charts'
import { Button, ButtonLink, Card, Chip, CropIcon, cropName, cx, ErrorBox, HelplineButton, HonestyBadge, ListenButton, Loading, Note, PageTitle, rupee, SectionTitle, SourceChip, inputCls } from '../components/ui'
import { ArtPlan } from '../components/art'

const ShopsMap = lazy(() => import('../components/ShopsMap'))

const TABS = [
  { id: 'when', label: 'When', icon: CalendarDays },
  { id: 'fertiliser', label: 'Fertiliser', icon: Sprout },
  { id: 'shops', label: 'Shops', icon: Store },
  { id: 'prices', label: 'Prices', icon: LineChart },
  { id: 'market', label: 'Best mandi', icon: Trophy },
  { id: 'profit', label: 'Profit', icon: IndianRupee },
] as const
type Tab = (typeof TABS)[number]['id']

/** Loads once per key; keeps error and retry together. */
function useLoad<T>(key: string | null, fn: () => Promise<T>) {
  const [state, setState] = useState<{ key: string | null; data?: T; error?: string }>({ key: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!key) return
    let live = true
    setState({ key })
    fn()
      .then((data) => live && setState({ key, data }))
      .catch((e) => live && setState({ key, error: e instanceof ApiError ? e.message : 'Could not load this just now.' }))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])
  return { ...state, loading: Boolean(key) && !state.data && !state.error, retry: () => setAttempt((a) => a + 1) }
}

function PlaceGate({ children }: { children: ReactNode }) {
  const { place, setPlace } = usePrefs()
  const [town, setTown] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (place?.state) return <>{children}</>
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setPlace(await api.place(town.trim()))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not find that town.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <MapPin className="size-5 text-leaf" aria-hidden /> Which town is your farm near?
        </span>
      </SectionTitle>
      <p className="mb-3 text-sm text-muted">Shops, mandi prices and transport costs depend on where you are.</p>
      <form onSubmit={submit} className="flex gap-2">
        <input value={town} onChange={(e) => setTown(e.target.value)} placeholder="Town or village" className={cx(inputCls, 'min-w-0 flex-1')} aria-label="Town or village" />
        <Button type="submit" busy={busy} disabled={!town.trim()}>
          Set
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Card>
  )
}

function WhenTab({ plan }: { plan: Plan }) {
  const tl = plan.timeline
  const speech = `${cropName(tl.crop)} is a ${tl.season} crop. Sow between ${tl.sow_from} and ${tl.sow_by}. Harvest around ${tl.expected_harvest}, about ${tl.duration_days} days after sowing.`
  return (
    <Card>
      <SectionTitle aside={<ListenButton id="when" text={speech} />}>Sow → grow → harvest</SectionTitle>
      <SeasonTimeline sowFrom={tl.sow_from} sowBy={tl.sow_by} harvest={tl.expected_harvest} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip>{tl.season} season</Chip>
        <Chip>{tl.duration_days} days to harvest</Chip>
        <Chip>Water need: {tl.water_need}</Chip>
      </div>
      {tl.note && <p className="mt-3 text-sm">{tl.note}</p>}
      <div className="mt-3">
        <SourceChip source={tl.source} />
      </div>
    </Card>
  )
}

function FertiliserTab({ plan }: { plan: Plan }) {
  const f = plan.fertiliser
  const items = [
    { key: 'urea', label: 'Urea', note: '46% nitrogen' },
    { key: 'dap', label: 'DAP', note: '18% N · 46% P₂O₅' },
    { key: 'mop', label: 'MOP (potash)', note: '60% K₂O' },
  ] as const
  const speech = `For ${f.acres} acres buy ${items.map((i) => `${f.buy[i.key].bags_50kg} bags of ${i.label}`).join(', ')}. ${f.how_to_apply.join(' ')}`
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle aside={<ListenButton id="fert" text={speech} />}>What to buy for {f.acres} acre{f.acres === 1 ? '' : 's'}</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {items.map((i) => (
            <div key={i.key} className="rounded-2xl bg-surface-2 p-3 text-center">
              <div className="text-sm font-semibold">{i.label}</div>
              <div className="font-display text-3xl font-extrabold text-leaf tabular-nums">{f.buy[i.key].bags_50kg}</div>
              <div className="text-xs text-muted">bags of 50 kg</div>
              <div className="mt-1 text-xs text-muted tabular-nums">{f.buy[i.key].kg} kg</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Recommended dose per hectare: N {f.requirement_kg_per_ha.N} · P₂O₅ {f.requirement_kg_per_ha.P2O5} · K₂O {f.requirement_kg_per_ha.K2O} kg
        </p>
      </Card>
      <Card>
        <SectionTitle>How to apply</SectionTitle>
        <ol className="list-decimal space-y-1.5 pl-5">
          {f.how_to_apply.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {f.organic_option && (
          <p className="mt-3 flex gap-2 rounded-2xl bg-leaf-soft p-3 text-sm">
            <Leaf className="mt-0.5 size-4 shrink-0 text-leaf" aria-hidden />
            <span>Organic option: about {f.organic_option.farmyard_manure_tonnes} t farmyard manure or {f.organic_option.vermicompost_tonnes} t vermicompost. {f.organic_option.note}</span>
          </p>
        )}
      </Card>
      <Note tone="warn">
        {f.assumptions.join(' ')} Confirm doses with your Krishi Vigyan Kendra before buying.
      </Note>
    </div>
  )
}

function ShopsTab() {
  const { place } = usePrefs()
  const { data, error, loading, retry } = useLoad<Stores>(place ? `${place.latitude},${place.longitude}` : null, () => api.stores(place!.latitude, place!.longitude))
  if (loading) return <Loading label="Finding shops on OpenStreetMap…" />
  if (error) return <ErrorBox message={error} onRetry={retry} />
  if (!data || !place) return null
  return (
    <div className="space-y-4">
      <Suspense fallback={<Loading label="Loading map…" />}>
        <ShopsMap lat={place.latitude} lon={place.longitude} stores={data.stores} />
      </Suspense>
      {data.error && <Note tone="warn">OpenStreetMap did not answer in time ({data.error.replace('Could not reach OpenStreetMap: ', '')}). Try again in a minute.</Note>}
      {data.stores.length === 0 && !data.error && <Note>{data.note}</Note>}
      <div className="space-y-2.5">
        {data.stores.slice(0, 12).map((s) => (
          <Card key={`${s.name}-${s.latitude}`} as="div" className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="truncate font-semibold">{s.name}</div>
              <div className="text-sm text-muted">
                {s.distance_km.toFixed(1)} km{s.kind ? ` · ${s.kind}` : ''}
                {s.address ? ` · ${s.address}` : ''}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {s.phone && (
                <a href={`tel:${s.phone}`} className="grid size-10 place-items-center rounded-xl border border-line" aria-label={`Call ${s.name}`}>
                  <Phone className="size-4" aria-hidden />
                </a>
              )}
              {s.directions_url && (
                <a href={s.directions_url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-line px-3 py-2 text-sm font-semibold no-underline">
                  Directions
                </a>
              )}
            </div>
          </Card>
        ))}
      </div>
      <SourceChip source={data.source} />
    </div>
  )
}

function PricesTab({ crop }: { crop: string }) {
  const { place } = usePrefs()
  const { data, error, loading, retry } = useLoad<Mandi>(place?.state ? `${crop}-${place.state}` : null, () =>
    api.mandi(crop, place!.state!, place!.latitude, place!.longitude),
  )
  if (loading) return <Loading label="Fetching mandi prices…" />
  if (error) return <ErrorBox message={error} onRetry={retry} />
  if (!data) return null
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle aside={data.is_mock ? <HonestyBadge kind="sample" /> : <Chip tone="good">Live · {data.last_updated}</Chip>}>
          {cropName(crop)} in {data.state} — last 30 days
        </SectionTitle>
        <Sparkline points={data.trend.map((p) => ({ date: p.date, value: p.modal_price }))} />
        <p className="mt-1 text-xs text-muted">Modal price, {data.unit}</p>
      </Card>
      <Card>
        <SectionTitle>Mandis</SectionTitle>
        <ul className="divide-y divide-line">
          {data.markets.map((m) => (
            <li key={m.market} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate font-semibold">{m.market}</div>
                <div className="text-xs text-muted">
                  {m.district} · {m.price_date}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold tabular-nums">{rupee(m.modal_price)}</div>
                <div className="text-xs text-muted tabular-nums">
                  {rupee(m.min_price)}–{rupee(m.max_price)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {data.is_mock && <Note tone="warn">{data.source}</Note>}
      {!data.is_mock && <SourceChip source={data.source} />}
    </div>
  )
}

function MarketTab({ crop }: { crop: string }) {
  const { place, acres } = usePrefs()
  const plan = useLoad<Profit>(place?.state ? `${crop}-${place.state}-${acres}` : null, () => api.profit(crop, place!.state!, acres))
  const quintals = plan.data?.yield_quintals ?? 10
  const { data, error, loading, retry } = useLoad<BestMarket>(place?.state && plan.data ? `${crop}-${place.latitude}-${quintals}` : null, () =>
    api.bestMarket(crop, place!.state!, place!.latitude, place!.longitude, quintals),
  )
  if (plan.loading || loading) return <Loading label="Ranking mandis by what you keep…" />
  if (error || plan.error) return <ErrorBox message={(error ?? plan.error)!} onRetry={retry} />
  if (!data || !data.best.length) return <Note>No priced mandis found for this crop nearby.</Note>
  const best = data.best[0]
  const near = data.nearest
  const gain = best.gain_vs_nearest_total ?? 0
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle aside={data.is_mock ? <HonestyBadge kind="sample" /> : <HonestyBadge kind="estimate" />}>Where you keep the most</SectionTitle>
        {near && (
          <CompareBars
            rows={[
              { label: `Nearest: ${near.market} · ${near.distance_km?.toFixed(0)} km`, value: near.net_price_per_quintal ?? 0 },
              { label: `Best: ${best.market} · ${best.distance_km?.toFixed(0)} km`, value: best.net_price_per_quintal ?? 0, highlight: true },
            ]}
          />
        )}
        <div className="mt-4 rounded-2xl bg-leaf-soft p-4">
          {gain > 0 ? (
            <>
              <div className="font-display text-3xl font-extrabold text-leaf">+{rupee(gain)}</div>
              <div className="text-sm">
                more on about {quintals} quintals ({acres} acre{acres === 1 ? '' : 's'}) after paying for transport
              </div>
            </>
          ) : (
            <div className="font-semibold">Your nearest mandi is already the best after transport.</div>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">Net price per quintal = modal price − transport. {data.method}</p>
      </Card>
      <Card>
        <SectionTitle>All ranked mandis</SectionTitle>
        <ul className="divide-y divide-line text-sm">
          {data.best.map((m, i) => (
            <li key={m.market} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0 truncate">
                {i + 1}. {m.market} <span className="text-muted">· {m.distance_km?.toFixed(0)} km</span>
              </span>
              <span className="font-semibold tabular-nums">{rupee(m.net_price_per_quintal ?? 0)}/q</span>
            </li>
          ))}
        </ul>
      </Card>
      {data.is_mock && <Note tone="warn">{data.source}</Note>}
    </div>
  )
}

function ProfitTab({ crop }: { crop: string }) {
  const { place, acres } = usePrefs()
  const { data, error, loading, retry } = useLoad<Profit>(place?.state ? `${crop}-${place.state}-${acres}` : null, () => api.profit(crop, place!.state!, acres))
  if (loading) return <Loading label="Working out the money…" />
  if (error) return <ErrorBox message={error} onRetry={retry} />
  if (!data) return null
  const speech = `On ${data.acres} acres: income about ${data.revenue} rupees, costs ${data.costs.total}, profit ${data.profit}. This is an estimate.`
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle aside={<span className="flex gap-1.5">{data.is_mock_price && <HonestyBadge kind="sample" />}<HonestyBadge kind="estimate" /></span>}>
          What {data.acres} acre{data.acres === 1 ? '' : 's'} might earn
        </SectionTitle>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-leaf-soft p-3">
            <div className="text-xs text-muted">Profit</div>
            <div className={cx('font-display text-2xl font-extrabold tabular-nums', data.profit >= 0 ? 'text-leaf' : 'text-danger')}>{rupee(data.profit)}</div>
          </div>
          <div className="rounded-2xl bg-surface-2 p-3">
            <div className="text-xs text-muted">Per acre</div>
            <div className="font-display text-2xl font-extrabold tabular-nums">{rupee(data.profit_per_acre)}</div>
          </div>
        </div>
        <MoneyBar
          revenue={data.revenue}
          costs={[
            { label: 'Labour', value: data.costs.labour },
            { label: 'Other', value: data.costs.other },
            { label: 'Fertiliser', value: data.costs.fertiliser },
            { label: 'Seed', value: data.costs.seed },
          ]}
        />
        <p className="mt-3 text-sm text-muted">
          {data.yield_quintals} quintals at {rupee(data.price_per_quintal)}/quintal
        </p>
        <div className="mt-3">
          <ListenButton id="profit" text={speech} />
        </div>
      </Card>
      <Note tone="warn">{data.assumptions.join(' ')}</Note>
      {data.is_mock_price && <p className="text-xs text-muted">{data.price_source}</p>}
    </div>
  )
}

export default function PlanPage() {
  const { crop = 'rice' } = useParams()
  const { acres } = usePrefs()
  const [tab, setTab] = useState<Tab>('when')
  const { data: plan, error, loading, retry } = useLoad<Plan>(`${crop}-${acres}`, () => api.plan(crop, acres))

  return (
    <div className="space-y-5">
      <Link to="/results" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted no-underline hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All crops
      </Link>
      <PageTitle art={<ArtPlan />} tone="sky" eyebrow="Season plan" title={`${cropName(crop)} plan`} subtitle="When to sow, what to buy, where to sell and what you could earn — for your land.">
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface/80 py-1 pl-1 pr-3 text-sm font-semibold text-ink">
            <CropIcon crop={crop} size="sm" /> {cropName(crop)}
          </span>
          <ButtonLink to={`/doctor?crop=${crop}`} variant="secondary" className="min-h-9 py-1.5 text-sm">
            <Camera className="size-4" aria-hidden /> Check a sick plant
          </ButtonLink>
        </div>
      </PageTitle>

      {loading && <Loading />}
      {error && (error.includes('No sowing calendar') || error.includes('Unknown') ? <Note tone="warn">There is no sowing calendar for “{crop}” yet. <Link to="/results">Pick another crop</Link>.</Note> : <ErrorBox message={error} onRetry={retry} />)}

      {plan && (
        <>
          <Note tone="warn">These dates and doses are the commonly published all-India figures, not advice for your field. Confirm with your Krishi Vigyan Kendra before buying inputs.</Note>
          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Plan sections">
            <div className="flex w-max gap-1 rounded-2xl border border-line bg-surface p-1 shadow-card">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cx(
                    'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition',
                    tab === id ? 'bg-leaf text-on-leaf shadow-sm' : 'text-muted hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  <Icon className="size-4" aria-hidden /> {label}
                </button>
              ))}
            </div>
          </div>
          <div role="tabpanel">
            {tab === 'when' && <WhenTab plan={plan} />}
            {tab === 'fertiliser' && <FertiliserTab plan={plan} />}
            {tab === 'shops' && (
              <PlaceGate>
                <ShopsTab />
              </PlaceGate>
            )}
            {tab === 'prices' && (
              <PlaceGate>
                <PricesTab crop={crop} />
              </PlaceGate>
            )}
            {tab === 'market' && (
              <PlaceGate>
                <MarketTab crop={crop} />
              </PlaceGate>
            )}
            {tab === 'profit' && (
              <PlaceGate>
                <ProfitTab crop={crop} />
              </PlaceGate>
            )}
          </div>
          <HelplineButton />
        </>
      )}
    </div>
  )
}
