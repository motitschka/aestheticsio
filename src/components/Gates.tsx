import type { ReactNode } from 'react'

function Screen({ children }: { children: ReactNode }) {
  return <main className="gate">{children}</main>
}

export function Splash({ text = 'Loading…' }: { text?: string }) {
  return (
    <Screen>
      <p className="muted">{text}</p>
    </Screen>
  )
}

interface SignInProps {
  /** Undefined when sign-in isn't set up (guest-only site). */
  onSignIn?(): void
  onGuest(): void
  error: string | null
}

export function SignIn({ onSignIn, onGuest, error }: SignInProps) {
  return (
    <Screen>
      <p className="eyebrow">Aesthetic Learner</p>
      <h1 className="display gate-title">Learn to see every design aesthetic.</h1>
      <p className="muted">From Art Deco to Y2K: 173 aesthetics from the Aesthetics Wiki, one quick round at a time.</p>
      {onSignIn && (
        <button className="btn btn-primary btn-big" onClick={onSignIn}>
          Continue with Google
        </button>
      )}
      <button className={`btn btn-big ${onSignIn ? 'btn-secondary' : 'btn-primary'}`} onClick={onGuest}>
        Play without signing in
      </button>
      {error && <p className="notice">{error}</p>}
      <p className="muted small">
        {onSignIn
          ? 'Signing in is invite only: it syncs your progress and puts you on the leaderboard. Guests keep progress on this device.'
          : 'Your progress is saved on this device.'}
      </p>
    </Screen>
  )
}

export function NoAccess({ email, onSignOut, onGuest }: { email: string; onSignOut(): void; onGuest(): void }) {
  return (
    <Screen>
      <h1 className="title">You're not on the list yet</h1>
      <p className="muted">
        You're signed in as <strong>{email}</strong>. Ask the owner to add this address, then come back. Until then you can
        play as a guest.
      </p>
      <button className="btn btn-primary" onClick={onGuest}>
        Play as a guest
      </button>
      <button className="btn btn-ghost" onClick={onSignOut}>
        Use a different account
      </button>
    </Screen>
  )
}

export function Message({ title, text, action }: { title: string; text: ReactNode; action?: ReactNode }) {
  return (
    <Screen>
      <h1 className="title">{title}</h1>
      <p className="muted">{text}</p>
      {action}
    </Screen>
  )
}
