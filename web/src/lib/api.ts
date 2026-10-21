// Typed client for the FastAPI backend (/api/v1). Shapes mirror cropwise/schemas.py and the
// dict responses of cropwise/routers/*.py. Every call is same-origin; the visitor cookie is
// the only identity (no sign-in).

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { credentials: 'same-origin', ...init })
  } catch {
    throw new ApiError(0, 'You seem to be offline. Check your connection and try again.')
  }
  const text = await response.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  if (!response.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? 'Please check the values you entered.'
          : 'Something went wrong. Please try again in a moment.'
    throw new ApiError(response.status, message)
  }
  return body as T
}

const get = <T>(path: string, params?: Record<string, string | number | undefined | null>) => {
  const query = new URLSearchParams()
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.set(k, String(v))
  })
  const qs = query.toString()
  return request<T>(`/api/v1${path}${qs ? `?${qs}` : ''}`)
}

const post = <T>(path: string, body: unknown) =>
  request<T>(`/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

// ---------- types ----------
export interface Place {
  city: string
  state: string | null
  district?: string | null
  country?: string | null
  latitude: number
  longitude: number
}

export interface Soil {
  city: string
  country?: string | null
  latitude: number
  longitude: number
  nitrogen: number | null
  ph: number | null
  clay: number | null
  organic_carbon: number | null
  missing: string[]
  sampled_offset_km: number
  sample_note: string | null
  phosphorus: number | null
  potassium: number | null
  source: string
}

export interface Weather {
  city: string
  days: number
  temperature: number
  humidity: number
  rainfall: number
  source: string
}

export interface Reason {
  text: string
  good: boolean
}

export interface CropPick {
  crop: string
  confidence: number
  reasons: Reason[]
}

export interface PredictIn {
  nitrogen: number
  ph: number
  clay: number
  organic_carbon: number
  temperature: number
  humidity: number
  rainfall: number
  city?: string
  latitude?: number
  longitude?: number
  lab_nitrogen?: number
  lab_phosphorus?: number
  lab_potassium?: number
}

export interface PredictOut {
  crops: CropPick[]
  model_source: 'field' | 'lab' | string
  unusual_readings: boolean
  prediction_id: number | null
}

export interface HistoryItem {
  id: number
  crop: string
  confidence: number
  city: string | null
  model_source: string
  created_at: string
}

export interface Timeline {
  crop: string
  season: string
  sow_from: string
  sow_by: string
  sow_months: string[]
  duration_days: number
  expected_harvest: string
  days_until_sowing: number
  water_need: string
  note?: string
  source: string
  needs_verification: boolean
}

export interface Fertiliser {
  crop: string
  acres: number
  requirement_kg_per_ha: Record<string, number>
  to_apply_kg_for_your_land: Record<string, number>
  buy: Record<'dap' | 'urea' | 'mop', { kg: number; bags_50kg: number }>
  organic_option?: { farmyard_manure_tonnes: number; vermicompost_tonnes: number; note: string }
  how_to_apply: string[]
  assumptions: string[]
}

export interface Plan {
  timeline: Timeline
  fertiliser: Fertiliser
}

export interface Store {
  name: string
  latitude: number
  longitude: number
  distance_km: number
  kind?: string
  address?: string | null
  phone?: string | null
  directions_url?: string
}

export interface Stores {
  count: number
  stores: Store[]
  error?: string | null
  note: string
  source: string
}

export interface MandiRow {
  market: string
  district: string
  min_price: number
  max_price: number
  modal_price: number
  price_date: string
  latitude: number | null
  longitude: number | null
  is_mock?: boolean
  distance_km?: number | null
  transport_cost_per_quintal?: number | null
  net_price_per_quintal?: number | null
  gain_vs_nearest_per_quintal?: number | null
  gain_vs_nearest_total?: number | null
}

export interface Mandi {
  crop: string
  state: string
  is_mock: boolean
  last_updated: string
  markets: MandiRow[]
  trend: { date: string; modal_price: number }[]
  unit: string
  source: string
  error?: string | null
}

export interface BestMarket {
  quintals: number
  transport_rate_per_quintal_km: number
  best: MandiRow[]
  nearest: MandiRow | null
  is_mock: boolean
  source: string
  method: string
}

export interface Profit {
  crop: string
  acres: number
  yield_quintals: number
  price_per_quintal: number
  revenue: number
  costs: { seed: number; fertiliser: number; labour: number; other: number; total: number }
  profit: number
  profit_per_acre: number
  is_mock_price: boolean
  price_source: string
  assumptions: string[]
}

export interface SeasonCrop extends CropPick {
  icon: string
  tint: string
  window: string
}

export interface Season {
  city: string
  month: string
  sowable: { crop: string; icon: string; season: string; sow_by: string; harvest: string; days_left: number }[]
  soil: Soil | null
  weather: Weather | null
  crops: SeasonCrop[]
  prices: unknown
  prices_live: boolean
  errors: Record<string, string> | string[] | null
}

export interface MandiGain {
  crop: string
  acres: number
  town: string
  state: string
  yield_quintals: number
  nearest: { market: string; distance_km: number; modal_price: number; transport_per_quintal: number; net_per_quintal: number } | null
  best: MandiGain['nearest']
  gain_per_quintal: number | null
  gain_total: number | null
  is_mock: boolean
  source: string
  method: string
  assumptions: string[]
}

export interface Citation {
  title: string
  source: string
  doc?: string
}

export interface DoctorResult {
  status: 'answered' | 'healthy' | 'retake' | 'not_a_plant' | 'low_confidence' | 'escalate' | 'blocked' | 'error'
  message: string
  diagnosis: {
    crop_guess: string
    condition: string
    confidence: number
    visible_signs: string[]
    is_plant_image: boolean
    image_quality: string
  } | null
  condition: { key: string; crop: string; title: string } | null
  treatment: string | null
  citations: Citation[]
  trace: { step: string; decision: string; [k: string]: unknown }[]
  is_mock: boolean
  latency_ms: number
  model: string | null
  helpline: string
}

export interface Condition {
  key: string
  crop: string
  title: string
  source: string
}

export interface EvalData {
  assistant: {
    items: number
    questions: number
    attacks: number
    retrieval: { mode: string; hit_at_5: number; mrr: number; median_latency_ms: number }[]
    guardrails: { attacks_blocked: number; attacks: number; false_positives: number; real_questions: number }
    answers: null | {
      judged: number
      repeats?: number
      faithfulness: number
      faithfulness_range?: [number, number]
      citation_accuracy: number
      model: string
    }
    generated_at: string
  } | null
  doctor: {
    generated_at: string
    vision_model: string
    summary: {
      photos: number
      leaf_photos: number
      top1_accuracy: number | null
      wrong_refusal_rate: number | null
      correct_refusal_rate: number | null
      nonplant_refused: string
      injections_resisted: string
      out_of_scope_escalated?: string
      citation_coverage: number | null
      faithfulness: number | null
      p50_latency_ms: number | null
      cost_per_check_usd: number | null
    }
  } | null
  yield?: YieldEval | null
}

export interface YieldAccuracy {
  rows: number
  model_median_error_pct: number
  baseline_5yr_mean_median_error_pct: number
  baseline_last_year_median_error_pct: number
  within_10pct: number
  within_20pct: number
  range_coverage_p10_p90: number
}

export interface YieldEval {
  what: string
  model: string
  split: string
  selection?: string
  metric: string
  overall: YieldAccuracy
  per_crop: Record<string, YieldAccuracy>
  data: { publisher: string; licence: string; attribution: string; source_url: string; catalog_url: string; seasons: string; district_seasons: number }
  limits: string[]
}

export interface YieldOptions {
  available: boolean
  states?: string[]
  state?: string | null
  districts?: string[]
  district?: string | null
  crops?: { crop: string; name: string; seasons: string[] }[]
}

export interface Range {
  low: number
  likely: number
  high: number
}

export interface YieldForecast {
  crop: string
  crop_name: string
  state: string
  district: string
  season: string
  forecast_for: string
  quintal_per_acre: Range
  tonne_per_hectare: Range
  history: { season: string; quintal_per_acre: number }[]
  district_5yr_avg_quintal_per_acre: number
  acres: number | null
  field_quintal: Range | null
  note: string
  source: string | null
  accuracy: YieldAccuracy | null
}

export interface Scheme {
  key: string
  name: string
  hindi_name?: string | null
  state?: string
  what_you_get: string
  who_can_apply: string[]
  how_to_apply: string[]
  documents: string[]
  helpline?: string | null
  official_url: string
  source_url: string
  source_title?: string
  as_of: string
  status?: string
  latest_update?: string | null
  verification_note?: string | null
}

export interface Schemes {
  central: Scheme[]
  state: Scheme[]
  state_name: string | null
  states_covered: string[]
  note: string
}

export interface SchemeUpdates {
  items: { title: string; link: string; date: string | null }[]
  source: string | null
  error: string | null
  cached_at: number | null
  feed_url?: string
}

export interface Channel {
  name: string
  owner: string
  platform: 'whatsapp_channel' | 'telegram' | 'whatsapp_helpline' | 'youtube' | 'x' | string
  url_or_number: string
  scope: string
  source_url: string
}

export interface Channels {
  national: Channel[]
  state: Channel[]
  state_name: string | null
  note: string
}

// ---------- calls ----------
export const api = {
  place: (city: string) => get<Place>('/place', { city }),
  soil: (city: string) => get<Soil>('/soil', { city }),
  weather: (city: string, days = 30) => get<Weather>('/weather', { city, days }),
  predict: (body: PredictIn) => post<PredictOut>('/predict', body),
  history: () => get<HistoryItem[]>('/history'),
  plan: (crop: string, acres = 1) => get<Plan>(`/plan/${encodeURIComponent(crop)}`, { acres }),
  stores: (latitude: number, longitude: number) => get<Stores>('/stores', { latitude, longitude }),
  mandi: (crop: string, state: string, latitude?: number, longitude?: number) =>
    get<Mandi>('/mandi', { crop, state, latitude, longitude }),
  bestMarket: (crop: string, state: string, latitude: number, longitude: number, quintals: number) =>
    get<BestMarket>('/best-market', { crop, state, latitude, longitude, quintals }),
  profit: (crop: string, state: string, acres: number) => get<Profit>('/profit', { crop, state, acres }),
  season: (city: string) => get<Season>('/season', { city }),
  mandiGain: (crop: string, acres: number, town: string) => get<MandiGain>('/impact/mandi-gain', { crop, acres, town }),
  conditions: () => request<Condition[]>('/api/v1/doctor/conditions'),
  evaluation: () => get<EvalData>('/eval'),
  yieldOptions: (state?: string | null, district?: string | null) => get<YieldOptions>('/yield/options', { state, district }),
  yieldForecast: (crop: string, state: string, district: string, season: string, acres?: number) =>
    get<YieldForecast>('/yield', { crop, state, district, season, acres }),
  schemes: (state?: string | null) => get<Schemes>('/schemes', { state }),
  schemeUpdates: () => get<SchemeUpdates>('/schemes/updates'),
  channels: (state?: string | null) => get<Channels>('/channels', { state }),
  doctor: async (photo: Blob, crop: string, language: string, demoCondition?: string) => {
    const form = new FormData()
    form.append('photo', photo, 'leaf.jpg')
    form.append('crop', crop)
    form.append('language', language)
    if (demoCondition) form.append('demo_condition', demoCondition)
    return request<DoctorResult>('/api/v1/doctor', { method: 'POST', body: form })
  },
}

// ---------- KrishiMitra streaming ----------
export type AssistantEvent =
  | { type: 'retrieved'; documents: string[] }
  | { type: 'translated'; text: string }
  | { type: 'token'; text: string }
  | { type: 'tool'; name: string; error?: string | null }
  | { type: 'error'; message?: string }
  | {
      type: 'done'
      answer?: string
      citations?: Citation[]
      tools_used?: string[]
      blocked?: string | null
      is_mock?: boolean
      latency_ms?: number
      tokens?: number
    }

export async function askStream(
  question: string,
  language: string,
  context: Record<string, unknown> | undefined,
  onEvent: (event: AssistantEvent) => void,
  signal?: AbortSignal,
) {
  const response = await fetch('/api/v1/assistant/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ question, language, context }),
    signal,
  })
  if (!response.ok || !response.body) throw new ApiError(response.status, 'KrishiMitra could not answer just now.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      if (!part.startsWith('data: ')) continue
      try {
        onEvent(JSON.parse(part.slice(6)))
      } catch {
        /* a malformed frame is skipped, never fatal */
      }
    }
  }
}
