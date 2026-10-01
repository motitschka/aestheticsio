# Aesthetic Learner

A phone-friendly app for learning every design aesthetic in
[Category:Design Aesthetics](https://aesthetics.fandom.com/wiki/Category:Design_Aesthetics)
on the Aesthetics Wiki.

**Play it:** https://motitschka.github.io/aestheticsio/

- **Lessons:** one per aesthetic, built from the wiki (intro, gallery, motifs,
  colours, decade, values, related aesthetics) with questions in between: type the
  name, pick its colours, motifs and decade. Missed questions come back at the end.
  After the first time you choose *info only* or *questions only*.
  - **Seen** = finished, **learned** = every question right in one go,
    **mastered** = perfect again at least 30 days later (permanent). Learned drops
    back to seen after a mistake.
  - Overall %: learned counts 1, mastered 2, so 100% = every lesson learned and
    200% = every lesson mastered.
- **Practice modes** (rounds of 10): image → name, name → image, description → name,
  clues → name, tell them apart (related aesthetics), odd one out, timeline. An
  aesthetic is *recognised* in a mode after 3 right in a row there.
- **Mixed challenge:** every question type, endless until the first mistake, timed.
  Badges for 10/25/50/100 in a row and for 25/50/100 in under 3/6/12 minutes.
- **Play without signing in:** guest progress is saved in the browser.
- **Or sign in with Google (invite only):** progress syncs across devices and you
  join the friends leaderboard (lessons % and best streak). Guest progress comes
  with you the first time you sign in.
- **Stack:** Vite + React + TypeScript on GitHub Pages; Firebase Auth (Google) and
  Firestore on the free Spark plan for sign-in, sync and the leaderboard. Images
  load directly from Fandom.

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
| `npm test` | Quiz logic tests |
| `npm run test:rules` | Firestore security rules tests (needs Java 21+) |
| `npm run fetch-data` | Re-download the aesthetics into `data/aesthetics.json`; commit and push to publish |
| `npm run deploy:rules` | Deploy `firestore.rules` to Firebase |

## How access works

- The site and the aesthetics data are public; anyone with the link can play as a guest.
  Guests never touch the database.
- `firestore.rules` decides who can sign in for real: the owner (`adminEmail()`)
  manages the allowlist; allowlisted accounts read everyone's leaderboard profile
  (nickname, avatar, learned count, accuracy) and only their own progress. Anyone
  else who signs in is told they're not on the list and can keep playing as a guest.

Leaderboard numbers are reported by each player's browser, so a determined
friend could fake theirs. That's fine among friends.
