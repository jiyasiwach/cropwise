import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { Camera, Home, MessageCircle, Moon, Menu, Sprout, Sun, SunMoon, WifiOff } from 'lucide-react'
import { LANGUAGES, type Lang } from '../lib/i18n'
import { usePrefs, type Theme } from '../lib/prefs'
import { cx } from './ui'

const NAV = [
  { to: '/', key: 'nav.home', icon: Home, end: true },
  { to: '/grow', key: 'nav.grow', icon: Sprout },
  { to: '/doctor', key: 'nav.doctor', icon: Camera },
  { to: '/ask', key: 'nav.ask', icon: MessageCircle },
  { to: '/settings', key: 'nav.more', icon: Menu },
] as const

const EXTRA = [
  { to: '/history', label: 'History' },
  { to: '/impact', label: 'The problem' },
  { to: '/eval', label: 'How well it works' },
]

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
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
        <Link to="/" className="mb-7 flex items-center gap-2.5 px-2 no-underline">
          <span className="grid size-9 place-items-center rounded-xl bg-leaf text-lg text-on-leaf" aria-hidden>
            🌱
          </span>
          <span className="font-display text-xl font-extrabold text-ink">CropWise</span>
        </Link>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV.slice(0, 4).map(({ to, key, icon: Icon, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={'end' in rest}
              className={({ isActive }) =>
                cx('flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold no-underline', isActive ? 'bg-leaf-soft text-leaf' : 'text-muted hover:bg-surface-2 hover:text-ink')
              }
            >
              <Icon className="size-5" aria-hidden /> {t(key)}
            </NavLink>
          ))}
          <div className="mt-4 mb-1 px-3 text-xs font-bold uppercase tracking-wider text-muted">More</div>
          {[...EXTRA, { to: '/settings', label: 'Settings' }].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx('flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold no-underline', isActive ? 'bg-leaf-soft text-leaf' : 'text-muted hover:bg-surface-2 hover:text-ink')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-amber-soft p-4 text-sm text-amber-ink">
          <div className="font-semibold">Kisan Call Centre</div>
          <a href="tel:18001801551" className="text-lg font-bold text-amber-ink">
            1800-180-1551
          </a>
          <div className="text-xs">Free · 6 am–10 pm · 22 languages</div>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
            <Link to="/" className="flex items-center gap-2 no-underline lg:invisible">
              <span className="grid size-9 place-items-center rounded-xl bg-leaf text-lg text-on-leaf" aria-hidden>
                🌱
              </span>
              <span className="font-display text-xl font-extrabold text-ink">CropWise</span>
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
