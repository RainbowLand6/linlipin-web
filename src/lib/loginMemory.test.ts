import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { loginPreference, rememberLogin } from './loginMemory'

let saved: Map<string, string>
const store = vi.fn()
beforeEach(() => {
  saved = new Map()
  store.mockReset()
  store.mockResolvedValue(undefined)
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value)
  })
  vi.stubGlobal('navigator', { credentials: { store } })
  vi.stubGlobal('window', {
    isSecureContext: true,
    PasswordCredential: class {
      constructor(value: object) {
        Object.assign(this, value)
      }
    }
  })
})
afterEach(() => vi.unstubAllGlobals())

it('offers credentials only to the browser vault and stores no password in app storage', async () => {
  await rememberLogin('13800000001', 'memberPassword1!', true)
  expect(store).toHaveBeenCalledWith(
    expect.objectContaining({ id: '13800000001', password: 'memberPassword1!' })
  )
  expect(loginPreference()).toEqual({ phone: '13800000001', remember: true })
  expect([...saved.values()].join()).not.toContain('memberPassword1!')
})
it('does not save credentials when remember-password is unchecked', async () => {
  await rememberLogin('13800000001', 'memberPassword1!', false)
  expect(store).not.toHaveBeenCalled()
  expect(loginPreference()).toEqual({ phone: '', remember: false })
})
it('tolerates a rejected browser save prompt without failing login', async () => {
  store.mockRejectedValue(new Error('User declined'))
  await expect(rememberLogin('13800000001', 'memberPassword1!', true)).resolves.toBeUndefined()
})
