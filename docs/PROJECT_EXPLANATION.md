---
title: "Busly: Project Explanation"
subtitle: "Smart Public Transport and Bus Tracking Platform"
---

# 1. What the project does

Busly shows passengers where buses are in real time and when they will arrive. Drivers run trips from a phone. Operators and administrators manage buses, drivers, routes, stops, service alerts and users, and read analytics from trip history.

| User | What they can do |
|---|---|
| Passenger | Search routes and stops, see live buses and ETA, fares, transfer suggestions, approaching buses at a stop, service alerts and closed stops, save favourites, report crowding and problems, scan a bus QR code |
| Driver | Log in, pick assigned bus and route, start and end a trip, share location (phone GPS or simulated), report delay, blocked road, temporary stop or vehicle issue |
| Operator | Manage buses, routes, stops and schedules, assign drivers, close stops, cancel trips, publish announcements, resolve rider reports, view analytics |
| Admin | Everything an operator can do, plus users, roles and account status |

# 2. How the parts connect

```
Browser (React app)
  Passenger pages  /app/*        Driver app /driver        Operator console /operator/*
        |                              |                           |
        +---------- one TransitStore + LiveFeed (src/services) ----+
                                   |
                      REST  POST /api/actions   (all changes)
                      SSE   GET  /api/stream    (live updates)
                                   |
                         Node server (server/index.ts)
                                   |
                  shared engine  src/domain/engine.ts
              (validates, checks role permissions, moves buses)
                                   |
                         file database  server/data/db.json
```

* **Frontend**: React single page app. Pages never talk to the network directly. They read data with hooks (`useTransit`, `useBuses`, `useAnalytics`) and send changes with `useDispatch`, which sends an *action* such as `trip/start` or `alert/publish`.
* **Backend**: a small Node HTTP server. It authenticates the user (cookie session), checks that the user's role may perform the action, runs the action through the shared engine, saves the result, and pushes the new state to every connected browser over Server-Sent Events.
* **GPS / location service**: a driver chooses *Phone GPS* or *Simulated GPS* when starting a trip. With phone GPS the browser (`src/hooks/useGps.ts`) sends `driver/location` actions; the engine snaps each fix to the route line and rejects points far from the route. If no fix arrives for 20 seconds the bus shows "Location temporarily unavailable" and after 5 minutes it goes offline. Fleet buses use the simulator: position is calculated from the saved progress, speed and the clock.
* **Database**: one JSON file written atomically (`server/db.ts`). It stores stops, routes, buses, drivers, trips, alerts, users, rider reports and password hashes. Replacing it with SQLite or PostgreSQL only means changing `load()` and `save()` in `Store`.
* **Shared engine**: `src/domain/*` has no browser code, so the *same* TypeScript runs in the server and, in demo mode, in the browser. That is why the app also works without a server (`npm run dev`), using localStorage.

# 3. Important folders and files

| Path | Purpose |
|---|---|
| `src/domain/types.ts` | Data model: Stop, Route, Bus, Driver, Trip, Alert, User |
| `src/domain/engine.ts` | All business rules: `applyAction`, role `PERMISSIONS`, bus movement, ETA, delay and trip lifecycle |
| `src/domain/analytics.ts` | Statistics from trip history: busiest routes and stops, delays, peak hours, patterns, schedule suggestions, ETA accuracy |
| `src/domain/seed.ts` | Demo routes, stops, buses, drivers and 7 days of labelled sample history |
| `server/index.ts` | HTTP server: auth, `/api/state`, `/api/stream`, `/api/actions`, `/api/analytics`, static files |
| `server/security.ts` | scrypt password hashing, signed session cookie, CSRF and origin checks, rate limiting, security headers |
| `server/db.ts` | File database |
| `src/services/` | `transitStore` (client state), `apiTransport` (real server), `localTransport` (in-browser demo), `backend.ts` (auto-detects the server) |
| `src/pages/` | Passenger pages: Dashboard, Live map, Routes, Buses, Stop, Favourites, Notifications, Profile |
| `src/pages/driver/` | Driver app: start trip, active trip, history |
| `src/pages/operator/` | Operator console: overview, fleet, routes and stops, alerts, trips, analytics, users |
| `src/components/` | Map, bus cards, charts, forms and UI primitives |
| `e2e/` | Real-browser tests: features (run.mjs), authentication (auth.mjs), responsive sweep (responsive.mjs) |
| `server/` | Express app, Passport auth (`auth.ts`), repositories for MongoDB and file storage (`repo/`) |

# 4. Authentication, database and security

**Sign-in** uses Passport.js: a local strategy (email and password) and Google OAuth 2.0 ("Continue with Google"). Passwords are salted and hashed with scrypt and compared in constant time. A Google account with the same verified email is linked to the existing account, so nobody ends up with duplicates. Logout destroys the server session.

**Sessions** are server-side (stored in MongoDB when configured) and the browser only holds an HttpOnly, SameSite=Lax cookie (Lax so it survives the redirect back from Google). Every state-changing request needs a custom header and a same-origin check (CSRF). Login, sign-up and actions are rate limited. The server, not the screen, enforces roles: a rider calling an operator action receives HTTP 403. Request bodies are size limited, text is cleaned, and a Content Security Policy is sent.

**Database**: `server/repo/` hides storage behind one `Repo` interface. `MongoRepo` (Mongoose, MongoDB Atlas) keeps users, buses, routes, stops, trips, alerts, notifications and an activity log in collections with validation, unique and compound indexes, and timestamps; favourites and recent searches are stored per user. `FileRepo` (a JSON file) is the default when no `MONGODB_URI` is set. `npm run db:check` verifies your Atlas connection end to end. All secrets come from environment variables (`.env.example`).

# 5. Novelty features

* **Explainable insights and anomaly detection** (`src/domain/insights.ts`): z-scores against a route's own history, trip-time outliers, volume against the usual pace and load-based capacity suggestions. Every insight lists its evidence. These are statistics, not a trained model, and the UI says so.
* **Activity timeline** per account, and across the system for operators.
* **CSV and print report** from the same analytics.
* **Favourites and searches that follow the account** across devices.

# 6. Testing

* 93 automated tests: engine rules, insights, CSV export, server API, Passport authentication (register, login, logout, wrong password, duplicates, protected routes, Google redirect and account linking), UI smoke tests.
* 24 end-to-end feature checks and 22 authentication checks in real Chromium against the real server.
* A sweep of 80 page visits at desktop, laptop, tablet and mobile sizes, failing on horizontal overflow or console errors.
* Not covered here: a live MongoDB Atlas connection and a live Google token exchange, because they need your credentials and network access. Use `npm run db:check` and sign in with Google once to confirm.

# 7. Known limits

Schematic map instead of map tiles, simulated GPS for fleet buses, statistics instead of machine learning, no email or SMS delivery, English only.
