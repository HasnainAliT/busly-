/** Messages for the ?error= codes the server adds when a Google sign-in redirect fails. */
const messages: Record<string, string> = {
  'google-unavailable': "Google sign-in isn't set up on this server yet. Use your email and password for now.",
  'google-failed': "Google sign-in didn't complete. Please try again.",
  'google-denied': "Google sign-in was refused. If your account is disabled or has no verified email, use email and password instead.",
}

export function googleErrorMessage(code: string | null): string | null {
  if (!code) return null
  return messages[code] ?? 'Sign-in failed. Please try again.'
}
