// Voice in (SpeechRecognition) and voice out (speechSynthesis), using only what the browser has.
// No service, no key, nothing leaves the phone.
import { useCallback, useEffect, useRef, useState } from 'react'
import { speechLocale, type Lang } from './i18n'

export function cleanForSpeech(text: string): string {
  // Emoji, arrows and markdown marks would be read out as their names ("asterisk").
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}→←↑↓•·*_#`>|[\]]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function voiceFor(lang: Lang): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? []
  const locale = speechLocale(lang)
  return voices.find((v) => v.lang.replace('_', '-') === locale) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang))
}

/** Read text aloud. `missingVoice` is true when the device has no voice for the language. */
export function useSpeaker() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [missingVoice, setMissingVoice] = useState(false)

  useEffect(() => {
    if (!supported) return
    window.speechSynthesis.getVoices() // Chrome loads voices lazily; ask early.
    const stop = () => window.speechSynthesis.cancel()
    window.addEventListener('pagehide', stop)
    return () => {
      window.removeEventListener('pagehide', stop)
      stop()
    }
  }, [supported])

  const speak = useCallback(
    (id: string, text: string, lang: Lang) => {
      if (!supported) return
      const synth = window.speechSynthesis
      if (speakingId === id) {
        synth.cancel()
        setSpeakingId(null)
        return
      }
      synth.cancel()
      const utterance = new SpeechSynthesisUtterance(cleanForSpeech(text))
      const voice = voiceFor(lang)
      utterance.lang = speechLocale(lang)
      if (voice) utterance.voice = voice
      setMissingVoice(!voice && lang !== 'en')
      utterance.onend = utterance.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur))
      setSpeakingId(id)
      synth.speak(utterance)
    },
    [speakingId, supported],
  )

  return { supported, speakingId, speak, missingVoice }
}

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

/** Speech to text. Calls onFinal with the final transcript when the person stops talking. */
export function useListener(lang: Lang, onText: (text: string) => void, onFinal: (text: string) => void) {
  const Ctor =
    typeof window !== 'undefined'
      ? ((window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition })
          .SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition)
      : undefined
  const [listening, setListening] = useState(false)
  const ref = useRef<Recognition | null>(null)
  const last = useRef('')

  const toggle = useCallback(() => {
    if (!Ctor) return
    if (listening && ref.current) {
      ref.current.stop()
      return
    }
    const rec = new Ctor()
    rec.lang = speechLocale(lang)
    rec.continuous = false
    rec.interimResults = true
    last.current = ''
    rec.onresult = (e) => {
      last.current = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('')
      onText(last.current)
    }
    rec.onend = () => {
      setListening(false)
      if (last.current.trim()) onFinal(last.current.trim())
    }
    rec.onerror = () => setListening(false)
    ref.current = rec
    setListening(true)
    rec.start()
  }, [Ctor, lang, listening, onFinal, onText])

  return { supported: Boolean(Ctor), listening, toggle }
}
