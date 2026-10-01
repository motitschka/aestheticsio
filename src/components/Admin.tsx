import { useEffect, useState, type FormEvent } from 'react'
import type { Backend } from '../backend'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function AllowlistEditor({ backend }: { backend: Backend }) {
  const [emails, setEmails] = useState<string[] | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    backend.getAllowlist().then(setEmails, () => setError("Couldn't load the allowlist."))
  }, [backend])

  const save = async (next: string[]) => {
    const prev = emails
    setEmails(next)
    setError(null)
    try {
      await backend.setAllowlist(next)
    } catch {
      setEmails(prev)
      setError("Couldn't save. Try again.")
    }
  }

  const add = (e: FormEvent) => {
    e.preventDefault()
    const email = draft.trim().toLowerCase()
    if (!EMAIL.test(email)) return setError('That doesn’t look like an email address.')
    if (emails?.includes(email)) return setError('Already on the list.')
    setDraft('')
    save([...(emails ?? []), email].sort())
  }

  return (
    <div className="card">
      <h2>Who can sign in</h2>
      <p className="muted small">Add the Google account email of each friend. You always have access as the owner.</p>
      <form className="inline-form" onSubmit={add}>
        <input className="input" type="email" placeholder="friend@gmail.com" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn btn-primary" disabled={!emails}>
          Add
        </button>
      </form>
      {error && <p className="notice">{error}</p>}
      {emails && emails.length === 0 && <p className="muted small">Nobody else yet.</p>}
      <ul className="plain-list">
        {emails?.map((email) => (
          <li key={email}>
            <span>{email}</span>
            <button className="btn btn-ghost btn-small" onClick={() => save(emails.filter((x) => x !== email))}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
