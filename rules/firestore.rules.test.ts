// Security rules tests. Needs Java 21+ for the Firestore emulator:
//   npm run test:rules
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const OWNER = 'owner@example.com'
const FRIEND = 'friend@example.com'

let env: RulesTestEnvironment

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8').replace(
  /(function adminEmail\(\) \{\s*return ')[^']*(';)/,
  `$1${OWNER}$2`,
)

const as = (uid: string, email: string, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore()

const owner = () => as('owner', OWNER)
const friend = () => as('friend', FRIEND)
const stranger = () => as('stranger', 'stranger@example.com')

const profile = { nickname: 'Fr', avatar: 'art-deco', lessonPoints: 3, bestStreak: 12, best25: 170000, correct: 3, answered: 4 }

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-aesthetics', firestore: { rules, host: '127.0.0.1', port: 8080 } })
})

afterAll(() => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'config/allowlist'), { emails: [FRIEND] })
    await setDoc(doc(db, 'profiles/other'), { ...profile, nickname: 'Other' })
    await setDoc(doc(db, 'progress/other'), { items: {} })
  })
})

describe('strangers', () => {
  it('signed out: nothing', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDocs(collection(db, 'profiles')))
    await assertFails(getDoc(doc(db, 'progress/other')))
  })

  it('signed in but not allowlisted: nothing', async () => {
    const db = stranger()
    await assertFails(getDocs(collection(db, 'profiles')))
    await assertFails(getDoc(doc(db, 'progress/stranger')))
    await assertFails(setDoc(doc(db, 'progress/stranger'), { items: {} }))
    await assertFails(setDoc(doc(db, 'profiles/stranger'), profile))
  })

  it('unverified email on the allowlist: nothing', async () => {
    await assertFails(getDoc(doc(as('friend', FRIEND, false), 'progress/friend')))
  })
})

describe('allowlisted friends', () => {
  it('read the leaderboard', async () => {
    await assertSucceeds(getDocs(collection(friend(), 'profiles')))
  })

  it('email match ignores case', async () => {
    await assertSucceeds(getDoc(doc(as('friend', 'Friend@Example.com'), 'progress/friend')))
  })

  it('write their own progress and profile', async () => {
    await assertSucceeds(setDoc(doc(friend(), 'progress/friend'), { items: { 'art-deco': { s: 1, l: false, c: 1, w: 0, t: 1 } } }))
    await assertSucceeds(getDoc(doc(friend(), 'progress/friend')))
    await assertSucceeds(setDoc(doc(friend(), 'profiles/friend'), profile))
    const { best25: _, ...noTimes } = profile
    await assertSucceeds(setDoc(doc(friend(), 'profiles/friend'), noTimes))
  })

  it("can't touch someone else's progress or profile", async () => {
    await assertFails(getDoc(doc(friend(), 'progress/other')))
    await assertFails(setDoc(doc(friend(), 'progress/other'), { items: {} }))
    await assertFails(setDoc(doc(friend(), 'profiles/other'), profile))
  })

  it('invalid profiles are rejected', async () => {
    const db = friend()
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, nickname: '' }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, nickname: 'x'.repeat(25) }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, correct: 5, answered: 4 }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, isAdmin: true }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, lessonPoints: 1.5 }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, best25: 0 }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, learned: 3 }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, lessonPoints: 1000 }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, best25: 5000 }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, bestStreak: 100000 }))
  })

  const journey = {
    lessonPoints: 31,
    eras: [17, 12, 2, 0, 0, 0, 0, 0],
    dayStreak: 12,
    goalDay: '2026-10-05',
    freezes: 1,
    recent: [
      { k: 'learned', id: 'atomic-age', t: 1 },
      { k: 'era', e: 1, t: 2 },
    ],
  }

  it('profiles can carry the journey: era progress, day streak and recent moments', async () => {
    await assertSucceeds(setDoc(doc(friend(), 'profiles/friend'), { ...profile, ...journey }))
  })

  it('journey fields are checked', async () => {
    const db = friend()
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, ...journey, eras: [1, 2, 3] }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, ...journey, eras: [1, 2, 3, 4, 5, 6, 7, 'x'] }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, ...journey, eras: [99, 0, 0, 0, 0, 0, 0, 0] }))
    // era totals have to agree with lessonPoints (learned 1, mastered 2)
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, ...journey, eras: [60, 60, 60, 60, 60, 60, 60, 60] }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, ...journey, lessonPoints: 0 }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, ...journey, lessonPoints: 63 }))
    await assertSucceeds(setDoc(doc(db, 'profiles/friend'), { ...profile, ...journey, lessonPoints: 62 }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, ...journey, freezes: 3 }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, ...journey, dayStreak: -1 }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, ...journey, goalDay: 'yesterday' }))
    await assertFails(setDoc(doc(db, 'profiles/friend'), { ...profile, ...journey, recent: Array(7).fill({ k: 'era', e: 0, t: 1 }) }))
  })

  it('the journey is stored next to the old record, which stays as the backup', async () => {
    const db = friend()
    await assertSucceeds(setDoc(doc(db, 'progress/friend'), { items: { 'art-deco': { lt: 2, c: 0, w: 0, t: 1 } }, stats: { bestStreak: 3 } }))
    await assertSucceeds(setDoc(doc(db, 'progress/friend'), { journey: { items: {}, stats: { v: 2, journeyNote: 1 } } }, { merge: true }))
  })

  it("can't read or change the allowlist", async () => {
    await assertFails(getDoc(doc(friend(), 'config/allowlist')))
    await assertFails(setDoc(doc(friend(), 'config/allowlist'), { emails: [FRIEND, 'x@example.com'] }))
  })
})

describe('everything else', () => {
  it('unknown collections are denied, even for the owner', async () => {
    await assertFails(getDoc(doc(owner(), 'content/aesthetics')))
    await assertFails(setDoc(doc(owner(), 'content/aesthetics'), { items: [] }))
  })
})

describe('owner', () => {
  it('has access without being on the allowlist', async () => {
    await assertSucceeds(getDoc(doc(owner(), 'progress/owner')))
    await assertSucceeds(getDocs(collection(owner(), 'profiles')))
  })

  it('manages the allowlist', async () => {
    await assertSucceeds(getDoc(doc(owner(), 'config/allowlist')))
    await assertSucceeds(setDoc(doc(owner(), 'config/allowlist'), { emails: [FRIEND, 'new@example.com'] }))
  })

  it("still can't read other people's progress", async () => {
    await assertFails(getDoc(doc(owner(), 'progress/other')))
  })
})
