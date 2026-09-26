# PuzzleMind

A responsive puzzle gaming platform with a custom dark arcade interface, six playable games, real accounts, saved progress, daily challenges, and achievements.

## Run locally

Requires **Node.js 22.13+** and npm.

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. 

## What works

- A custom responsive overview, game library, dashboard, profile, settings, achievements, and leaderboard, with mobile bottom navigation.
- Sliding puzzles at 3×3, 4×4, 5×5, and 6×6. Every board comes from legal moves from a solved board.
- Click, touch, and keyboard input; legal-move counting; first-move timer; pause with a hidden board; restart; new shuffle; hints; score calculation; win modal and confetti.
- Hints follow a valid path to the solution, including after arbitrary player moves. Hints are limited by difficulty and cost 50 points each.
- Secure cookie sessions, registration, login, logout, password changes, forgot/reset password, profile edits, and password-confirmed account deletion.
- Server-side result replay validation and score calculation. Completed results, XP, level progression, unlocked achievement dates, and leaderboards are saved in SQLite.
- A shared daily 4×4 puzzle determined by the UTC date. First completions count; repeat daily plays are practice. Streaks use distinct UTC play dates.
- Global score, daily score, fastest time, fewest moves, and highest level leaderboard categories. Only real registered players appear.
- Guest play with browser-persisted history. Guest progress and registered account progress are separate; guest results do not enter leaderboards.
- Optional synthesized sound effects and ambient audio, animation preferences, light/dark mode, a default difficulty, and level-unlocked tile themes.
- Memory Match with 6–12 pairs, uniquely solvable 9×9 Sudoku, number sequence challenges, clue-based word scrambles, and a sliding Picture Puzzle with a landscape reference. All six games offer four difficulties, pause/restart controls, score validation, XP, achievements, and saved results.
- Game-specific URLs (`#play?game=memory`, `sudoku`, `pattern`, `word`, or `picture`) and personal bests. Existing accounts and history are preserved; the five newly implemented games become available automatically on the next server start.
- An administrator studio for player search, suspension/restoration, statistics, real leaderboard data, future daily-puzzle scheduling with solvable previews, custom achievements, game catalog listings, report moderation, and draft/published announcements.
- A player Help & feedback page with private reports, status tracking, and visible administrator replies. Published announcements appear on the overview and in notifications.

## Project structure

```text
src/
  components/       Shared layout, modal, cards, illustrations, and UI
  pages/            Overview, game, community, account, and settings pages
  pages/admin/      Separate studio screens and reusable admin UI/data hooks
  context.tsx       Account, navigation, preferences, and guest progress
  lib.ts            Typed API client, storage, formatting, and optional audio
  types.ts          Shared frontend types
  styles.css        Responsive design system and CSS game illustrations
server/
  index.js          Express API, SQLite models, auth, and result validation
  database.js       Schema, additive migrations, and default catalog data
  admin.js          Protected management APIs and public report/news routes
  admin-cli.js      Local administrator role provisioning
  catalog.js        Stored daily puzzles and custom achievement evaluation
shared/
  game.js           Deterministic generator, moves, scoring, XP, achievements
  arcade.js         Memory, Sudoku, pattern, and word generators and replay validation
  catalog.js        Game engine registry, default cards, and badge requirements
tests/
  game.test.js      Puzzle, score, progression, and streak invariants
  arcade.test.js    Additional game rules, unique Sudoku solutions, API results, migrations
  arcade-browser.mjs All six games, saved progress, controls, retries, and mobile layouts
  api.test.js       Isolated database integration tests
  browser.mjs       Chrome end-to-end checks and responsive screenshots
  admin.test.js     Permission, suspension, moderation, scheduling, migration tests
  admin-browser.mjs Isolated production-server admin and player browser checks
```

## AUTHOR
Andrew Otokpa
