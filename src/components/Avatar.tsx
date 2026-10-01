import { SIZE } from '../lib/images'
import type { Aesthetic } from '../types'
import { Photo } from './Photo'

interface Props {
  aesthetic: Aesthetic | undefined
  nickname: string
  size?: number
}

export function Avatar({ aesthetic, nickname, size = 40 }: Props) {
  const style = { width: size, height: size }
  if (!aesthetic) {
    return (
      <span className="avatar avatar-letter" style={{ ...style, fontSize: size * 0.45 }}>
        {nickname.slice(0, 1).toUpperCase() || '?'}
      </span>
    )
  }
  return (
    <span className="avatar" style={style} title={aesthetic.name}>
      <Photo src={aesthetic.images[0]} width={SIZE.small} alt="" lazy />
    </span>
  )
}
