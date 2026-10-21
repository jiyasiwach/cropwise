import { Link } from 'react-router-dom'
import { BarChart3, ChevronRight, Code2, History, Info, Lightbulb, MapPin } from 'lucide-react'
import { LANGUAGES, type Lang } from '../lib/i18n'
import { usePrefs, type Theme } from '../lib/prefs'
import { Card, HelplineButton, PageTitle, SectionTitle, cx } from '../components/ui'

function Row({ to, icon, label, hint, external }: { to: string; icon: React.ReactNode; label: string; hint?: string; external?: boolean }) {
  const body = (
    <>
      <span className="grid size-10 place-items-center rounded-xl bg-leaf-soft text-leaf">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <ChevronRight className="size-5 text-muted" aria-hidden />
    </>
  )
  const cls = 'flex min-h-14 items-center gap-3 rounded-2xl px-2 py-2 no-underline hover:bg-surface-2'
  return external ? (
    <a href={to} className={cls} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  ) : (
    <Link to={to} className={cls}>
      {body}
    </Link>
  )
}

export default function Settings() {
  const { lang, setLang, theme, setTheme, place, setPlace, t } = usePrefs()
  return (
    <div className="space-y-5">
      <PageTitle title="More" />

      <Card>
        <Row to="/history" icon={<History className="size-5" />} label="History" hint="Your past recommendations" />
        <Row to="/impact" icon={<Lightbulb className="size-5" />} label="The problem" hint="Why CropWise exists, with sources and a calculator" />
        <Row to="/eval" icon={<BarChart3 className="size-5" />} label="How well it works" hint="Measured accuracy and safety" />
        <Row to="https://github.com/jiyasiwach/cropwise" icon={<Code2 className="size-5" />} label="Source code" hint="github.com/jiyasiwach/cropwise" external />
      </Card>

      <Card>
        <SectionTitle>{t('settings.language')}</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('settings.language')}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              role="radio"
              aria-checked={lang === l.code}
              onClick={() => setLang(l.code as Lang)}
              className={cx('min-h-12 rounded-2xl border px-3 font-semibold', lang === l.code ? 'border-leaf bg-leaf-soft text-leaf' : 'border-line bg-surface text-ink')}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Menus and buttons change now; KrishiMitra and Crop Doctor answer in this language.</p>
      </Card>

      <Card>
        <SectionTitle>{t('settings.theme')}</SectionTitle>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('settings.theme')}>
          {(['system', 'light', 'dark'] as Theme[]).map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={theme === v}
              onClick={() => setTheme(v)}
              className={cx('min-h-12 rounded-2xl border font-semibold capitalize', theme === v ? 'border-leaf bg-leaf-soft text-leaf' : 'border-line bg-surface text-ink')}
            >
              {v === 'system' ? 'Phone setting' : v}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Your farm</SectionTitle>
        {place ? (
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">
              <MapPin className="size-4 text-leaf" aria-hidden /> {[place.city, place.state].filter(Boolean).join(', ')}
            </span>
            <button onClick={() => setPlace(null)} className="text-sm font-semibold text-danger">
              Forget
            </button>
          </div>
        ) : (
          <Link to="/grow">Set your town →</Link>
        )}
        <p className="mt-2 text-xs text-muted">Saved only on this phone.</p>
      </Card>

      <Card>
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <Info className="size-5 text-leaf" aria-hidden /> About and privacy
          </span>
        </SectionTitle>
        <ul className="space-y-1.5 text-sm text-muted">
          <li>Soil: ISRIC SoilGrids · Weather: Open-Meteo · Shops: OpenStreetMap · Prices: data.gov.in (Agmarknet) · Crop calendar: ICAR and state packages of practice.</li>
          <li>No sign-up. A random id in a cookie keeps your history separate; nothing personal is collected.</li>
          <li>Crop Doctor photos are processed once in memory and never stored or logged.</li>
          <li>A working prototype by Jiya Siwach — not field-tested with farmers yet.</li>
        </ul>
        <div className="mt-4">
          <HelplineButton />
        </div>
      </Card>
    </div>
  )
}
