import { useState } from 'react'
import { SIZE } from '../lib/images'
import type { Aesthetic } from '../types'
import { Avatar } from './Avatar'
import { Photo } from './Photo'

export const NICKNAME_MAX = 24

interface Props {
  aesthetics: Aesthetic[]
  initialNickname: string
  initialAvatar: string
  heading: string
  intro?: string
  saveLabel: string
  onSave(nickname: string, avatar: string): Promise<void>
  onCancel?(): void
}

export function ProfileEditor({ aesthetics, initialNickname, initialAvatar, heading, intro, saveLabel, onSave, onCancel }: Props) {
  const [nickname, setNickname] = useState(initialNickname.slice(0, NICKNAME_MAX))
  const [avatar, setAvatar] = useState(initialAvatar)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosen = aesthetics.find((a) => a.id === avatar)
  const q = query.trim().toLowerCase()
  const shown = q ? aesthetics.filter((a) => a.name.toLowerCase().includes(q)) : aesthetics
  const name = nickname.trim()

  const save = async () => {
    if (!name) return setError('Pick a nickname.')
    setSaving(true)
    setError(null)
    try {
      await onSave(name, avatar)
    } catch {
      setError("Couldn't save. Check your connection and try again.")
      setSaving(false)
    }
  }

  return (
    <section className="page editor">
      <h1 className="title">{heading}</h1>
      {intro && <p className="muted">{intro}</p>}

      <div className="editor-preview">
        <Avatar aesthetic={chosen} nickname={name} size={88} />
        <div>
          <strong>{name || 'Your nickname'}</strong>
          <p className="muted small">{chosen ? `Avatar: ${chosen.name}` : 'Pick an avatar below'}</p>
        </div>
      </div>

      <label className="field">
        <span>Nickname</span>
        <input className="input" value={nickname} maxLength={NICKNAME_MAX} onChange={(e) => setNickname(e.target.value)} autoComplete="nickname" />
      </label>

      <div className="field">
        <span>Avatar: pick an aesthetic</span>
        <input className="input" type="search" placeholder="Search aesthetics" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="avatar-grid">
        {shown.map((a) => (
          <button key={a.id} className={`avatar-option ${a.id === avatar ? 'on' : ''}`} onClick={() => setAvatar(a.id)} aria-pressed={a.id === avatar} title={a.name}>
            <span className="avatar">
              <Photo src={a.images[0]} width={SIZE.small} alt="" lazy />
            </span>
            <span className="avatar-name">{a.name}</span>
          </button>
        ))}
      </div>

      <div className="sticky-actions">
        {error && <p className="notice">{error}</p>}
        <button className="btn btn-primary btn-big" onClick={save} disabled={saving || !name}>
          {saving ? 'Saving…' : saveLabel}
        </button>
        {onCancel && (
          <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </div>
    </section>
  )
}
