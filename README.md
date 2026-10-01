# Busly: Smart Public Transport and Bus Tracking Platform

Passengers see live buses, ETAs, routes, fares and alerts. Drivers start trips and share location. Operators and admins manage the fleet, routes, stops, alerts, users and read analytics. One codebase, one command.

Stack: React 19, Vite, TypeScript (strict), Tailwind, Framer Motion, Radix, Lucide icons. Backend: Express 5 with Passport.js (email/password and Google), sessions, REST + Server-Sent Events. Database: MongoDB Atlas (Mongoose), or a local JSON file when no `MONGODB_URI` is set.

Design: a calm editorial look (deep forest green, off-white, soft mint, Fraunces + Plus Jakarta Sans) with subtle Framer Motion that respects `prefers-reduced-motion`.

## Run (needs Node 20+)
```
npm install
npm run start        # builds the app, then serves app + API on http://localhost:8787
```
Development with hot reload: `npm run dev:all` (web on 5173, API on 8787, `/api` proxied).
`npm run dev` alone runs the UI with the in-browser demo backend (no server needed).

## Configure (copy `.env.example` to `.env`)
Nothing is hardcoded; every secret is read from the environment.
1. **MongoDB Atlas**: create a database user (Database Access) and allow your IP (Network Access), then set `MONGODB_URI` and `MONGODB_DB`. Check it with `npm run db:check` (connects, creates indexes, round-trips a document, reports clearly on failure). Without `MONGODB_URI` the app uses `server/data/db.json`.
2. **Sessions**: set `SESSION_SECRET` (32+ random characters).
3. **Google sign-in**: in Google Cloud Console create an OAuth client (Web application) and add the redirect URI `http://localhost:8787/api/auth/google/callback`. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`. Until they are set, "Continue with Google" explains that it is not configured.

## Demo accounts (real server)
Password for all: `Busly@2026` (set `BUSLY_DEMO_PASSWORD` to change it).
| Role | Email | Lands on |
|---|---|---|
| Passenger | rider@busly.app | /app/map |
| Driver | driver@busly.app | /driver |
| Operator | operator@busly.app | /operator |
| Admin | admin@busly.app | /operator (plus Users and roles) |

The login page has one-tap buttons for each role.

## Tests
```
npm run typecheck && npm run lint
npm test             # 93 tests: engine, insights, CSV export, server API, Passport auth, UI smoke
npm run test:e2e     # fresh build + data + server + Chromium: 24 feature checks, 22 auth checks,
                     # and a sweep of 80 page visits at desktop/laptop/tablet/mobile (overflow + console errors)
npm run db:check     # your MongoDB Atlas connection
```

## Features beyond the basics
- **Explainable insights and anomaly detection** (operator Analytics): z-score of today against a route's own recent days, trip-time outliers, volume against the usual pace, and load-based capacity suggestions. Each card opens to the evidence behind it.
- **Activity timeline** on the rider profile and across Busly for operators, stored per account in the database.
- **Export**: CSV report (formula-safe) and a print-ready report view.
- **Favourites and recent searches** sync to your account across devices.

## What is where
See `docs/PROJECT_EXPLANATION.md` (also as .docx) for folders, files and how frontend, backend, GPS service and database connect. `docs/DEMO_SCRIPT.md` is a 5 minute demo walkthrough.

## Honest limits
- Map is schematic (not Google/OSM tiles). `MapView` is an adapter point for a real provider. Coordinates are real lat/lng converted to a schematic plane.
- Fleet buses use simulated GPS; a driver can instead use real phone GPS (needs https or localhost). The demo clock runs 14x faster by default (1x/4x/14x/30x in the Demo panel).
- Analytics are statistics over trip history; first run includes clearly-labelled generated sample trips. There is no AI/ML model.
- MongoDB Atlas support is implemented behind a `Repo` interface and covered by `npm run db:check`; the automated tests run against the file repo because the CI sandbox has no route to Atlas. Run `db:check` once with your URI.
- Real Google sign-in needs your OAuth credentials; the redirect, state check and account-linking logic are tested without them.
- Change the demo password and set `SESSION_SECRET` before any public deployment; serve behind https and set `BUSLY_SECURE_COOKIE=1`.
- No email/SMS delivery (password reset and OTP are UI only).
- Urdu/RTL translation is not included.
