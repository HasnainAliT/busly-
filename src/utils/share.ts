export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** Uses the native share sheet when available. Returns false when unsupported or cancelled so callers can fall back to copy. */
export async function shareLink(data: { title: string; text: string; url: string }): Promise<boolean> {
  if (!navigator.share) return false
  try {
    await navigator.share(data)
    return true
  } catch {
    return false
  }
}
