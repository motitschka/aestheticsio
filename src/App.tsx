import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createBackend, isDemo, NoAccessError, type Backend } from './backend'
import type { ProgressPatch } from './backend/types'
import type { ChallengeOutcome } from './components/Challenge'
import { Message, NoAccess, SignIn, Splash } from './components/Gates'
import { Leaderboard, LeaderboardSignIn } from './components/Leaderboard'
import { Lesson } from './components/Lesson'
import { Me } from './components/Me'
import { Play } from './components/Play'
import { ProfileEditor } from './components/ProfileEditor'
import { ProgressView } from './components/ProgressView'
import { loadAestheticsData } from './data'
import { formatTime } from './lib/format'
import { clearGuestProgress, hasGuestProgress, loadGuestChoice, loadGuestProgress, saveGuestChoice, saveGuestProgress } from './lib/guest'
import {
  applyChallenge,
  applyLesson,
  applyPractice,
  earnedBadges,
  emptyStats,
  lessonState,
  mergeSaved,
  MILESTONES,
  profileFrom,
  rankByStreak,
  recognised,
  type Milestone,
} from './lib/progress'
import type { Question } from './lib/questions'
import type { AestheticsData, AppUser, PracticeMode, SavedProgress } from './types'

type Tab = 'play' | 'progress' | 'ranks' | 'me'
type Status = 'loading' | 'noAccess' | 'error' | 'ready'
type Identity = { nickname: string; avatar: string }

const emptySaved = (): SavedProgress => ({ items: {}, stats: emptyStats() })

export default function App() {
  const [data, setData] = useState<AestheticsData | null>(null)
  const [dataFailed, setDataFailed] = useState(false)
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
  const [now, setNow] = useState(Date.now)

  const [tab, setTab] = useState<Tab>('play')
  const [inRound, setInRound] = useState(false)
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    loadAestheticsData().then(setData, () => setDataFailed(true))
    createBackend().then(setBackend, () => setBackend(null))
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
        const guestProgress = loadGuestProgress()
        const carried = hasGuestProgress(guestProgress)
        if (carried) {
          progress = mergeSaved(remote, guestProgress)
          await backend.saveProgress(user.uid, progress, null)
          clearGuestProgress()
        }
        const p = await backend.loadProfile(user.uid)
        if (p && carried) await backend.saveProfile(profileFrom(p, progress))
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

  const aesthetics = useMemo(() => data?.items ?? [], [data])
  const byId = useMemo(() => new Map(aesthetics.map((a) => [a.id, a])), [aesthetics])
  const [avatarSeed] = useState(Math.random)
  const randomAvatar = aesthetics[Math.floor(avatarSeed * aesthetics.length)]?.id ?? ''
  const status: Status = session && account && session.uid === account.uid ? session.status : 'loading'
  const profile = useMemo(() => (account && identity ? profileFrom({ uid: account.uid, ...identity }, saved) : null), [account, identity, saved])

  /** Applies a change locally and saves it (account or this browser). */
  const commit = useCallback(
    (next: SavedProgress, patch: ProgressPatch) => {
      savedRef.current = next
      setSaved(next)
      setNow(Date.now())
      if (backend && account) {
        if (!identity) return
        backend.saveProgress(account.uid, patch, profileFrom({ uid: account.uid, ...identity }, next)).then(
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
    (id: string, perfect: boolean) => {
      const s = savedRef.current
      const t = Date.now()
      const prev = s.items[id]
      const entry = applyLesson(prev, perfect, t)
      commit({ ...s, items: { ...s.items, [id]: entry } }, { items: { [id]: entry } })
      return { before: lessonState(prev, t), after: lessonState(entry, t) }
    },
    [commit],
  )

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

  const saveProfile = async (nickname: string, avatar: string) => {
    const next = profileFrom({ uid: account!.uid, nickname, avatar }, savedRef.current)
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
    <main className={`app ${showTabs ? 'has-tabs' : 'in-round'}`}>
      {lesson && (
        <Lesson
          key={lesson.id}
          aesthetic={lesson}
          all={aesthetics}
          byId={byId}
          entry={saved.items[lesson.id]}
          state={lessonState(saved.items[lesson.id], now)}
          onFinish={(perfect) => recordLesson(lesson.id, perfect)}
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
          />
        </div>
        {tab === 'progress' && <ProgressView aesthetics={aesthetics} items={saved.items} now={now} onLesson={openLesson} />}
        {tab === 'ranks' &&
          (profile ? <Leaderboard byId={byId} total={aesthetics.length} me={profile.uid} load={listProfiles} /> : <LeaderboardSignIn onSignIn={signIn} error={signInError} />)}
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
          />
        )}
      </div>

      {showTabs && (
        <nav className="tabbar">
          <TabButton id="play" label="Play" tab={tab} onTab={setTab} icon={<path d="M8 5.5v13l11-6.5z" />} />
          <TabButton id="progress" label="Lessons" tab={tab} onTab={setTab} icon={<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />} />
          {backend && (
            <TabButton id="ranks" label="Leaderboard" tab={tab} onTab={setTab} icon={<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />} />
          )}
          <TabButton id="me" label="Me" tab={tab} onTab={setTab} icon={<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />} />
        </nav>
      )}
    </main>
  )
}

function TabButton({ id, label, tab, onTab, icon }: { id: Tab; label: string; tab: Tab; onTab(t: Tab): void; icon: ReactNode }) {
  return (
    <button className={tab === id ? 'on' : ''} onClick={() => onTab(id)} aria-current={tab === id ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {icon}
      </svg>
      <span>{label}</span>
    </button>
  )
}
