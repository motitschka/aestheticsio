import { lazy, Suspense, useEffect, useState } from 'react'
import { SHOW_INTRO_EVENT } from '../lib/intro-events'
import { storageKey } from '../lib/storage'

const IntroPlayer = lazy(() => import('../intro/IntroPlayer').then((m) => ({ default: m.IntroPlayer })))

const SEEN_KEY = storageKey('intro-seen')
/** Dev only: ?intro-video=portrait|landscape renders the shareable cut (scripts drive it frame by frame). */
const videoCut = import.meta.env.DEV ? new URLSearchParams(location.search).get('intro-video') : null

/** First visit only: not once seen, not for anyone who already plays here, not with reduced motion or Save-Data. */
function firstVisit(): boolean {
  try {
    if (localStorage.getItem(SEEN_KEY) === '1') return false
    if (localStorage.getItem(storageKey('guest')) || localStorage.getItem(storageKey('guest-progress'))) return false
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return false
    return true
  } catch {
    return false
  }
}

/** Shows the intro over the app on a first visit, or when asked to replay it. */
export function IntroGate() {
  const [show, setShow] = useState(() => !!videoCut || firstVisit())
  useEffect(() => {
    const replay = () => setShow(true)
    window.addEventListener(SHOW_INTRO_EVENT, replay)
    return () => window.removeEventListener(SHOW_INTRO_EVENT, replay)
  }, [])
  if (!show) return null
  return (
    <Suspense fallback={<div className="intro" />}>
      <IntroPlayer mode={videoCut ? 'video' : 'live'} onDone={() => setShow(false)} />
    </Suspense>
  )
}
