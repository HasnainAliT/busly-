export interface Practice {
  title: string
  detail: string
}

/** Honest status of the security work. Update this list as real controls ship. */
export const implemented: Practice[] = [
  { title: 'Passport.js sign-in', detail: 'Email and password, plus Google. Passwords are salted and hashed with scrypt.' },
  { title: 'HttpOnly session cookies', detail: 'Sessions live on the server (MongoDB when configured). No tokens in browser storage.' },
  { title: 'Server-side roles', detail: 'Every action is checked against the signed-in role and ownership on the server.' },
  { title: 'Rate limiting and lockout', detail: 'Auth and tracking endpoints throttle repeated requests per IP and per account.' },
  { title: 'CSRF and strict headers', detail: 'Writes need a custom header and a same-origin check, with CSP and frame protection.' },
  { title: 'Validated and safe input', detail: 'Inputs are checked on both sides, QR links are same-origin only, no raw HTML.' },
  { title: 'No secrets in source', detail: 'Database, session and Google credentials come from environment variables.' },
]

export const needsBackend: Practice[] = [
  { title: 'TLS and HSTS', detail: 'Terminate HTTPS at your host and set BUSLY_SECURE_COOKIE=1 in production.' },
  { title: 'Email verification and reset', detail: 'Needs an email provider to send one-time links.' },
  { title: 'Two-factor sign-in', detail: 'An optional second step for operator and admin accounts.' },
  { title: 'Real device GPS ingest', detail: 'Today positions are simulated or sent from the driver app.' },
]
