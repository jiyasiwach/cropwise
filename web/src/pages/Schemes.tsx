import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeIndianRupee, ChevronDown, ExternalLink, FileCheck2, Landmark, MapPin, MessageCircle, Newspaper, Phone } from 'lucide-react'
import { api, type Scheme, type SchemeUpdates, type Schemes as SchemesData } from '../lib/api'
import { usePrefs } from '../lib/prefs'
import { Card, Chip, ErrorBox, ListenButton, Note, PageTitle, Skeleton, cx } from '../components/ui'

type Tab = 'central' | 'state' | 'updates'

function domain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function SchemeCard({ scheme }: { scheme: Scheme }) {
  const [open, setOpen] = useState(false)
  const speech = `${scheme.name}. ${scheme.what_you_get} Who can apply: ${scheme.who_can_apply.join('. ')}`
  const paused = scheme.status && scheme.status !== 'active'
  return (
    <article className={cx('overflow-hidden rounded-[var(--radius-card)] border bg-surface shadow-card transition', open ? 'border-leaf/40' : 'border-line')}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3.5 p-4 text-left sm:p-5">
        <span className="hidden size-11 shrink-0 place-items-center rounded-xl bg-leaf-soft text-leaf sm:grid">
          <BadgeIndianRupee className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-[1.05rem] font-bold leading-snug text-ink">{scheme.name}</span>
              {scheme.hindi_name && <span className="mt-0.5 block text-sm text-muted">{scheme.hindi_name}</span>}
            </span>
            <span className={cx('grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted transition', open && 'rotate-180 bg-leaf-soft text-leaf')}>
              <ChevronDown className="size-4" aria-hidden />
            </span>
          </span>
          {paused && (
            <span className="mt-2 inline-block">
              <Chip tone="warn">Check status with your state</Chip>
            </span>
          )}
          <span className={cx('mt-2 block text-[15px] leading-relaxed text-ink/90', !open && 'line-clamp-3')}>{scheme.what_you_get}</span>
          {!open && <span className="mt-1.5 block text-sm font-semibold text-leaf">Who can apply &amp; how →</span>}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-line bg-surface-2/40 px-4 pb-5 pt-4 sm:px-5 sm:pl-[4.6rem]">
          {paused && <Note tone="warn">{scheme.verification_note || 'This scheme’s period may have ended. Confirm before applying.'}</Note>}
          {scheme.latest_update && (
            <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
              <span className="font-semibold text-leaf">Latest · </span>
              {scheme.latest_update}
            </div>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Who can apply</h3>
              <ul className="space-y-1.5 text-[15px]">
                {scheme.who_can_apply.map((w) => (
                  <li key={w} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-leaf" aria-hidden />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">How to apply</h3>
              <ol className="space-y-2 text-[15px]">
                {scheme.how_to_apply.map((w, i) => (
                  <li key={w} className="flex gap-2.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-leaf-soft text-xs font-bold text-leaf">{i + 1}</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          {scheme.documents.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                <FileCheck2 className="size-3.5" aria-hidden /> Keep ready
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {scheme.documents.map((d) => (
                  <Chip key={d}>{d}</Chip>
                ))}
              </div>
            </section>
          )}
          {scheme.helpline && (
            <p className="flex items-start gap-2 text-sm">
              <Phone className="mt-0.5 size-4 shrink-0 text-leaf" aria-hidden /> <span>{scheme.helpline}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={scheme.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-leaf px-4 text-sm font-semibold text-on-leaf no-underline hover:brightness-110"
            >
              Apply on {domain(scheme.official_url)} <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <Link
              to={`/ask?q=${encodeURIComponent(`Am I eligible for ${scheme.name} and how do I apply?`)}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink no-underline hover:bg-surface-2"
            >
              <MessageCircle className="size-4" aria-hidden /> Ask KrishiMitra
            </Link>
            <ListenButton id={`scheme-${scheme.key}`} text={speech} />
          </div>
          <p className="text-xs text-muted">
            Checked against{' '}
            <a href={scheme.source_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {scheme.source_title || domain(scheme.source_url)}
            </a>{' '}
            · {scheme.as_of}
          </p>
        </div>
      )}
    </article>
  )
}

function Updates() {
  const [data, setData] = useState<SchemeUpdates | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api
      .schemeUpdates()
      .then(setData)
      .catch(() => setError('Could not load the latest updates just now.'))
  }, [])
  if (error) return <ErrorBox message={error} />
  if (!data)
    return (
      <Card>
        <div className="space-y-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      </Card>
    )
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Newspaper className="size-5 text-leaf" aria-hidden /> Latest announcements
        </h2>
        {data.source && !data.error && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-leaf">
            <span className="size-2 animate-pulse rounded-full bg-leaf" aria-hidden /> Live
          </span>
        )}
      </div>
      {data.error && (
        <div className="mb-3">
          <Note tone="warn">{data.error}</Note>
        </div>
      )}
      {data.items.length === 0 ? (
        <p className="text-muted">No announcements to show right now.</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.items.map((item) => (
            <li key={item.link}>
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="group flex gap-3 py-3 no-underline">
                {item.date && (
                  <span className="w-12 shrink-0 text-center">
                    <span className="block font-display text-lg font-extrabold leading-none text-ink">{new Date(item.date).getDate()}</span>
                    <span className="text-[11px] uppercase text-muted">{new Date(item.date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug text-ink group-hover:text-leaf group-hover:underline">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-muted">{domain(item.link)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {data.source && <p className="mt-2 text-xs text-muted">Source: {data.source}. Checked at most once an hour.</p>}
    </Card>
  )
}

export default function Schemes() {
  const { place, t } = usePrefs()
  const [tab, setTab] = useState<Tab>('central')
  const [data, setData] = useState<SchemesData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    api
      .schemes(place?.state)
      .then(setData)
      .catch(() => setError('Could not load schemes just now.'))
  }, [place?.state])

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'central', label: 'Central', count: data?.central.length },
    { id: 'state', label: 'My state', count: place?.state ? data?.state.length : undefined },
    { id: 'updates', label: 'Latest news' },
  ]

  return (
    <div className="space-y-5">
      <PageTitle title={t('tile.schemes')} subtitle="Government schemes for farmers — what you get, who can apply and how. Each one is checked against its official page, with the date." />

      <Note tone="warn">Apply only on official .gov.in websites, at a CSC or at your bank. No government scheme asks you to pay an agent or share your OTP.</Note>

      <div role="tablist" aria-label="Scheme sections" className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface p-1">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tab === tb.id}
            onClick={() => setTab(tb.id)}
            className={cx(
              'flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold transition',
              tab === tb.id ? 'bg-leaf text-on-leaf shadow-sm' : 'text-muted hover:bg-surface-2 hover:text-ink',
            )}
          >
            <span className="truncate">{tb.label}</span>
            {tb.count != null && (
              <span className={cx('rounded-full px-1.5 text-xs tabular-nums', tab === tb.id ? 'bg-white/20' : 'bg-surface-2')}>{tb.count}</span>
            )}
          </button>
        ))}
      </div>

      {error && <ErrorBox message={error} />}
      {tab !== 'updates' && !data && !error && (
        <div className="space-y-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}

      {tab === 'central' && data && (
        <div className="space-y-3">
          {data.central.map((s) => (
            <SchemeCard key={s.key} scheme={s} />
          ))}
          {data.central.length === 0 && <p className="text-muted">No verified schemes are loaded yet.</p>}
        </div>
      )}

      {tab === 'state' && data && (
        <div className="space-y-3">
          {!place?.state ? (
            <Card>
              <p className="flex items-center gap-2">
                <MapPin className="size-4 text-leaf" aria-hidden /> Set your town to see your state&apos;s schemes.
              </p>
              <Link to="/grow" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-leaf px-4 font-semibold text-on-leaf no-underline">
                Set my town
              </Link>
            </Card>
          ) : data.state.length ? (
            <>
              <p className="flex items-center gap-1.5 px-1 text-sm text-muted">
                <MapPin className="size-4 text-leaf" aria-hidden /> Schemes run by the {place.state} government
              </p>
              {data.state.map((s) => (
                <SchemeCard key={s.key} scheme={s} />
              ))}
            </>
          ) : (
            <Card>
              <p>
                No verified schemes for <strong>{place.state}</strong> yet — we only list a state scheme after checking it on an official page.
              </p>
              <p className="mt-2 text-sm text-muted">States covered so far: {data.states_covered.join(', ') || 'none'}. Your district agriculture office or KVK can tell you about yours.</p>
            </Card>
          )}
        </div>
      )}

      {tab === 'updates' && <Updates />}

      <p className="flex items-start gap-2 px-1 text-xs text-muted">
        <Landmark className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {data?.note ?? 'Rules and amounts change. Always confirm on the official page before applying.'}
      </p>
    </div>
  )
}
