# Demo script (about 5 minutes)

Start: `npm run start`, open http://localhost:8787. Use two windows side by side: A (driver/operator) and B (passenger).

1. **Landing** (10 s): one sentence on the problem: riders do not know where the bus is.
2. **Passenger** (window B, login button Passenger): live map, tap BUS-104 for ETA, next stop, crowd level, "Simulated GPS" source. Routes: search MUET to Hyderabad: time, fare, buses nearby. Search Kotri Station to Hyderabad: no direct bus, so a transfer plan is offered. Open a stop to see approaching buses.
3. **Driver** (window A, Driver): choose bus/route, Start trip (simulated GPS; or phone GPS on localhost). Press Traffic delay. In window B the bus turns Delayed with a new ETA and a notification.
4. **Operator** (new login, Operator): overview map, needs-attention list. Service alerts: publish "Kotri Bridge slow traffic". Routes and stops: close a stop with a reason. Window B shows the alert and the closed stop immediately.
5. **Fleet and trips**: add a bus, assign a driver, cancel a trip (riders are told).
6. **Analytics**: busiest routes/stops, peak hours, delay trend, patterns, schedule suggestions (explain: statistics from trip history, sample data labelled).
7. **Admin**: Users and roles: add a driver account, change a role, disable an account. Show that the operator login has no Users page and the server returns 403 for rider/driver calls.
8. **Edge cases**: Demo panel: offline banner, error state, location lost ("Location temporarily unavailable").
9. Close with architecture: shared TypeScript engine, REST + SSE, cookie sessions, role permissions enforced on the server.

## Extra 2 minutes: accounts and insights
1. Open /signup, create an account, show the strength meter, then sign out and try the same email again (duplicate message) and a wrong password (generic error).
2. On /login show "Continue with Google" (works once GOOGLE_* are set; otherwise it explains why it is unavailable).
3. As Operator open Analytics: expand an insight to show its evidence, press Export CSV, then Print report.
4. As Passenger open Profile to show the activity timeline and that favourites follow the account.
