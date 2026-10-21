import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, Camera, FileText, IndianRupee, Send, ShieldCheck, Sprout, Umbrella, Wrench } from 'lucide-react'
import { askStream, type AssistantEvent, type Citation } from '../lib/api'
import { usePrefs } from '../lib/prefs'
import { useListener } from '../lib/speech'
import { Chip, HelplineButton, ListenButton, MicButton, PageTitle, TONE_BG, cx, type Tone } from '../components/ui'
import { LogoMark } from '../components/Logo'

interface Message {
  id: string
  role: 'user' | 'bot'
  text: string
  citations?: Citation[]
  tools?: string[]
  blocked?: string | null
  mock?: boolean
  latency?: number
  pending?: boolean
  error?: boolean
}

const SUGGESTIONS: { q: string; icon: typeof Sprout; tone: Tone; topic: string }[] = [
  { q: 'When should I sow chickpea?', icon: CalendarDays, tone: 'sky', topic: 'Sowing' },
  { q: 'How much urea does rice need per acre?', icon: Sprout, tone: 'leaf', topic: 'Fertiliser' },
  { q: 'My crop was damaged by flood — can I claim insurance?', icon: Umbrella, tone: 'clay', topic: 'Insurance' },
  { q: 'Which mandi pays best for rice in Telangana?', icon: IndianRupee, tone: 'amber', topic: 'Selling' },
  { q: 'How do I get a Soil Health Card?', icon: FileText, tone: 'leaf', topic: 'Schemes' },
]

const BLOCKED: Record<string, string> = {
  injection: 'Protected: that message tried to change my instructions, so I did not act on it.',
  off_topic: 'I only help with farming — crops, soil, fertiliser, weather, mandi prices and schemes.',
  unsafe: 'For safety I cannot advise on this. Please talk to a person.',
  not_in_knowledge_base: 'Not in my sources, so I will not guess.',
}

let counter = 0
const nextId = () => `m${++counter}`

export default function Ask() {
  const { lang, place } = usePrefs()
  const [params, setParams] = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const asked = useRef(false)

  const update = (id: string, patch: Partial<Message> | ((m: Message) => Partial<Message>)) =>
    setMessages((all) => all.map((m) => (m.id === id ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)))

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim()
      if (!q || busy) return
      setInput('')
      setBusy(true)
      const botId = nextId()
      setMessages((all) => [...all, { id: nextId(), role: 'user', text: q }, { id: botId, role: 'bot', text: '', pending: true, tools: [] }])
      const context = place ? { city: place.city, state: place.state, latitude: place.latitude, longitude: place.longitude } : undefined
      try {
        await askStream(q, lang, context, (e: AssistantEvent) => {
          if (e.type === 'token') update(botId, (m) => ({ text: m.text + e.text }))
          else if (e.type === 'tool') update(botId, (m) => ({ tools: [...(m.tools ?? []), e.name] }))
          else if (e.type === 'error') update(botId, { text: 'Something went wrong. Please try again.', error: true, pending: false })
          else if (e.type === 'done')
            update(botId, (m) => ({
              text: e.answer || m.text,
              citations: e.citations,
              blocked: e.blocked,
              mock: e.is_mock,
              latency: e.latency_ms,
              pending: false,
            }))
        })
      } catch {
        update(botId, { text: 'Could not reach KrishiMitra. Check your connection and try again.', error: true, pending: false })
      } finally {
        update(botId, { pending: false })
        setBusy(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, lang, place],
  )

  // A question typed on Home arrives as ?q= and is asked once.
  useEffect(() => {
    const q = params.get('q')
    if (q && !asked.current) {
      asked.current = true
      setParams({}, { replace: true })
      ask(q)
    }
  }, [ask, params, setParams])

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const { supported, listening, toggle } = useListener(lang, setInput, ask)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    ask(input)
  }

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col">
      <PageTitle photo="ask" title="KrishiMitra" subtitle="Answers only from its sources and tells you which. Ask in your language, by voice or text." />

      <div className="flex-1 space-y-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-4">
            <Link
              to="/doctor"
              className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-clay/30 bg-clay-soft/60 px-4 py-3.5 no-underline transition hover:border-clay/60"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-clay text-white">
                <Camera className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">Check a sick plant</span>
                <span className="block text-sm text-ink/70">Spots, rust or curl? A photo works better than words.</span>
              </span>
              <ArrowRight className="size-4 text-clay transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <div>
              <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">Try asking</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {SUGGESTIONS.map(({ q, icon: Icon, tone, topic }) => (
                  <button
                    key={q}
                    onClick={() => ask(q)}
                    className="group flex items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3.5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-leaf/40"
                  >
                    <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', TONE_BG[tone])}>
                      <Icon className="size-5 text-ink/75" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">{topic}</span>
                      <span className="block font-semibold leading-snug text-ink">{q}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-md bg-leaf px-4 py-2.5 text-on-leaf shadow-card">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="flex max-w-[94%] gap-2.5">
              <LogoMark className="mt-1 size-8" />
              <div className="min-w-0 flex-1">
              {m.blocked ? (
                <div className="flex gap-3 rounded-2xl rounded-bl-md border border-amber/40 bg-amber-soft px-4 py-3 text-amber-ink">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
                  <div>
                    <div className="font-semibold">{BLOCKED[m.blocked] ?? 'I could not help with that.'}</div>
                    <div className="mt-1 text-sm">{m.text}</div>
                  </div>
                </div>
              ) : (
                <div className={cx('whitespace-pre-wrap rounded-2xl rounded-tl-md border px-4 py-3 leading-relaxed shadow-card', m.error ? 'border-danger/40 bg-danger-soft text-danger' : 'border-line bg-surface')}>
                  {m.text || (m.pending ? <span className="inline-flex gap-1 text-muted" aria-label="Thinking">●<span className="animate-pulse">●</span>●</span> : '')}
                </div>
              )}
              {!m.pending && !m.error && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {!m.blocked && <ListenButton id={m.id} text={m.text} />}
                  {(m.tools ?? []).map((t) => (
                    <Chip key={t} tone="good">
                      <Wrench className="size-3" aria-hidden /> {t.replace(/_/g, ' ')}
                    </Chip>
                  ))}
                  {(m.citations ?? []).map((c) => (
                    <Chip key={c.title} title={c.source}>
                      <FileText className="size-3" aria-hidden /> {c.title}
                    </Chip>
                  ))}
                  {m.mock && <Chip tone="warn">Demo — no AI key set</Chip>}
                  {m.latency != null && <span className="text-xs text-muted">{(m.latency / 1000).toFixed(1)} s</span>}
                </div>
              )}
              </div>
            </div>
          ),
        )}
        <div ref={end} />
      </div>

      <form onSubmit={submit} className="sticky bottom-24 mt-5 flex items-center gap-2 rounded-[1.4rem] border border-line bg-surface p-2 shadow-card focus-within:border-leaf focus-within:ring-4 focus-within:ring-leaf/15 lg:bottom-4">
        <MicButton listening={listening} supported={supported} onClick={toggle} />
        <label htmlFor="ask-input" className="sr-only">
          Your question
        </label>
        <input
          id="ask-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about crops, soil, fertiliser, mandi, schemes…"
          className="h-11 min-w-0 flex-1 rounded-xl bg-transparent px-2 text-[17px] outline-none"
        />
        <button type="submit" disabled={busy || !input.trim()} className="grid size-11 place-items-center rounded-xl bg-leaf text-on-leaf disabled:opacity-40" aria-label="Send">
          <Send className="size-5" aria-hidden />
        </button>
      </form>
      <div className="mt-3">
        <HelplineButton className="text-sm" />
      </div>
    </div>
  )
}
