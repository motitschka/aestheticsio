# Aesthetic Learner

A phone-friendly app for learning every design aesthetic in
[Category:Design Aesthetics](https://aesthetics.fandom.com/wiki/Category:Design_Aesthetics)
on the Aesthetics Wiki.

**Play it:** https://motitschka.github.io/aestheticsio/

- **A journey through time:** the 174 aesthetics are grouped into eight eras
  (before 1900, 1900–1945, 1945–1970, the 70s, 80s, 90s, 2000s, 2010s and now;
  `src/lib/eras.ts`), and the next lesson walks them oldest first. Every era is
  open; Play and Lessons show how far you are in each. Learning all 174 finishes
  the journey; mastering them is the next lap.
- **Lessons:** one per aesthetic, built from the wiki (intro, gallery, motifs,
  colours, decade, values, related aesthetics) with checks in between, all about
  telling it apart from its close relatives on images the lesson hasn't shown (the
  aesthetic's board pins): spot it among its relatives, find the odd one out, say
  which of the relatives an image is, and pick its colours, motifs and decade
  against its relatives'. Missed checks come back at the end. After the first time
  you choose *info only* or *questions only*.
  - **Seen** = finished, **learned** = every check right in one go (unlocks the
    theme), **mastered** = perfect again at least 30 days later. Learned and
    mastered are never lost; a mistake only restarts the month before mastery.
- **Daily goal:** one lesson a day builds a day streak. A second lesson in a day
  banks a freeze (up to two), and a freeze covers a day you miss.
- **Practice modes** (rounds of 10): image → name, name → image, description → name,
  clues → name, tell them apart (related aesthetics), odd one out, timeline. An
  aesthetic is *recognised* in a mode after 3 right in a row there.
- **Mixed challenge:** every question type against the clock; one wrong answer ends
  the run. Play it endless, or as a 25, 50 or 100 sprint. Badges for 10/25/50/100 in
  a row and for 25/50/100 in under 3/6/12 minutes.
- **Themes:** learning a lesson unlocks that aesthetic's theme for the whole app.
  Each one is designed from a Pinterest moodboard of 10 pins and changes almost
  everything: colours (taken from the pins), display and body fonts, button and
  card shapes, a drawn pattern, motion, icons and layout (tab bar, rail, window
  chrome, zine, terminal…). Its pins show as a collage behind every screen, as a
  moodboard strip on Play, Lessons and Me, and framed beside scores. Lesson
  galleries and practice pictures come from the wiki; lesson checks use the pins.
  Pick one under **Me → Themes**.
- **Welcome intro:** the first visit opens with a live, interactive intro built from
  the app itself (`src/intro/`): a welcome on a wall of pins, then a real quiz the
  visitor answers ("Which aesthetic is this?", it waits for them), Frutiger Aero's
  lesson, its theme unlocking and taking over the app, then Clovercore, Corporate
  Grunge, Parisian Girly, Jiggy Era, Dollar Store Vernacular, Utopian Scholastic and
  Global Village Coffeehouse flashing past (each moving and sounding like itself), and
  a **Start learning** button that goes straight in as a guest. Music (in `public/intro/`) starts with **Sound on**; **Skip** is always
  there. It isn't shown with reduced motion or Save-Data, and can be replayed under
  **Me → Watch the intro**. A shareable video cut of it (no wiki photos) is rendered
  from the same code in dev with `?intro-video=portrait` or `landscape`.
- **On the home screen:** Share → Add to Home Screen gives an app icon (a pixel heart
  on the brand violet), the label "Aesthetics", and full-screen play.
- **Play without signing in:** guest progress is saved in the browser.
- **Or sign in with Google (invite only):** progress syncs across devices (live,
  and records never go backwards) and you join the circle: a feed of what friends
  just learned and which eras they finished, each friend's era progress and day
  streak, and the best-streak board. Guest progress comes with you the first time
  you sign in.
- **A missing picture never counts against you:** if an image doesn't load, the
  question can be skipped and an answer to it isn't scored.
- **Stack:** Vite + React + TypeScript on GitHub Pages; Firebase Auth (Google) and
  Firestore on the free Spark plan for sign-in, sync and the leaderboard. Wiki
  images load directly from Fandom; theme pins are served from `public/pins/`.

## Run it locally

```bash
npm install
npm run dev:demo
```

Demo mode fakes sign-in and keeps everything in your browser, with three fake
friends on the leaderboard. `npm run dev` uses your real Firebase config from
`.env.local` (or runs guest-only without it).

## Deploying

Every push to `main` runs `.github/workflows/deploy.yml`: tests, build, and publish
to GitHub Pages at `https://<user>.github.io/<repo>/`. Without Firebase config the
site is guest-only.

**Preview first:** the same deploy also builds the preview branch (repository
variable `PREVIEW_BRANCH`, default `pin-refresh-2kmumy`) in demo mode at
`https://<user>.github.io/<repo>/next/`. It never touches Firebase and keeps its own
browser storage, so it can be tried on a phone before friends see it. Pushing to the
preview branch rebuilds it (`.github/workflows/preview.yml`, which also runs lint,
tests and the build on every branch and pull request). Delete the branch and the
preview goes away with the next deploy.

**When the Firestore rules change** (as they did for the journey), deploy them:
`npm run set-admin -- you@gmail.com && npm run deploy:rules`, then undo the email
in `firestore.rules` (`git checkout firestore.rules`) so it isn't committed. Until
then the app keeps working with the old rules and just leaves out the new fields.

## Turning on sign-in (one time)

1. In the [Firebase console](https://console.firebase.google.com), create a project
   (no Google Analytics needed). It stays on the free Spark plan.
2. **Build → Authentication → Get started → Sign-in method → Google →** enable it.
   Then **Settings → Authorized domains → Add domain:** `<user>.github.io`.
3. **Build → Firestore Database → Create database** in production mode. Pick a
   location near you (e.g. `eur3`); it can't be changed later.
4. **Project settings → General → Your apps → Web (`</>`)**: register an app. Put
   the config values in two places:
   - `.env.local` (start from `.env.example`) for local development
   - GitHub repo **Settings → Secrets and variables → Actions → Variables**:
     `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
     `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`

   These identify the project and aren't secret; the Firestore rules protect the data.
5. Set yourself as the owner and deploy the security rules:

   ```bash
   npx firebase login
   npx firebase use --add
   npm run set-admin -- you@gmail.com
   npm run deploy:rules
   ```

6. Re-run the GitHub workflow (or push anything). Sign in on the site and add
   friends' Google emails under **Me → Owner**.

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server (uses `.env.local`) |
| `npm run dev:demo` | Local dev server with the in-browser demo backend |
| `npm test` | Quiz, progress and journey logic tests |
| `npm run test:rules` | Firestore security rules tests (needs Java 21+) |
| `npm run fetch-data` | Re-download the aesthetics into `data/aesthetics.json`; commit and push to publish |
| `npm run make-pins` | Resize the Pinterest boards in `pinterest/<Aesthetic name>/` (local, not committed) into `public/pins/<id>/` |
| `npm run make-themes` | Rebuild `data/themes.json`: colours from each board's pins, plus the hand-picked fonts, shapes, layout, icons, motion and pattern in `scripts/theme-designs.mjs` |
| `npm run make-icon` | Redraw the app icon (`scripts/make-icon.cjs`) into `public/icons/`, `public/apple-touch-icon.png` and `public/favicon.svg` |
| `npm run deploy:rules` | Deploy `firestore.rules` to Firebase |

## How access works

- The site and the aesthetics data are public; anyone with the link can play as a guest.
  Guests never touch the database.
- `firestore.rules` decides who can sign in for real: the owner (`adminEmail()`)
  manages the allowlist; allowlisted accounts read everyone's circle profile
  (nickname, avatar, learned per era, day streak, recent moments, accuracy) and only
  their own progress. Anyone else who signs in is told they're not on the list and
  can keep playing as a guest.

Leaderboard numbers are reported by each player's browser, so a determined
friend could fake theirs. That's fine among friends.
