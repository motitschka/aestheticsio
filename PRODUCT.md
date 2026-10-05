# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A circle of friends: the owner and the friends they invite (anyone with the link can still play as a guest). They use it on their phones in short sessions to learn to recognise, name and tell apart design aesthetics, and the goal is that they finish all 174.

## Product Purpose

Aesthetic Learner teaches the 174 design aesthetics in the Aesthetics Wiki's Category:Design Aesthetics. Success is a player who can look at an image and name its aesthetic, explain what defines it, and tell it apart from its close relatives.

## Positioning

Every lesson, question and image comes from the Aesthetics Wiki itself (intro, infobox facts, gallery images), and every aesthetic has its own unlockable theme that dresses the whole app in that aesthetic once its lesson is learned.

## Operating Context

- Phone-first web app, also used on desktop. Hosted on GitHub Pages at https://motitschka.github.io/aestheticsio/ (a demo-mode preview of the next version at /next/).
- Short sessions: a lesson, a round of 10, or a timed challenge. A daily goal of one lesson keeps a day streak.
- Guests keep progress in their browser; invited friends sign in with Google (Firebase) to sync and join the leaderboard.

## Capabilities and Constraints

- A journey through time: eight eras (before 1900 to now), walked oldest first; finishing means every lesson learned.
- Lessons per aesthetic (info cards, then checks against its close relatives; tiers seen, learned, mastered; learned is never lost), seven practice modes, a Mixed challenge (endless, 25, 50, 100) with badges, the circle (a feed of friends' moments, era progress, day streaks, best streaks), profiles with aesthetic avatars.
- 174 themes, one per aesthetic, unlocked by learning its lesson; chosen under Me, applied app-wide.
- Wiki text is CC BY-SA and must stay credited. Images are hotlinked from Fandom's server, never re-hosted.
- The user's Pinterest boards (`pinterest/`, git-ignored at full size) are each theme's inspiration and imagery. Resized copies in `public/pins/` are published with the public site by the owner's choice: theme backgrounds, moodboard strips, framed decoration, and the unseen images that lesson checks ask about. Wiki photos teach (lesson galleries) and are used in practice.
- Free tiers only: GitHub Pages, Firebase Spark.

## Brand Commitments

- Name: Aesthetic Learner.
- The default look must not read as generic or AI-made (no cream ground plus serif headline plus purple accent).
- Themes stay true to their aesthetic; the user's Pinterest boards are the reference for each.
- No AI-generated images, anywhere: not in the app, not in mockups, not on decision pages. Imagery is the Aesthetics Wiki's own (hotlinked) and the user's own Pinterest pins.

## Evidence on Hand

- `data/aesthetics.json`: 174 aesthetics with names, wiki links, up to 10 image URLs, intro and infobox facts.
- `data/themes.json`: generated themes. `pinterest/<Aesthetic>/`: 10 pins per aesthetic (full size, local); `public/pins/<id>/`: their published webp copies.
- No testimonials, press or user numbers exist; do not invent any.

## Product Principles

1. The aesthetics are the content; the interface frames them and never competes with their images.
2. Learning is earned: progress, tiers and themes reflect real recall, not taps. Nothing outside the player's control (a picture that didn't load) counts against them.
3. Every aesthetic is treated with equal care, from Art Deco to Dollar Store Vernacular.
4. Quick to start, quick to finish: every session works in a minute on a phone.
