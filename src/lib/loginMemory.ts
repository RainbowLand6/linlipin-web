const key = 'linlipin.login.preference'
export function loginPreference(): { phone: string; remember: boolean } {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}')
    return { phone: typeof value.phone === 'string' ? value.phone : '', remember: value.remember !== false }
  } catch {
    return { phone: '', remember: true }
  }
}
export async function rememberLogin(phone: string, password: string, remember: boolean) {
  try {
    localStorage.setItem(key, JSON.stringify({ phone: remember ? phone : '', remember }))
  } catch {
    /* Private browsing can disable storage. */
  }
  // Passwords belong to the browser's credential vault, never app storage or logs.
  if (
    remember &&
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'PasswordCredential' in window &&
    navigator.credentials
  ) {
    try {
      const Credential = (
        window as unknown as {
          PasswordCredential: new (value: { id: string; password: string; name: string }) => Credential
        }
      ).PasswordCredential
      await navigator.credentials.store(new Credential({ id: phone, password, name: phone }))
    } catch {
      /* Browser autofill remains available when its save prompt is declined. */
    }
  }
}
