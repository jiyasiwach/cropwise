import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AtSign, BadgeCheck, ExternalLink, MapPin, MessageCircle, Phone, PlayCircle, Send, Users } from 'lucide-react'
import { api, type Channel, type Channels } from '../lib/api'
import { usePrefs } from '../lib/prefs'
import { Card, Chip, ErrorBox, HelplineButton, Note, PageTitle, SectionTitle, Skeleton, cx } from '../components/ui'
import { ArtChannels } from '../components/art'

// Platform tints are soft washes of each service's colour, so a farmer can tell them apart at a glance.
const PLATFORM: Record<string, { label: string; icon: typeof Send; tint: string; group: 'chat' | 'call' | 'follow' }> = {
  whatsapp_channel: { label: 'WhatsApp channel', icon: MessageCircle, tint: 'bg-[#25d366]/15 text-[#128c4a] dark:text-[#5fe39a]', group: 'chat' },
  whatsapp_helpline: { label: 'WhatsApp helpline', icon: MessageCircle, tint: 'bg-[#25d366]/15 text-[#128c4a] dark:text-[#5fe39a]', group: 'chat' },
  telegram: { label: 'Telegram', icon: Send, tint: 'bg-[#229ed9]/15 text-[#1b7fb0] dark:text-[#6cc4ee]', group: 'chat' },
  phone_helpline: { label: 'Toll-free call', icon: Phone, tint: 'bg-leaf-soft text-leaf', group: 'call' },
  youtube: { label: 'YouTube', icon: PlayCircle, tint: 'bg-[#ff0000]/10 text-[#c4302b] dark:text-[#ff7b75]', group: 'follow' },
  x: { label: 'X (Twitter)', icon: AtSign, tint: 'bg-surface-2 text-ink', group: 'follow' },
}
const GROUPS = [
  { id: 'chat', title: 'WhatsApp & Telegram' },
  { id: 'call', title: 'Helplines' },
  { id: 'follow', title: 'Videos & news' },
] as const

function href(c: Channel) {
  const v = c.url_or_number.trim()
  if (/^https?:\/\//.test(v)) return v
  const digits = v.replace(/[^\d]/g, '')
  if (c.platform === 'whatsapp_helpline' && digits) return `https://wa.me/${digits.length === 10 ? '91' + digits : digits}`
  return digits ? `tel:${digits}` : v
}

const shortOwner = (owner: string) => owner.replace(/\s*\(.*\)\s*$/, '')

function ChannelRow({ c }: { c: Channel }) {
  const meta = PLATFORM[c.platform] ?? { label: c.platform, icon: ExternalLink, tint: 'bg-surface-2 text-ink', group: 'follow' }
  const Icon = meta.icon
  const isNumber = !/^https?:/.test(c.url_or_number)
  const action = c.platform === 'phone_helpline' ? 'Call' : c.platform === 'whatsapp_helpline' ? 'Chat' : c.platform.startsWith('whatsapp') || c.platform === 'telegram' ? 'Join' : 'Open'
  return (
    <li className="flex gap-3 py-3.5">
      <span className={cx('grid size-11 shrink-0 place-items-center rounded-xl', meta.tint)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold leading-snug text-ink">
          {c.name}
          <BadgeCheck className="ml-1 inline size-4 -translate-y-px text-leaf" aria-label="Verified official" />
        </div>
        <div className="mt-0.5 text-sm text-muted">
          {meta.label} · {shortOwner(c.owner)}
        </div>
        {isNumber && <div className="mt-0.5 font-display text-base font-bold tabular-nums text-ink">{c.url_or_number}</div>}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <a
            href={href(c)}
            {...(href(c).startsWith('tel:') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-leaf px-3.5 text-sm font-semibold text-on-leaf no-underline hover:brightness-110"
          >
            {action}
            {href(c).startsWith('tel:') ? <Phone className="size-3.5" aria-hidden /> : <ExternalLink className="size-3.5" aria-hidden />}
          </a>
          <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted underline-offset-2 hover:underline">
            Where this link is published
          </a>
        </div>
      </div>
    </li>
  )
}

function Grouped({ rows }: { rows: Channel[] }) {
  return (
    <div className="space-y-4">
      {GROUPS.map((g) => {
        const list = rows.filter((c) => (PLATFORM[c.platform]?.group ?? 'follow') === g.id)
        if (!list.length) return null
        return (
          <div key={g.id}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{g.title}</h3>
            <ul className="divide-y divide-line">
              {list.map((c) => (
                <ChannelRow key={c.name + c.url_or_number} c={c} />
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export default function Community() {
  const { place, t } = usePrefs()
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
      <PageTitle art={<ArtChannels />} tone="sky"
        title={t('tile.community')}
        subtitle="Official government agriculture channels for alerts, scheme news and advice. Every one is published by the government body itself — CropWise does not run any groups."
      />

      <Note tone="warn">Never share an OTP, Aadhaar number or bank details in any chat. Official channels only send information — they never ask for payment.</Note>

      {error && <ErrorBox message={error} />}
      {!data && !error && (
        <Card>
          <div className="space-y-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        </Card>
      )}

      {data && (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
          <div className="space-y-5">
            <Card>
              <SectionTitle aside={place?.state && <Chip>{place.state}</Chip>}>Your state</SectionTitle>
              {!place?.state ? (
                <p className="flex items-center gap-2 text-sm">
                  <MapPin className="size-4 text-leaf" aria-hidden /> <Link to="/grow">Set your town</Link> to see your state&apos;s official channels.
                </p>
              ) : data.state.length ? (
                <Grouped rows={data.state} />
              ) : (
                <p className="text-sm text-muted">No verified official channel found for {place.state} yet. Your district agriculture office or KVK can share the local groups they run.</p>
              )}
            </Card>

            <Card>
              <SectionTitle aside={<Chip>National</Chip>}>Government of India</SectionTitle>
              {data.national.length ? <Grouped rows={data.national} /> : <p className="text-muted">No verified national channels are loaded yet.</p>}
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <div className="mb-2 flex items-center gap-2">
                <Users className="size-5 text-leaf" aria-hidden />
                <h2 className="text-lg font-bold text-ink">Your block or tehsil group</h2>
              </div>
              <p className="text-sm text-muted">Many districts run farmer WhatsApp groups at block or tehsil level. There is no official list of them, so CropWise does not show any. To join the real one:</p>
              <ol className="mt-3 space-y-2 text-sm">
                {[
                  'Ask your village Agriculture Extension Officer or the block agriculture office (ATMA).',
                  'Or ask your district Krishi Vigyan Kendra (KVK) — most run advisory groups for local farmers.',
                  'Join only a group shared by an officer you have met in person.',
                ].map((step, i) => (
                  <li key={step} className="flex gap-2.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-leaf-soft text-xs font-bold text-leaf">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </Card>

            <Card>
              <h2 className="mb-1 text-lg font-bold text-ink">Talk to an expert</h2>
              <p className="mb-3 text-sm text-muted">The Kisan Call Centre is free and answers in 22 languages, 6 am to 10 pm.</p>
              <HelplineButton />
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
