import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeIndianRupee, ChevronDown, ExternalLink, FileCheck2, Landmark, MapPin, MessageCircle, Newspaper, Phone, ShieldAlert } from 'lucide-react'
import { api, type Scheme, type SchemeUpdates, type Schemes as SchemesData } from '../lib/api'
import { usePrefs } from '../lib/prefs'
import { Card, Chip, ErrorBox, ListenButton, Loading, Note, PageTitle, SectionTitle, cx } from '../components/ui'

const TABS = [
  { id: 'central', label: 'Central schemes' },
  { id: 'state', label: 'My state' },
  { id: 'updates', label: 'Latest updates' },
] as const
type Tab = (typeof TABS)[number]['id']

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
  return (
    <Card as="article" className="p-0">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 p-5 text-left">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-leaf-soft text-leaf">
          <BadgeIndianRupee className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold leading-snug text-ink">{scheme.name}</span>
          {scheme.status && scheme.status !== 'active' && (
            <span className="mt-1 inline-block">
              <Chip tone="warn">Check status with your state</Chip>
            </span>
          )}
          {scheme.hindi_name && <span className="block text-sm text-muted">{scheme.hindi_name}</span>}
          <span className="mt-1.5 block text-[15px] text-ink">{scheme.what_you_get}</span>
        </span>
        <ChevronDown className={cx('mt-1 size-5 shrink-0 text-muted transition', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="space-y-4 border-t border-line px-5 pb-5 pt-4">
          {scheme.status && scheme.status !== 'active' && (
            <Note tone="warn">Check before applying: {scheme.verification_note || 'this scheme’s period may have ended.'}</Note>
          )}
          {scheme.latest_update && (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <strong>Latest:</strong> {scheme.latest_update}
            </p>
          )}
          <div>
            <h3 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-muted">Who can apply</h3>
            <ul className="list-disc space-y-1 pl-5 text-[15px]">
              {scheme.who_can_apply.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-muted">How to apply</h3>
            <ol className="list-decimal space-y-1 pl-5 text-[15px]">
              {scheme.how_to_apply.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ol>
          </div>
          {scheme.documents.length > 0 && (
            <div>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted">
                <FileCheck2 className="size-4" aria-hidden /> Documents
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {scheme.documents.map((d) => (
                  <Chip key={d}>{d}</Chip>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={scheme.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-leaf px-4 text-sm font-semibold text-on-leaf no-underline"
            >
              Official site · {domain(scheme.official_url)} <ExternalLink className="size-3.5" aria-hidden />
            </a>

            <Link
              to={`/ask?q=${encodeURIComponent(`Am I eligible for ${scheme.name} and how do I apply?`)}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-4 text-sm font-semibold no-underline"
            >
              <MessageCircle className="size-3.5" aria-hidden /> Ask KrishiMitra
            </Link>
            <ListenButton id={`scheme-${scheme.key}`} text={speech} />
          </div>
          {scheme.helpline && (
            <p className="flex items-start gap-1.5 text-sm">
              <Phone className="mt-0.5 size-3.5 shrink-0 text-leaf" aria-hidden /> <span>{scheme.helpline}</span>
            </p>
          )}
          <p className="text-xs text-muted">
            Checked against{' '}
            <a href={scheme.source_url} target="_blank" rel="noopener noreferrer">
              {scheme.source_title || domain(scheme.source_url)}
            </a>{' '}
            · {scheme.as_of}
          </p>
        </div>
      )}
    </Card>
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
  if (!data) return <Loading label="Fetching official announcements…" />
  return (
    <Card>
      <SectionTitle aside={data.source && <Chip tone="good">Live · official</Chip>}>
        <span className="inline-flex items-center gap-2">
          <Newspaper className="size-5 text-leaf" aria-hidden /> Latest announcements
        </span>
      </SectionTitle>
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
            <li key={item.link} className="py-3">
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink no-underline hover:text-leaf hover:underline">
                {item.title}
              </a>
              <div className="mt-0.5 text-xs text-muted">
                {item.date ? new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''} · {domain(item.link)}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data.source && <p className="mt-3 text-xs text-muted">Source: {data.source}. Refreshed at most once an hour.</p>}
    </Card>
  )
}

export default function Schemes() {
  const { place } = usePrefs()
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

  return (
    <div className="space-y-5">
      <PageTitle title="Kisan Yojana" subtitle="Government schemes for farmers — what you get, who can apply and how. Every scheme links to the official page it was checked against." />

      <Note tone="warn">
        <span className="inline-flex items-start gap-1.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Apply only on official .gov.in websites or at your CSC/bank. No government scheme asks you to pay a fee to an agent or share your OTP.</span>
        </span>
      </Note>

      <div className="-mx-4 overflow-x-auto px-4" role="tablist" aria-label="Scheme sections">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cx('min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition', tab === t.id ? 'bg-leaf text-on-leaf' : 'border border-line bg-surface text-muted hover:text-ink')}
            >
              {t.id === 'state' && place?.state ? place.state : t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBox message={error} />}
      {tab !== 'updates' && !data && !error && <Loading />}

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
              <p className="mb-2 flex items-center gap-2">
                <MapPin className="size-4 text-leaf" aria-hidden /> Set your town to see your state's schemes.
              </p>
              <Link to="/grow">Set my town →</Link>
            </Card>
          ) : data.state.length ? (
            data.state.map((s) => <SchemeCard key={s.key} scheme={s} />)
          ) : (
            <Card>
              <p>
                No verified schemes for <strong>{place.state}</strong> yet. States covered so far: {data.states_covered.join(', ') || 'none'}.
              </p>
              <p className="mt-2 text-sm text-muted">Your district agriculture office or Krishi Vigyan Kendra can tell you about state schemes.</p>
            </Card>
          )}
        </div>
      )}

      {tab === 'updates' && <Updates />}

      <Card className="bg-surface-2">
        <div className="flex items-start gap-3">
          <Landmark className="mt-0.5 size-5 shrink-0 text-leaf" aria-hidden />
          <p className="text-sm text-muted">{data?.note ?? 'Rules and amounts change. Always confirm on the official page before applying.'}</p>
        </div>
      </Card>
    </div>
  )
}
