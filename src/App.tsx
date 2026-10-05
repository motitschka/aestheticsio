import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBackend, isDemo, NoAccessError, type Backend } from './backend'
import type { ProgressPatch } from './backend/types'
import { Backdrop } from './components/Backdrop'
import type { ChallengeOutcome } from './components/Challenge'
import { Message, NoAccess, SignIn, Splash } from './components/Gates'
import { Leaderboard, LeaderboardSignIn } from './components/Leaderboard'
import { Lesson, type LessonOutcome } from './components/Lesson'
import { Me } from './components/Me'
import { Play } from './components/Play'
import { ProfileEditor } from './components/ProfileEditor'
import { ProgressView } from './components/ProgressView'
import { ThemePicker } from './components/ThemePicker'
import { loadAestheticsData, loadThemes } from './data'
import { formatTime } from './lib/format'
import { clearGuestProgress, hasGuestProgress, loadGuestChoice, loadGuestProgress, saveGuestChoice, saveGuestProgress } from './lib/guest'
import { erasFinished, isLearned } from './lib/eras'
import {
  applyChallenge,
  applyDailyLesson,
  applyLesson,
  applyPractice,
  earnedBadges,
  emptyStats,
  freshStart,
  hasProgress,
  lessonState,
  mergeSaved,
  MILESTONES,
  needsFreshStart,
  profileFrom,
  rankByStreak,
  recognised,
  syncMerge,
  withRecent,
  type Milestone,
} from './lib/progress'
import type { Question } from './lib/questions'
import { START_AS_GUEST_EVENT } from './lib/intro-events'
import { applyTheme, pinUrl, themeUnlocked, type Themes } from './lib/theme'
import { ThemeContext } from './lib/theme-context'
import { Icon, type IconName } from './components/Icon'
import type { Aesthetic, AestheticsData, AppUser, CircleEvent, PracticeMode, SavedProgress } from './types'

type Tab = 'play' | 'progress' | 'ranks' | 'me'
type Status = 'loading' | 'noAccess' | 'error' | 'ready'
type Identity = { nickname: string; avatar: string }


const emptySaved = (): SavedProgress => ({ items: {}, stats: emptyStats() })

export default function App() {
  const [data, setData] = useState<AestheticsData | null>(null)
  const [dataFailed, setDataFailed] = useState(false)
  const [themes, setThemes] = useState<Themes | null>(null)
  // undefined while loading; null when Firebase isn't configured (guest-only site)
  const [backend, setBackend] = useState<Backend | null | undefined>(undefined)
  const [user, setUser] = useState<AppUser | null | undefined>(undefined)
  const [signInError, setSignInError] = useState<string | null>(null)
  const [guest, setGuest] = useState(loadGuestChoice)

  // Which account the loaded data belongs to, so switching accounts shows "loading".
  const [session, setSession] = useState<{ uid: string; status: Status } | null>(null)
  const [admin, setAdmin] = useState(false)
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [saved, setSaved] = useState<SavedProgress>(() => (guest ? loadGuestProgress() : emptySaved()))
  const savedRef = useRef(saved)
  /** The aesthetics as last loaded, for callbacks that outlive a render. */
  const allRef = useRef<Aesthetic[]>([])
  const [now, setNow] = useState(Date.now)

  const [tab, setTab] = useState<Tab>('play')
  const [inRound, setInRound] = useState(false)
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    loadAestheticsData().then(setData, () => setDataFailed(true))
    createBackend().then(setBackend, () => setBackend(null))
    loadThemes().then(setThemes, () => setThemes(null))
  }, [])

  useEffect(() => backend?.onAuthChange(setUser), [backend])

  const account = backend ? user : null

  useEffect(() => {
    if (!backend || !user) return
    let cancelled = false
    const setStatus = (status: Status) => setSession({ uid: user.uid, status })
    ;(async () => {
      try {
        const [isAdmin, remote] = await Promise.all([backend.isAdmin(), backend.loadProgress(user.uid)])
        let progress = remote
        const p = await backend.loadProfile(user.uid)
        // The journey through time starts everyone fresh, once; the old record is kept as a backup.
        if (needsFreshStart(remote)) {
          const had = hasProgress(remote)
          progress = freshStart(had)
          if (had) await backend.startFresh(user.uid, progress, remote, p ? profileFrom(p, progress, allRef.current) : null)
          else await backend.saveProgress(user.uid, { stats: progress.stats }, null)
        }
        const guestProgress = loadGuestProgress()
        const carried = hasGuestProgress(guestProgress)
        if (carried) {
          progress = mergeSaved(progress, guestProgress)
          await backend.saveProgress(user.uid, progress, null)
          clearGuestProgress()
        }
        if (p && carried) await backend.saveProfile(profileFrom(p, progress, allRef.current))
        if (cancelled) return
        saveGuestChoice(false)
        setGuest(false)
        setAdmin(isAdmin)
        savedRef.current = progress
        setSaved(progress)
        setIdentity(p ? { nickname: p.nickname, avatar: p.avatar } : null)
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setStatus(err instanceof NoAccessError ? 'noAccess' : 'error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [backend, user])

  // Each aesthetic with its published pins: lessons check with images the lesson hasn't shown.
  const aesthetics = useMemo(
    () =>
      (data?.items ?? []).map((a) => {
        const t = themes?.[a.id]
        return t?.pins ? { ...a, pins: Array.from({ length: t.pins }, (_, i) => pinUrl(t, i + 1)) } : a
      }),
    [data, themes],
  )
  const byId = useMemo(() => new Map(aesthetics.map((a) => [a.id, a])), [aesthetics])
  useEffect(() => {
    allRef.current = aesthetics
  }, [aesthetics])
  const [avatarSeed] = useState(Math.random)
  const randomAvatar = aesthetics[Math.floor(avatarSeed * aesthetics.length)]?.id ?? ''
  const status: Status = session && account && session.uid === account.uid ? session.status : 'loading'
  const profile = useMemo(() => (account && identity ? profileFrom({ uid: account.uid, ...identity }, saved, aesthetics) : null), [account, identity, saved, aesthetics])

  // Another device (or a tab left open) may change the account: keep this one up to date.
  useEffect(() => {
    if (!backend || !account || status !== 'ready') return
    return backend.watchProgress(account.uid, (remote) => {
      const merged = syncMerge(savedRef.current, remote)
      savedRef.current = merged
      setSaved(merged)
    })
  }, [backend, account, status])

  // The chosen theme, if it's unlocked, dresses the whole app.
  const themeId = saved.stats.theme ?? ''
  const theme = themes && themeId && themeUnlocked(saved.items[themeId]) ? themes[themeId] : null
  useEffect(() => applyTheme(theme ?? null), [theme])

  /** Applies a change locally and saves it (account or this browser). */
  const commit = useCallback(
    (next: SavedProgress, patch: ProgressPatch) => {
      savedRef.current = next
      setSaved(next)
      setNow(Date.now())
      if (backend && account) {
        if (!identity) return
        backend.saveProgress(account.uid, patch, profileFrom({ uid: account.uid, ...identity }, next, allRef.current)).then(
          () => setSaveFailed(false),
          () => setSaveFailed(true),
        )
      } else {
        saveGuestProgress(next)
      }
    },
    [backend, account, identity],
  )

  const recordPractice = useCallback(
    (mode: PracticeMode, q: Question, correct: boolean) => {
      const s = savedRef.current
      if (mode === 'timeline' || !('target' in q)) {
        const stats = { ...s.stats, timelineRight: s.stats.timelineRight + (correct ? 1 : 0), timelineTotal: s.stats.timelineTotal + 1 }
        commit({ ...s, stats }, { stats })
        return false
      }
      const id = q.target.id
      const prev = s.items[id]
      const entry = applyPractice(prev, mode, correct, Date.now())
      commit({ ...s, items: { ...s.items, [id]: entry } }, { items: { [id]: entry } })
      return recognised(entry, mode) && !recognised(prev, mode)
    },
    [commit],
  )

  const recordLesson = useCallback(
    (id: string, perfect: boolean): LessonOutcome => {
      const s = savedRef.current
      const t = Date.now()
      const prev = s.items[id]
      const entry = applyLesson(prev, perfect, t)
      const items = { ...s.items, [id]: entry }
      const daily = applyDailyLesson(s.stats, t)
      // Moments for the circle feed: a lesson learned, an era finished.
      const eras = erasFinished(allRef.current, s.items, items)
      const events: CircleEvent[] = [...eras.map((e): CircleEvent => ({ k: 'era', e, t })), ...(isLearned(items, id) && !isLearned(s.items, id) ? [{ k: 'learned' as const, id, t }] : [])]
      const stats = withRecent(daily.stats, events)
      commit({ items, stats }, { items: { [id]: entry }, stats })
      return {
        before: lessonState(prev, t),
        after: lessonState(entry, t),
        unlocked: themeUnlocked(entry) && !themeUnlocked(prev),
        goalMet: daily.goalMet,
        freezeEarned: daily.freezeEarned,
        dayStreak: stats.dayStreak ?? 0,
        erasFinished: eras,
      }
    },
    [commit],
  )

  const dismissJourneyNote = useCallback(() => {
    const s = savedRef.current
    const stats = { ...s.stats, journeyNote: 0 as const }
    commit({ ...s, stats }, { stats })
  }, [commit])

  const recordChallenge = useCallback(
    (streak: number, splits: Partial<Record<Milestone, number>>): ChallengeOutcome => {
      const s = savedRef.current
      const before = s.stats
      const after = applyChallenge(before, streak, splits)
      const records: string[] = []
      if (after.bestStreak > before.bestStreak) records.push(`Best streak: ${after.bestStreak}`)
      for (const m of MILESTONES) {
        const key = `best${m}` as const
        if (after[key] !== undefined && after[key] !== before[key]) records.push(`Fastest ${m}: ${formatTime(after[key])}`)
      }
      const had = new Set(earnedBadges(before))
      const newBadges = earnedBadges(after).filter((b) => !had.has(b))
      if (records.length) commit({ ...s, stats: after }, { stats: after })
      return { records, newBadges }
    },
    [commit],
  )

  const pickTheme = useCallback(
    (id: string) => {
      const s = savedRef.current
      const stats = { ...s.stats, theme: id }
      commit({ ...s, stats }, { stats })
    },
    [commit],
  )

  // Development only: try any theme from the console with __tryTheme('art-deco').
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __tryTheme?: (id: string) => void }
    w.__tryTheme = (id: string) => {
      const s = savedRef.current
      const entry = { ...(s.items[id] ?? { c: 0, w: 0, t: 0 }), u: 1 as const }
      const stats = { ...s.stats, theme: id }
      commit({ items: { ...s.items, [id]: entry }, stats }, { items: { [id]: entry }, stats })
    }
  }, [commit])

  const listProfiles = useCallback(() => backend!.listProfiles(), [backend])

  const loadStreakRank = useCallback(async () => {
    const ranked = rankByStreak(await backend!.listProfiles())
    const i = ranked.findIndex((p) => p.uid === account?.uid)
    return i < 0 ? null : { rank: i + 1, total: ranked.length }
  }, [backend, account])

  const openLesson = useCallback((a: { id: string }) => {
    setNow(Date.now())
    setLessonId(a.id)
  }, [])

  const signIn = async () => {
    setSignInError(null)
    try {
      await backend!.signIn()
    } catch {
      setSignInError('Sign-in failed. Please try again.')
    }
  }

  const resetView = () => {
    setTab('play')
    setInRound(false)
    setEditing(false)
    setLessonId(null)
  }

  const signOut = () => {
    resetView()
    setSession(null)
    setIdentity(null)
    savedRef.current = emptySaved()
    setSaved(savedRef.current)
    backend?.signOut()
  }

  const playAsGuest = () => {
    if (account) backend?.signOut()
    resetView()
    saveGuestChoice(true)
    savedRef.current = loadGuestProgress()
    setSaved(savedRef.current)
    setGuest(true)
  }

  // The first-visit intro ends with "Start learning": in as a guest, unless already playing.
  const playAsGuestRef = useRef(playAsGuest)
  useEffect(() => {
    playAsGuestRef.current = playAsGuest
  })
  const playing = !!account || guest
  useEffect(() => {
    if (playing) return
    const start = () => playAsGuestRef.current()
    window.addEventListener(START_AS_GUEST_EVENT, start)
    return () => window.removeEventListener(START_AS_GUEST_EVENT, start)
  }, [playing])

  const saveProfile = async (nickname: string, avatar: string) => {
    const next = profileFrom({ uid: account!.uid, nickname, avatar }, savedRef.current, allRef.current)
    await backend!.saveProfile(next)
    setIdentity({ nickname, avatar })
    setEditing(false)
  }

  if (dataFailed) {
    return (
      <Message
        title="Couldn't load the app"
        text="Check your connection and reload."
        action={
          <button className="btn btn-primary" onClick={() => location.reload()}>
            Reload
          </button>
        }
      />
    )
  }
  if (!data || backend === undefined || account === undefined) return <Splash />

  if (account) {
    if (status === 'loading') return <Splash />
    if (status === 'noAccess') return <NoAccess email={account.email} onSignOut={signOut} onGuest={playAsGuest} />
    if (status === 'error') {
      return (
        <Message
          title="Something went wrong"
          text="Couldn't load your progress. Check your connection and reload."
          action={
            <button className="btn btn-primary" onClick={() => location.reload()}>
              Reload
            </button>
          }
        />
      )
    }
    if (!identity || editing) {
      return (
        <main className="app">
          <ProfileEditor
            aesthetics={aesthetics}
            initialNickname={identity?.nickname ?? (account.name.split(' ')[0] || account.email.split('@')[0])}
            initialAvatar={identity?.avatar ?? randomAvatar}
            heading={identity ? 'Edit profile' : 'Welcome!'}
            intro={identity ? undefined : 'Pick a nickname and an aesthetic as your avatar. Friends see them on the leaderboard.'}
            saveLabel={identity ? 'Save' : "Let's go"}
            onSave={saveProfile}
            onCancel={identity ? () => setEditing(false) : undefined}
          />
        </main>
      )
    }
  } else if (!guest) {
    return <SignIn onSignIn={backend ? signIn : undefined} onGuest={playAsGuest} error={signInError} total={aesthetics.length} />
  }

  const lesson = lessonId ? byId.get(lessonId) : undefined
  const showTabs = !inRound && !lesson

  return (
    <ThemeContext.Provider value={theme ?? null}>
    <main className={`app ${showTabs ? 'has-tabs' : 'in-round'}`}>
      {theme && <Backdrop theme={theme} />}
      {lesson && (
        <Lesson
          key={lesson.id}
          aesthetic={lesson}
          all={aesthetics}
          byId={byId}
          entry={saved.items[lesson.id]}
          state={lessonState(saved.items[lesson.id], now)}
          onFinish={(perfect) => recordLesson(lesson.id, perfect)}
          theme={themes?.[lesson.id]}
          themeInUse={themeId === lesson.id}
          onUseTheme={pickTheme}
          onClose={() => {
            setLessonId(null)
            window.scrollTo({ top: 0 })
          }}
        />
      )}

      {/* Kept mounted under a lesson so a practice round can carry on afterwards. */}
      <div hidden={!!lesson}>
        {isDemo && showTabs && <p className="demo-banner">Demo mode: data stays in this browser</p>}
        {saveFailed && <p className="notice notice-top">Couldn't save your last answer. Check your connection.</p>}

        <div hidden={tab !== 'play'}>
          <Play
            all={aesthetics}
            byId={byId}
            saved={saved}
            now={now}
            nickname={profile?.nickname}
            onPractice={recordPractice}
            onChallengeEnd={recordChallenge}
            onLesson={openLesson}
            loadStreakRank={profile ? loadStreakRank : undefined}
            onRoundActive={setInRound}
            onDismissNote={dismissJourneyNote}
          />
        </div>
        {tab === 'progress' && <ProgressView aesthetics={aesthetics} items={saved.items} now={now} onLesson={openLesson} />}
        {tab === 'ranks' &&
          (profile ? <Leaderboard all={aesthetics} byId={byId} me={profile.uid} load={listProfiles} /> : <LeaderboardSignIn onSignIn={signIn} error={signInError} />)}
        {tab === 'me' && (
          <Me
            account={
              account && profile && backend
                ? {
                    user: account,
                    profile,
                    avatar: byId.get(profile.avatar),
                    admin,
                    backend,
                    onEditProfile: () => setEditing(true),
                    onSignOut: signOut,
                  }
                : null
            }
            onSignIn={backend ? signIn : undefined}
            stats={saved.stats}
            themes={<ThemePicker themes={themes} aesthetics={aesthetics} items={saved.items} current={themeId} onPick={pickTheme} onLesson={openLesson} />}
          />
        )}
      </div>

      {showTabs && (
        <nav className="tabbar">
          <TabButton id="play" label="Play" tab={tab} onTab={setTab} icon="play" />
          <TabButton id="progress" label="Lessons" tab={tab} onTab={setTab} icon="lessons" />
          {backend && <TabButton id="ranks" label="Circle" tab={tab} onTab={setTab} icon="ranks" />}
          <TabButton id="me" label="Me" tab={tab} onTab={setTab} icon="me" />
        </nav>
      )}
    </main>
    </ThemeContext.Provider>
  )
}

function TabButton({ id, label, tab, onTab, icon }: { id: Tab; label: string; tab: Tab; onTab(t: Tab): void; icon: IconName }) {
  return (
    <button className={tab === id ? 'on' : ''} onClick={() => onTab(id)} aria-current={tab === id ? 'page' : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  )
}
