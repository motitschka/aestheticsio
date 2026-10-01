// The intro's music, kept in step with its timeline: an opening (music-a), a seamless
// loop while the quiz waits for an answer (music-loop), then the rest (music-b), plus a
// chime for the answer. Browsers only allow sound after a tap, so nothing loads or
// plays until "Sound on".

const FILES = ['music-a', 'music-loop', 'music-b', 'chime-right', 'chime-wrong'] as const
type Clip = (typeof FILES)[number]

/** Where the timeline is: before the quiz waits, waiting for an answer, or after it. */
export type MusicPosition = { phase: 'a'; t: number } | { phase: 'loop'; t: number } | { phase: 'b'; t: number }

export class IntroMusic {
  private ctx: AudioContext | null = null
  private gain: GainNode | null = null
  private buffers: Partial<Record<Clip, AudioBuffer>> = {}
  private playing: AudioBufferSourceNode[] = []
  private loading: Promise<void> | null = null
  private readonly base: string
  /** Length of the opening; the loop starts where it ends. */
  private readonly openingLength: number
  /** The loop's musical length (the decoded file can carry a few ms of encoder padding). */
  private readonly loopLength: number

  constructor(base: string, openingLength: number, loopLength: number) {
    this.base = base
    this.openingLength = openingLength
    this.loopLength = loopLength
  }

  /** Called from the Sound on tap. Starts the music at the timeline's position. */
  async start(position: () => MusicPosition) {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.gain = this.ctx.createGain()
      this.gain.connect(this.ctx.destination)
    }
    await this.ctx.resume()
    this.loading ??= this.load()
    await this.loading
    this.fadeTo(1, 0.25)
    this.play(position())
  }

  mute() {
    this.fadeTo(0, 0.2)
  }

  /** The quiz was answered: leave the opening or the loop for the rest, with its chime. */
  answer(correct: boolean) {
    if (!this.ctx || !this.buffers['music-b']) return
    this.play({ phase: 'b', t: 0 })
    this.source(correct ? 'chime-right' : 'chime-wrong', this.ctx.currentTime, 0)
  }

  pause() {
    void this.ctx?.suspend()
  }

  resume() {
    void this.ctx?.resume()
  }

  stop() {
    if (!this.ctx) return
    this.fadeTo(0, 0.35)
    const ctx = this.ctx
    window.setTimeout(() => void ctx.close(), 450)
    this.ctx = null
  }

  private async load() {
    const ctx = this.ctx!
    await Promise.all(
      FILES.map(async (f) => {
        const res = await fetch(`${this.base}${f}.mp3`)
        this.buffers[f] = await ctx.decodeAudioData(await res.arrayBuffer())
      }),
    )
  }

  private play(pos: MusicPosition) {
    const ctx = this.ctx!
    const now = ctx.currentTime + 0.03
    // A short crossfade, so moving from the opening or the loop to the rest never clicks.
    for (const s of this.playing) {
      const g = (s as AudioBufferSourceNode & { out?: GainNode }).out
      g?.gain.setTargetAtTime(0, now, 0.03)
      s.stop(now + 0.2)
    }
    this.playing = []
    const loopLength = this.loopLength
    if (pos.phase === 'a') {
      this.source('music-a', now, pos.t)
      this.source('music-loop', now + Math.max(0, this.openingLength - pos.t), 0, true)
    } else if (pos.phase === 'loop') {
      this.source('music-loop', now, pos.t % loopLength, true)
    } else {
      this.source('music-b', now, pos.t)
    }
  }

  private source(clip: Clip, when: number, offset: number, loop = false) {
    const ctx = this.ctx!
    const buffer = this.buffers[clip]
    if (!buffer || (!loop && offset >= buffer.duration)) return
    const s = ctx.createBufferSource() as AudioBufferSourceNode & { out?: GainNode }
    s.buffer = buffer
    s.loop = loop
    if (loop) {
      s.loopStart = 0
      s.loopEnd = Math.min(this.loopLength, buffer.duration)
    }
    const g = ctx.createGain()
    s.connect(g).connect(this.gain!)
    s.out = g
    s.start(when, offset)
    if (!clip.startsWith('chime')) this.playing.push(s)
  }

  private fadeTo(v: number, seconds: number) {
    if (!this.ctx || !this.gain) return
    const now = this.ctx.currentTime
    this.gain.gain.cancelScheduledValues(now)
    this.gain.gain.setValueAtTime(this.gain.gain.value, now)
    this.gain.gain.linearRampToValueAtTime(v, now + seconds)
  }
}
