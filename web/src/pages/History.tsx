import { useEffect, useState } from 'react'
import { api, type HistoryItem } from '../lib/api'
import { ButtonLink, Card, Chip, CropIcon, cropName, ErrorBox, Loading, PageTitle } from '../components/ui'

export default function History() {
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api
      .history()
      .then(setItems)
      .catch(() => setError('Could not load your history just now.'))
  }, [])

  return (
    <div className="space-y-5">
      <PageTitle photo="history" title="History" subtitle="Your past recommendations on this phone. No account: a random id in a cookie keeps them separate from everyone else's." />
      {error && <ErrorBox message={error} />}
      {!items && !error && <Loading />}
      {items?.length === 0 && (
        <Card>
          <p className="mb-3">Nothing yet.</p>
          <ButtonLink to="/grow">Find the best crops →</ButtonLink>
        </Card>
      )}
      <div className="space-y-3">
        {items?.map((h) => (
          <Card key={h.id} as="article" className="flex items-center gap-4 p-4">
            <CropIcon crop={h.crop} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{cropName(h.crop)}</div>
              <div className="text-sm text-muted">
                {h.city ?? 'Unknown place'} · {new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <Chip tone={h.confidence >= 60 ? 'good' : 'neutral'}>{Math.round(h.confidence)}%</Chip>
            <ButtonLink to={`/plan/${h.crop}`} variant="secondary" className="hidden sm:inline-flex">
              Plan
            </ButtonLink>
          </Card>
        ))}
      </div>
    </div>
  )
}
