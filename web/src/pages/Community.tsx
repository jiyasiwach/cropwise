import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, ExternalLink, MapPin, MessageCircle, Phone, PlayCircle, Send, ShieldAlert } from 'lucide-react'
import { api, type Channel, type Channels } from '../lib/api'
import { usePrefs } from '../lib/prefs'
import { Card, Chip, ErrorBox, HelplineButton, Loading, Note, PageTitle, SectionTitle } from '../components/ui'

const PLATFORM: Record<string, { label: string; icon: typeof Send }> = {
  whatsapp_channel: { label: 'WhatsApp channel', icon: MessageCircle },
  whatsapp_helpline: { label: 'WhatsApp helpline', icon: Phone },
  telegram: { label: 'Telegram', icon: Send },
  youtube: { label: 'YouTube', icon: PlayCircle },
  x: { label: 'X (Twitter)', icon: ExternalLink },
  phone_helpline: { label: 'Helpline (call)', icon: Phone },
}

function href(c: Channel) {
  const v = c.url_or_number.trim()
  if (/^https?:\/\//.test(v)) return v
  const digits = v.replace(/[^\d]/g, '')
  if (c.platform === 'whatsapp_helpline' && digits) return `https://wa.me/${digits.length === 10 ? '91' + digits : digits}`
  return digits ? `tel:${digits}` : v
}

function ChannelRow({ c }: { c: Channel }) {
  const meta = PLATFORM[c.platform] ?? { label: c.platform, icon: ExternalLink }
  const Icon = meta.icon
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-leaf-soft text-leaf">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
          {c.name}
          <BadgeCheck className="size-4 text-leaf" aria-label="Verified official" />
        </div>
        <div className="text-sm text-muted">
          {meta.label} · {c.owner}
        </div>
        {/^https?:/.test(c.url_or_number) ? null : <div className="text-sm font-semibold tabular-nums text-ink">{c.url_or_number}</div>}
        <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted">
          Where this link is published
        </a>
      </div>
      <a
        href={href(c)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-leaf px-4 text-sm font-semibold text-on-leaf no-underline"
      >
        {c.platform === 'phone_helpline' ? 'Call' : 'Open'}
      </a>
    </li>
  )
}

export default function Community() {
  const { place } = usePrefs()
  const [data, setData] = useState<Channels | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .channels(place?.state)
      .then(setData)
      .catch(() => setError('Could not load channels just now.'))
  }, [place?.state])

  return (
    <div className="space-y-5">
      <PageTitle
        title="Official channels"
        subtitle="Follow official government agriculture channels on WhatsApp, Telegram and YouTube for alerts, scheme news and advisories. Only channels published by the government body itself are listed."
      />

      <Note tone="warn">
        <span className="inline-flex items-start gap-1.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Never share an OTP, Aadhaar number or bank details in any chat. Official channels only send information — they never ask for payment.</span>
        </span>
      </Note>

      {error && <ErrorBox message={error} />}
      {!data && !error && <Loading />}

      {data && (
        <>
          <Card>
            <SectionTitle aside={<Chip>National</Chip>}>Government of India</SectionTitle>
            {data.national.length ? (
              <ul className="divide-y divide-line">
                {data.national.map((c) => (
                  <ChannelRow key={c.name + c.url_or_number} c={c} />
                ))}
              </ul>
            ) : (
              <p className="text-muted">No verified national channels are loaded yet.</p>
            )}
          </Card>

          <Card>
            <SectionTitle aside={place?.state && <Chip>{place.state}</Chip>}>Your state</SectionTitle>
            {!place?.state ? (
              <p className="flex items-center gap-2">
                <MapPin className="size-4 text-leaf" aria-hidden /> <Link to="/grow">Set your town</Link> to see your state's official channels.
              </p>
            ) : data.state.length ? (
              <ul className="divide-y divide-line">
                {data.state.map((c) => (
                  <ChannelRow key={c.name + c.url_or_number} c={c} />
                ))}
              </ul>
            ) : (
              <p className="text-muted">No verified official channel found for {place.state} yet. Your district agriculture office or KVK can share local groups they run.</p>
            )}
          </Card>
        </>
      )}

      <Card>
        <SectionTitle>Your block or tehsil group</SectionTitle>
        <p className="text-sm">
          Many districts run farmer WhatsApp groups at block or tehsil level, but there is no official list of them, so CropWise does not show any. To join the real one:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>Ask your village Agriculture Extension Officer or the block agriculture office (ATMA).</li>
          <li>Or ask your district Krishi Vigyan Kendra (KVK) — most run advisory groups for local farmers.</li>
          <li>Before joining any group, check it was shared by an officer you can see in person.</li>
        </ol>
      </Card>

      <Card>
        <SectionTitle>Talk to an expert</SectionTitle>
        <p className="mb-3 text-sm text-muted">The Kisan Call Centre is free and answers in 22 languages, 6 am to 10 pm.</p>
        <HelplineButton />
      </Card>
    </div>
  )
}
