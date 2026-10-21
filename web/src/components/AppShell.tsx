import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { BarChart3, Camera, ChevronRight, History, Home, Landmark, Lightbulb, MapPin, MessageCircle, Moon, Menu, Phone, Radio, Scale, Settings, Sprout, Sun, SunMoon, WifiOff, type LucideIcon } from 'lucide-react'
import { LANGUAGES, type Lang } from '../lib/i18n'
import { usePrefs, type Theme } from '../lib/prefs'
import { Logo } from './Logo'
import { cx } from './ui'

const NAV = [
  { to: '/', key: 'nav.home', icon: Home, end: true },
  { to: '/grow', key: 'nav.grow', icon: Sprout },
  { to: '/doctor', key: 'nav.doctor', icon: Camera },
  { to: '/ask', key: 'nav.ask', icon: MessageCircle },
  { to: '/settings', key: 'nav.more', icon: Menu },
] as const

const TOOLS = [
  { to: '/yield', key: 'tile.yield', icon: Scale },
  { to: '/schemes', key: 'tile.schemes', icon: Landmark },
  { to: '/community', key: 'tile.community', icon: Radio },
] as const

const EXTRA = [
  { to: '/history', label: 'History', icon: History },
  { to: '/impact', label: 'The problem', icon: Lightbulb },
  { to: '/eval', label: 'How well it works', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

/** One sidebar link: an icon tile and a label; the tile fills in when the page is open. */
function SideLink({ to, label, icon: Icon, end, small, badge }: { to: string; label: string; icon: LucideIcon; end?: boolean; small?: boolean; badge?: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          'group relative flex items-center gap-3 rounded-xl px-2 no-underline transition-colors',
          small ? 'min-h-10 text-[13.5px]' : 'min-h-11 text-[15px]',
          isActive ? 'bg-leaf-soft font-bold text-leaf' : 'font-semibold text-muted hover:bg-surface-2 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute -left-4 top-2 bottom-2 w-1 rounded-r-full bg-leaf" aria-hidden />}
          <span
            className={cx(
              'grid shrink-0 place-items-center rounded-lg transition-colors',
              small ? 'size-7' : 'size-8',
              isActive ? 'bg-leaf text-on-leaf shadow-sm' : 'bg-surface-2 text-muted group-hover:text-ink',
            )}
          >
            <Icon className={small ? 'size-[15px]' : 'size-[17px]'} strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badge}
        </>
      )}
    </NavLink>
  )
}

function FarmCard() {
  const { place, acres } = usePrefs()
  return (
    <Link
      to="/grow"
      className="group mb-5 flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 px-3 py-2.5 no-underline transition hover:border-leaf/40"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-soft text-amber-ink">
        <MapPin className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-muted/80">My farm</span>
        {place ? (
          <>
            <span className="block truncate text-sm font-bold text-ink">{place.city}</span>
            <span className="block truncate text-xs text-muted">
              {place.state ? `${place.state} · ` : ''}
              {acres} {acres === 1 ? 'acre' : 'acres'}
            </span>
          </>
        ) : (
          <span className="block text-sm font-semibold text-leaf">Set my town</span>
        )}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}

const Heading = ({ children }: { children: ReactNode }) => (
  <div className="mb-1.5 mt-5 flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted/80">
    {children}
    <span className="h-px flex-1 bg-line" aria-hidden />
  </div>
)

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function LanguageSelect({ className }: { className?: string }) {
  const { lang, setLang, t } = usePrefs()
  return (
    <label className={cx('relative inline-flex items-center', className)}>
      <span className="sr-only">{t('settings.language')}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className="min-h-10 cursor-pointer appearance-none rounded-xl border border-line bg-surface py-1.5 pl-3 pr-8 text-sm font-semibold text-ink"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 text-xs text-muted" aria-hidden>
        ▾
      </span>
    </label>
  )
}

export function ThemeButton() {
  const { theme, setTheme, t } = usePrefs()
  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : SunMoon
  return (
    <button
      type="button"
      onClick={() => setTheme(next[theme])}
      className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink hover:bg-surface-2"
      title={`${t('settings.theme')}: ${theme}`}
      aria-label={`${t('settings.theme')}: ${theme}. Change`}
    >
      <Icon className="size-[18px]" aria-hidden />
    </button>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = usePrefs()
  const online = useOnline()
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop side navigation */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto border-r border-line bg-surface px-4 pb-4 pt-5 lg:flex">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-leaf-soft/70 to-transparent" aria-hidden />
        <Link to="/" className="relative mb-5 px-1 no-underline" aria-label="CropWise home">
          <Logo tagline />
        </Link>

        <div className="relative">
          <FarmCard />
        </div>

        <nav className="relative flex flex-col gap-0.5" aria-label="Main">
          {NAV.slice(0, 4).map(({ to, key, icon, ...rest }) => (
            <SideLink key={to} to={to} label={t(key)} icon={icon} end={'end' in rest} />
          ))}

          <Heading>Farm tools</Heading>
          {TOOLS.map(({ to, key, icon }) => (
            <SideLink
              key={to}
              to={to}
              label={t(key)}
              icon={icon}
              badge={
                to === '/schemes' ? (
                  <span className="flex items-center gap-1 rounded-full bg-leaf-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-leaf" title="Official announcements, fetched live">
                    <span className="size-1.5 animate-pulse rounded-full bg-leaf" aria-hidden /> Live
                  </span>
                ) : undefined
              }
            />
          ))}

          <Heading>More</Heading>
          {EXTRA.map((item) => (
            <SideLink key={item.to} to={item.to} label={item.label} icon={item.icon} small />
          ))}
        </nav>

        <a
          href="tel:18001801551"
          className="group relative mt-auto block overflow-hidden rounded-2xl border border-amber/30 bg-amber-soft p-4 no-underline"
          aria-label="Call the Kisan Call Centre, 1800-180-1551, free"
        >
          <span className="relative flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber text-[#2a1c00] shadow-sm transition group-hover:scale-105">
              <Phone className="size-[18px]" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-amber-ink/80">Kisan Call Centre · free</span>
              <span className="block font-display text-lg font-extrabold tabular-nums tracking-tight text-amber-ink">1800-180-1551</span>
            </span>
          </span>
          <span className="relative mt-2.5 block text-[11px] leading-snug text-amber-ink/75">Talk to an expert · 6 am–10 pm · 22 languages</span>
        </a>
      </aside>

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
            <Link to="/" className="no-underline lg:invisible" aria-label="CropWise home">
              <Logo size="sm" />
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSelect />
              <ThemeButton />
            </div>
          </div>
        </header>

        {!online && (
          <div className="mx-auto max-w-5xl px-4 pt-3">
            <div className="flex items-center gap-2 rounded-2xl bg-amber-soft px-4 py-2.5 text-sm text-amber-ink" role="status">
              <WifiOff className="size-4" aria-hidden /> {t('offline')}
            </div>
          </div>
        )}

        <main id="main" className="mx-auto max-w-5xl px-4 pb-28 pt-5 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Phone bottom navigation */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden" aria-label="Main">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ to, key, icon: Icon, ...rest }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={'end' in rest}
                className={({ isActive }) =>
                  cx('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold no-underline', isActive ? 'text-leaf' : 'text-muted')
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cx('grid h-7 w-12 place-items-center rounded-full', isActive && 'bg-leaf-soft')}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    {t(key)}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
