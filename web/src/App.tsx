import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Loading } from './components/ui'
import { PrefsProvider } from './lib/prefs'

const Home = lazy(() => import('./pages/Home'))
const Grow = lazy(() => import('./pages/Grow'))
const Results = lazy(() => import('./pages/Results'))
const PlanPage = lazy(() => import('./pages/Plan'))
const Doctor = lazy(() => import('./pages/Doctor'))
const Ask = lazy(() => import('./pages/Ask'))
const History = lazy(() => import('./pages/History'))
const Impact = lazy(() => import('./pages/Impact'))
const Evaluation = lazy(() => import('./pages/Evaluation'))
const Settings = lazy(() => import('./pages/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <PrefsProvider>
      <BrowserRouter>
        <AppShell>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/grow" element={<Grow />} />
              <Route path="/results" element={<Results />} />
              <Route path="/plan/:crop" element={<PlanPage />} />
              <Route path="/doctor" element={<Doctor />} />
              <Route path="/ask" element={<Ask />} />
              <Route path="/history" element={<History />} />
              <Route path="/impact" element={<Impact />} />
              <Route path="/eval" element={<Evaluation />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppShell>
      </BrowserRouter>
    </PrefsProvider>
  )
}
