# PuzzleMind

A responsive puzzle gaming platform with a custom dark arcade interface, six playable games, real accounts, saved progress, daily challenges, and achievements.

## Run locally

Requires **Node.js 22.13+** and npm.

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. Vite serves the React app and proxies `/api` to the Express server on port 3001. The database is created automatically in `data/puzzlemind.sqlite`.

If your terminal reports `command not found: npm`, enable the existing development runtime for the current terminal session:

```sh
export PATH="/tmp/node-v22.14.0-linux-x64/bin:$PATH"
node --version
npm --version
```

Then rerun your npm command. This runtime lives in `/tmp`; install Node normally for a persistent setup.

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

## Administrator access

Register your own account through the app, then run this command on the server using the same `DATA_DIR` as the application:

```sh
npm run admin -- your-account@example.com
```

Refresh the app and open **Admin studio** in the sidebar. The command grants a role to an existing account; it does not create a default account or password. Registration and profile requests cannot grant admin privileges. Every `/api/admin` request requires an active administrator session.

Suspending a player immediately revokes all their sessions and hides their public rankings. Restoring them preserves their saved progress. Administrator accounts cannot be suspended through the studio. Role grants and management actions are recorded in the studio activity log.

Daily schedules use UTC. Preview a future board before saving it; current and past challenges cannot be edited or removed. Unscheduled dates retain the automatic Medium puzzle. New game listings remain Coming Soon until their engine is added to `shared/catalog.js` and implemented. Custom achievements use validated completion, time, hint, difficulty, daily-count, or level requirements; existing progress is checked when the player’s profile next loads.

Catalogs and announcements refresh on app load, page navigation, browser focus, and every minute. Draft announcements are never returned by the public API. Reports and moderator replies are visible only to their owner and administrators.

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

## Checks

```sh
npm test
npm run build
npm run test:browser
npm run test:admin-browser
npm run test:arcade-browser
```

The original game browser suite expects the development server to be running. The admin and arcade browser suites require a fresh `npm run build` and start their own production servers with isolated databases. All browser suites use Chrome at `/opt/google/chrome/chrome`; set `CHROME_PATH` to use another installation. Screenshots go to the ignored `test-results/` directory. API and isolated browser fixtures remove their temporary databases afterward.

## Production

### Deploy on Railway

The repository includes `railway.json` for the build, start command, and `/api/health` check. Deploy one service with one persistent volume; the React app and Express API share the same public URL. Railway's free allowance is limited; review [current pricing](https://docs.railway.com/pricing) before choosing a plan.

Keep the Railway build command set to `npm run build`. Railpack installs dependencies in a separate step. Running `npm ci`, removing `node_modules/.vite`, or pruning dependencies in the build command can fail with `EBUSY` because the Vite cache is mounted during that step. Remove any old custom build command from the Railway dashboard or set it to `npm run build`. For a clean lockfile install, set `RAILPACK_NODE_NPM_INSTALL` to `npm ci --include=dev`; for a smaller production image, set `RAILPACK_PRUNE_DEPS` to `true` so Railpack handles pruning separately.

1. Connect your Railway account and deploy this repository as a new service. The local source must be pushed to GitHub first if you choose GitHub deployment.
2. Attach a [persistent volume](https://docs.railway.com/volumes) at **`/data`** before accepting player registrations. Keep the service at **one replica**.
3. Set these service variables:

   | Variable                | Value                                                 |
   | ----------------------- | ----------------------------------------------------- |
   | `NODE_ENV`              | `production`                                          |
   | `RAILPACK_NODE_VERSION` | `22`                                                  |
   | `RAILPACK_NO_SPA`       | `true` (the Express server serves the built frontend) |
   | `DATA_DIR`              | `/data`                                               |
   | `TRUST_PROXY_HOPS`      | `1` when reachable only through Railway's edge proxy  |

4. Generate a public domain in the service's Networking settings. Set `APP_URL` to that full **`https://`** origin, without a trailing slash, and deploy the updated variables. Railway supplies `PORT` automatically.
5. Visit `/api/health` on the public URL; it should return `{"status":"ok"}`. Check registration, login, a completed puzzle, and that scores remain after a service restart.

The hosted database starts empty unless the local database is migrated. To keep existing accounts, admin roles, and scores, create a consistent snapshot on your local machine:

```sh
npm run backup -- data/backups/before-deploy.sqlite
```

Transfer the snapshot through a private authenticated connection and restore it as `/data/puzzlemind.sqlite` **while the hosted app is stopped**, before opening it to players. Keep the original local database. Do not upload database files to GitHub, `public/`, or `dist/`; the snapshot includes private account data. A live SQLite database may have newer data in its `-wal` file, so use the backup command instead of copying only the main file. For an existing hosted database, take a separate backup and stop its process before replacing the database and its associated WAL/SHM files.

If you choose a fresh hosted database, register your account on the **public site**, then run the administrator command **inside the hosted service**, with `DATA_DIR=/data`:

```sh
npm run admin -- your-account@example.com
```

Configure `SMTP_URL` and `MAIL_FROM` in the hosting service for password-reset emails. Without them, signups and logins work, but production password reset is unavailable. Set up scheduled volume backups in the hosting dashboard.

### Other Node hosts

```sh
npm run build
NODE_ENV=production APP_URL=https://your-domain.example npm start
```

The Express server serves the compiled app and API together. Terminate **HTTPS** at your host/reverse proxy; production session cookies use `Secure`, `HttpOnly`, and `SameSite=Strict`. Set `APP_URL` to the exact public origin. Mount `DATA_DIR` on a persistent volume and back up the SQLite database. This setup targets a single server; move the persistence layer to PostgreSQL before running multiple replicas.

Environment values can be exported by the host. For local `.env` use, run Node with `--env-file=.env`. See `.env.example` for supported values. `SMTP_URL` and `MAIL_FROM` enable actual password-reset email. Without SMTP, local reset links are printed to the server console; production reset requests return a clear configuration error.

Passwords use salted scrypt hashes. Session and reset tokens are cryptographically random and hashed in the database. Authentication endpoints are rate limited. State-changing requests validate the origin, and SQL uses bound parameters. The API replays the entire move history and recomputes scores. Active play time and hint counts are client-reported, so competitive anti-cheat would require a server-authoritative move/timer protocol before prizes or ranked tournaments.

## Next phases

The six game modes, player/progression systems, administrator studio, and community moderation are implemented. Multiplayer races, friends, and custom picture uploads remain future work. New catalog entries without an implemented engine are marked Coming Soon. The current implementation uses local SQLite rather than the brief’s suggested PostgreSQL, so it runs without an external database service.
