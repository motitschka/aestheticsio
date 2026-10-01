import type { ChallengeOutcome } from '../components/Challenge'
import { Backdrop } from '../components/Backdrop'
import { Icon, type IconName } from '../components/Icon'
import { Done, InfoView } from '../components/Lesson'
import { Play } from '../components/Play'
import { QuestionView } from '../components/QuestionView'
import type { ChoiceQuestion, InfoCard } from '../lib/questions'
import type { Theme } from '../lib/theme'
import { ThemeContext } from '../lib/theme-context'
import type { Aesthetic, SavedProgress } from '../types'

/** What the intro's phone screen shows. Everything in it is the app's own components. */
export type Scene =
  | { k: 'quiz'; question: ChoiceQuestion }
  | { k: 'lesson'; card: InfoCard; step: number; of: number }
  | { k: 'done'; themeInUse: boolean }
  | { k: 'home' }

export interface ScreenProps {
  scene: Scene
  /** The theme on the screen (already applied to the frame's root). */
  theme: Theme | null
  /** Frutiger Aero, the aesthetic the intro follows. */
  a: Aesthetic
  all: Aesthetic[]
  byId: Map<string, Aesthetic>
  saved: SavedProgress
  /** A fixed clock for the app's screens. */
  now: number
  themeFor: Theme | undefined
  onAnswer(correct: boolean): void
  onUseTheme(): void
}

const noop = () => {}
const noOutcome = (): ChallengeOutcome => ({ records: [], newBadges: [] })

export function IntroScreen({ scene, theme, a, all, byId, saved, now, themeFor, onAnswer, onUseTheme }: ScreenProps) {
  const inRound = scene.k !== 'home'
  return (
    <ThemeContext.Provider value={theme}>
      <main className={`app ${inRound ? 'in-round' : 'has-tabs'}`}>
        {theme && <Backdrop theme={theme} />}
        {scene.k === 'quiz' && (
          // The quiz screen of a practice round, as PracticeRound draws it.
          <section className="page quiz">
            <div className="quiz-top">
              <button className="icon-btn" tabIndex={-1} aria-hidden>
                ✕
              </button>
              <div className="bar bar-thin" aria-hidden>
                <div className="bar-fill" style={{ width: '0%' }} />
              </div>
              <span className="muted small tabular">1/10</span>
            </div>
            <QuestionView question={scene.question} onAnswer={onAnswer} onNext={noop} autoAdvanceMs={600000} keys={false} />
          </section>
        )}
        {scene.k === 'lesson' && (
          <div className="lesson-screen">
            <LessonTop a={a} />
            <section className="page lesson" key={scene.card}>
              <div className="bar bar-thin" aria-hidden>
                <div className="bar-fill" style={{ width: `${(scene.step / scene.of) * 100}%` }} />
              </div>
              <InfoView card={scene.card} a={a} byId={byId} />
              <button className="btn btn-primary btn-big" data-intro="continue" tabIndex={-1}>
                Continue
              </button>
            </section>
          </div>
        )}
        {scene.k === 'done' && (
          <div className="lesson-screen">
            <LessonTop a={a} />
            <Done
              a={a}
              format="full"
              perfect
              before="new"
              after="learned"
              unlocked
              theme={themeFor}
              themeInUse={scene.themeInUse}
              onUseTheme={onUseTheme}
              onAgain={noop}
              onClose={noop}
            />
          </div>
        )}
        {scene.k === 'home' && (
          <>
            {/* Remounts on a new theme, so its entrance motion plays like a real switch. */}
            <Play
              key={theme?.id ?? 'default'}
              all={all}
              byId={byId}
              saved={saved}
              now={now}
              onPractice={() => false}
              onChallengeEnd={noOutcome}
              onLesson={noop}
              onRoundActive={noop}
            />
            <nav className="tabbar">
              <Tab icon="play" label="Play" on />
              <Tab icon="lessons" label="Lessons" />
              <Tab icon="me" label="Me" />
            </nav>
          </>
        )}
      </main>
    </ThemeContext.Provider>
  )
}

function LessonTop({ a }: { a: Aesthetic }) {
  return (
    <div className="lesson-top">
      <button className="icon-btn" tabIndex={-1} aria-hidden>
        ✕
      </button>
      <span className="lesson-title">{a.name}</span>
    </div>
  )
}

function Tab({ icon, label, on }: { icon: IconName; label: string; on?: boolean }) {
  return (
    <button className={on ? 'on' : ''} tabIndex={-1}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  )
}
