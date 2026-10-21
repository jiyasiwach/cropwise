// Per-device preferences: language, theme, the farm's place and acres. Stored in localStorage
// (wrapped: private windows can throw) — conveniences only, never anything that must persist.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translate, type Key, type Lang } from './i18n'
import type { Place } from './api'

export type Theme = 'system' | 'light' | 'dark'

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: the app still works for this visit */
  }
}

interface Prefs {
  lang: Lang
  setLang: (lang: Lang) => void
  theme: Theme
  setTheme: (theme: Theme) => void
  place: Place | null
  setPlace: (place: Place | null) => void
  acres: number
  setAcres: (acres: number) => void
  t: (key: Key) => string
}

const Ctx = createContext<Prefs | null>(null)

function storedLang(): Lang {
  try {
    const raw = localStorage.getItem('cw.lang')
    if (raw && ['en', 'hi', 'te', 'ta', 'ml', 'kn'].includes(raw)) return raw as Lang
  } catch {
    /* ignore */
  }
  return 'en'
}

function storedTheme(): Theme {
  try {
    const raw = localStorage.getItem('cw.theme')
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    /* ignore */
  }
  return 'system'
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(storedLang)
  const [theme, setThemeState] = useState<Theme>(storedTheme)
  const [place, setPlaceState] = useState<Place | null>(() => load<Place | null>('cw.place', null))
  const [acres, setAcresState] = useState<number>(() => load<number>('cw.acres', 1))

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }, [theme])

  const setLang = useCallback((value: Lang) => {
    setLangState(value)
    try {
      localStorage.setItem('cw.lang', value)
    } catch {
      /* ignore */
    }
  }, [])
  const setTheme = useCallback((value: Theme) => {
    setThemeState(value)
    try {
      if (value === 'system') localStorage.removeItem('cw.theme')
      else localStorage.setItem('cw.theme', value)
    } catch {
      /* ignore */
    }
  }, [])
  const setPlace = useCallback((value: Place | null) => {
    setPlaceState(value)
    save('cw.place', value)
  }, [])
  const setAcres = useCallback((value: number) => {
    const clean = Number.isFinite(value) && value > 0 ? Math.min(value, 1000) : 1
    setAcresState(clean)
    save('cw.acres', clean)
  }, [])

  const value = useMemo<Prefs>(
    () => ({ lang, setLang, theme, setTheme, place, setPlace, acres, setAcres, t: (key: Key) => translate(lang, key) }),
    [lang, setLang, theme, setTheme, place, setPlace, acres, setAcres],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePrefs(): Prefs {
  const value = useContext(Ctx)
  if (!value) throw new Error('usePrefs outside PrefsProvider')
  return value
}
