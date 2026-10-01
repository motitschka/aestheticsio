import type { Backend } from '../backend'
import type { ModeSetting } from '../lib/quiz'
import type { Aesthetic, AppUser, Profile } from '../types'
import { AllowlistEditor } from './Admin'
import { Avatar } from './Avatar'

const MODES: { id: ModeSetting; label: string }[] = [
  { id: 'mixed', label: 'Mixed' },
  { id: 'image-to-name', label: 'Image → name' },
  { id: 'name-to-image', label: 'Name → image' },
]

interface Props {
  /** Signed-in account; null when playing as a guest. */
  account: {
    user: AppUser
    profile: Profile
    avatar: Aesthetic | undefined
    admin: boolean
    backend: Backend
    onEditProfile(): void
    onSignOut(): void
  } | null
  /** Shown to guests when sign-in is available. */
  onSignIn?(): void
  mode: ModeSetting
  onMode(m: ModeSetting): void
}

export function Me({ account, onSignIn, mode, onMode }: Props) {
  return (
    <section className="page">
      {account ? (
        <div className="card profile-card">
          <Avatar aesthetic={account.avatar} nickname={account.profile.nickname} size={72} />
          <div className="row-main">
            <strong className="profile-name">{account.profile.nickname}</strong>
            <span className="muted small">{account.user.email}</span>
          </div>
          <button className="btn btn-secondary btn-small" onClick={account.onEditProfile}>
            Edit
          </button>
        </div>
      ) : (
        <div className="card">
          <h2>Playing as a guest</h2>
          <p className="muted small">Your progress is saved in this browser only.</p>
          {onSignIn && (
            <>
              <p className="muted small">
                Sign in with Google to sync it across devices and join the leaderboard. Your guest progress comes with you. (Invite only.)
              </p>
              <button className="btn btn-primary" onClick={onSignIn}>
                Sign in with Google
              </button>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h2>Question type</h2>
        <div className="segmented" role="radiogroup">
          {MODES.map((m) => (
            <button key={m.id} role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => onMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <p className="muted small">Saved on this device.</p>
      </div>

      {account?.admin && (
        <>
          <h2 className="section-title">Owner</h2>
          <AllowlistEditor backend={account.backend} />
        </>
      )}

      {account && (
        <button className="btn btn-ghost" onClick={account.onSignOut}>
          Sign out
        </button>
      )}

      <p className="credits muted small">
        Aesthetic names and images come from the{' '}
        <a href="https://aesthetics.fandom.com/wiki/Category:Design_Aesthetics" target="_blank" rel="noreferrer">
          Aesthetics Wiki
        </a>{' '}
        (text CC BY-SA). Images belong to their respective owners and load directly from the wiki.
      </p>
    </section>
  )
}
