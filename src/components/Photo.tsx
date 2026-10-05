import { useState } from 'react'
import { thumb } from '../lib/images'

interface Props {
  src: string
  width: number
  alt: string
  fit?: 'cover' | 'contain'
  lazy?: boolean
  className?: string
  /** Called if the image fails to load (questions then don't count it against anyone). */
  onFail?(): void
}

export function Photo({ src, width, alt, fit = 'cover', lazy = false, className = '', onFail }: Props) {
  const [status, setStatus] = useState({ src, state: 'loading' as 'loading' | 'ok' | 'error' })
  const state = status.src === src ? status.state : 'loading'

  return (
    <div className={`photo photo-${state} ${className}`}>
      {state === 'error' ? (
        <span className="photo-error">Image unavailable</span>
      ) : (
        <img
          src={thumb(src, width)}
          alt={alt}
          loading={lazy ? 'lazy' : 'eager'}
          decoding="async"
          draggable={false}
          style={{ objectFit: fit }}
          onLoad={() => setStatus({ src, state: 'ok' })}
          onError={() => {
            setStatus({ src, state: 'error' })
            onFail?.()
          }}
        />
      )}
    </div>
  )
}
