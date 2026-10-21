import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { api, ApiError } from '../lib/api'
import { translate } from '../lib/i18n'
import { cleanForSpeech } from '../lib/speech'
import { CompareBars, ConfidenceRing, SeasonTimeline } from '../components/charts'

afterEach(() => vi.unstubAllGlobals())

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })),
  )
}

describe('API client', () => {
  it('returns parsed JSON on success', async () => {
    stubFetch(200, { city: 'Pune', state: 'Maharashtra', latitude: 18.5, longitude: 73.8 })
    await expect(api.place('Pune')).resolves.toMatchObject({ state: 'Maharashtra' })
  })

  it("shows the server's sentence, not a status code, when it explains the problem", async () => {
    stubFetch(404, { detail: "We could not find a place called 'Qwx'." })
    await expect(api.place('Qwx')).rejects.toThrow("We could not find a place called 'Qwx'.")
  })

  it('turns validation errors into a plain request to check the values', async () => {
    stubFetch(422, { detail: [{ loc: ['body', 'ph'], msg: 'too big' }] })
    await expect(api.predict({} as never)).rejects.toThrow('Please check the values you entered.')
  })

  it('says "offline" when the network is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    const error = await api.history().catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/offline/)
  })

  it('never sends empty query parameters', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await api.mandi('rice', 'Telangana', undefined, undefined)
    expect(String((fetchMock.mock.calls as unknown[][])[0][0])).toBe('/api/v1/mandi?crop=rice&state=Telangana')
  })
})

describe('language and speech', () => {
  it('translates and falls back to English', () => {
    expect(translate('hi', 'nav.home')).toBe('होम')
    expect(translate('kn', 'common.listen')).toBe('ಆಲಿಸಿ')
  })

  it('never reads markdown or emoji aloud', () => {
    expect(cleanForSpeech('**Rice** 🌾 needs → 120 kg')).toBe('Rice needs 120 kg')
  })
})

describe('visuals', () => {
  it('confidence ring announces the match', () => {
    render(<ConfidenceRing value={72.4} />)
    expect(screen.getByRole('img', { name: '72% match' })).toBeInTheDocument()
  })

  it('comparison bars say where the axis starts', () => {
    render(
      <CompareBars
        rows={[
          { label: 'Nearest', value: 2201 },
          { label: 'Best', value: 2277, highlight: true },
        ]}
      />,
    )
    expect(screen.getByText(/Bars start at/)).toBeInTheDocument()
  })

  it('timeline tells the farmer whether to sow now', () => {
    render(<SeasonTimeline sowFrom="2026-10-01" sowBy="2026-11-30" harvest="2027-02-18" today={new Date('2026-10-21')} />)
    expect(screen.getByText('Sow now — the window is open')).toBeInTheDocument()
  })

  it('timeline counts down before the window opens', () => {
    render(<SeasonTimeline sowFrom="2027-06-01" sowBy="2027-07-31" harvest="2027-10-04" today={new Date('2027-05-22')} />)
    expect(screen.getByText('Sowing opens in 10 days')).toBeInTheDocument()
  })
})
