import { LESSON_LABEL, type LessonState } from '../lib/progress'

export function StateBadge({ state }: { state: LessonState }) {
  return <span className={`badge state-${state}`}>{LESSON_LABEL[state]}</span>
}
