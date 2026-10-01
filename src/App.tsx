import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createBackend, isDemo, NoAccessError, type Backend } from './backend'
import { Message, NoAccess, SignIn, Splash } from './components/Gates'
import { Leaderboard, LeaderboardSignIn } from './components/Leaderboard'
import { Me } from './components/Me'
import { Play } from './components/Play'
import { ProfileEditor } from './components/ProfileEditor'
import { ProgressView } from './components/ProgressView'
import { loadAestheticsData } from './data'
import { clearGuestProgress, loadGuestChoice, loadGuestProgress, saveGuestChoice, saveGuestProgress } from './lib/guest'
import { applyAnswer, mergeProgress, rankProfiles, statsOf, type ModeSetting } from './lib/quiz'
import { loadMode, saveMode } from './lib/settings'
import type { AestheticsData, AppUser, Profile, Progress } from './types'

type Tab = 'play' | 'progress' | 'ranks' | 'me'
type Status = 'loading' | 'noAccess' | 'error' | 'ready'

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
  const [profile, setProfile] = useState<Profile | null>(null)
  const [progress, setProgress] = useState<Progress>(() => (guest ? loadGuestProgress() : {}))
  const progressRef = useRef(progress)

  const [tab, setTab] = useState<Tab>('play')
  const [inRound, setInRound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [mode, setMode] = useState<ModeSetting>(loadMode)
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
        let prog = remote
        const guestProgress = loadGuestProgress()
        const carried = Object.keys(guestProgress).length > 0
        if (carried) {
          prog = mergeProgress(remote, guestProgress)
          await backend.saveProgress(user.uid, prog)
          clearGuestProgress()
        }
        let p = await backend.loadProfile(user.uid)
        if (p && carried) {
          const stats = statsOf(prog)
          await backend.saveProfile(user.uid, { nickname: p.nickname, avatar: p.avatar, ...stats })
          p = { ...p, ...stats }
        }
        if (cancelled) return
        saveGuestChoice(false)
        setGuest(false)
        setAdmin(isAdmin)
        progressRef.current = prog
        setProgress(prog)
        setProfile(p)
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

  const onAnswer = useCallback(
    (id: string, correct: boolean) => {
      const prev = progressRef.current[id]
      const entry = applyAnswer(prev, correct, Date.now())
      const next = { ...progressRef.current, [id]: entry }
      progressRef.current = next
      setProgress(next)
      const stats = statsOf(next)
      if (backend && account) {
        setProfile((p) => p && { ...p, ...stats })
        backend.saveAnswer(account.uid, id, entry, stats).then(
          () => setSaveFailed(false),
          () => setSaveFailed(true),
        )
      } else {
        saveGuestProgress(next)
      }
      return entry.l && !prev?.l
    },
    [backend, account],
  )

  const listProfiles = useCallback(() => backend!.listProfiles(), [backend])

  const loadRank = useCallback(async () => {
    const ranked = rankProfiles(await backend!.listProfiles())
    const i = ranked.findIndex((p) => p.uid === account?.uid)
    return i < 0 ? null : { rank: i + 1, total: ranked.length }
  }, [backend, account])

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
  }

  const signOut = () => {
    resetView()
    setSession(null)
    setProfile(null)
    progressRef.current = {}
    setProgress({})
    backend?.signOut()
  }

  const playAsGuest = () => {
    if (account) backend?.signOut()
    resetView()
    saveGuestChoice(true)
    const p = loadGuestProgress()
    progressRef.current = p
    setProgress(p)
    setGuest(true)
  }

  const saveProfile = async (nickname: string, avatar: string) => {
    const stats = statsOf(progressRef.current)
    await backend!.saveProfile(account!.uid, { nickname, avatar, ...stats })
    setProfile({ uid: account!.uid, nickname, avatar, ...stats })
    setEditing(false)
  }

  const changeMode = (m: ModeSetting) => {
    setMode(m)
    saveMode(m)
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
    if (!profile || editing) {
      return (
        <main className="app">
          <ProfileEditor
            aesthetics={aesthetics}
            initialNickname={profile?.nickname ?? (account.name.split(' ')[0] || account.email.split('@')[0])}
            initialAvatar={profile?.avatar ?? randomAvatar}
            heading={profile ? 'Edit profile' : 'Welcome!'}
            intro={profile ? undefined : 'Pick a nickname and an aesthetic as your avatar. Friends see them on the leaderboard.'}
            saveLabel={profile ? 'Save' : "Let's go"}
            onSave={saveProfile}
            onCancel={profile ? () => setEditing(false) : undefined}
          />
        </main>
      )
    }
  } else if (!guest) {
    return <SignIn onSignIn={backend ? signIn : undefined} onGuest={playAsGuest} error={signInError} />
  }

  const signedIn = account && profile ? { user: account, profile } : null
  const showRanks = Boolean(backend)

  return (
    <main className={`app ${inRound ? 'in-round' : 'has-tabs'}`}>
      {isDemo && !inRound && <p className="demo-banner">Demo mode: data stays in this browser</p>}
      {saveFailed && <p className="notice notice-top">Couldn't save your last answer. Check your connection.</p>}

      {tab === 'play' && (
        <Play
          aesthetics={aesthetics}
          progress={progress}
          mode={mode}
          nickname={signedIn?.profile.nickname}
          onAnswer={onAnswer}
          loadRank={signedIn ? loadRank : undefined}
          onRoundActive={setInRound}
        />
      )}
      {tab === 'progress' && <ProgressView aesthetics={aesthetics} progress={progress} />}
      {tab === 'ranks' &&
        (signedIn ? (
          <Leaderboard byId={byId} total={aesthetics.length} me={signedIn.user.uid} load={listProfiles} />
        ) : (
          <LeaderboardSignIn onSignIn={signIn} error={signInError} />
        ))}
      {tab === 'me' && (
        <Me
          account={
            signedIn && backend
              ? {
                  ...signedIn,
                  avatar: byId.get(signedIn.profile.avatar),
                  admin,
                  backend,
                  onEditProfile: () => setEditing(true),
                  onSignOut: signOut,
                }
              : null
          }
          onSignIn={backend ? signIn : undefined}
          mode={mode}
          onMode={changeMode}
        />
      )}

      {!inRound && (
        <nav className="tabbar">
          <TabButton id="play" label="Play" tab={tab} onTab={setTab} icon={<path d="M8 5.5v13l11-6.5z" />} />
          <TabButton id="progress" label="Progress" tab={tab} onTab={setTab} icon={<path d="M5 19V11M12 19V5M19 19v-5" />} />
          {showRanks && (
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
