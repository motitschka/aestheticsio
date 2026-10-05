import { Component, type ReactNode } from 'react'
import { applyTheme } from '../lib/theme'
import { Message } from './Gates'

/** A crash shows a way back instead of a blank page. Progress is saved as it happens, so nothing is lost. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
    // A broken theme shouldn't keep the error screen unreadable.
    applyTheme(null)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <Message
        title="Something went wrong"
        text="Your progress is saved. Reload to carry on."
        action={
          <button className="btn btn-primary" onClick={() => location.reload()}>
            Reload
          </button>
        }
      />
    )
  }
}
