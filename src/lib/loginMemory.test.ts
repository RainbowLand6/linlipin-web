import { IDBFactory } from 'fake-indexeddb'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { forgetLogin, loginPreference, rememberLogin, restoreLogin } from './loginMemory'

let saved: Map<string, string>
beforeEach(() => {
  saved = new Map()
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value)
  })
})
afterEach(() => vi.unstubAllGlobals())

it('restores a saved login without browser password-manager support', async () => {
  expect(await rememberLogin('13800000001', 'memberPassword1!', true)).toBe(true)
  expect(await restoreLogin()).toEqual({ phone: '13800000001', password: 'memberPassword1!' })
  expect(loginPreference()).toEqual({ phone: '13800000001', remember: true })
  expect([...saved.values()].join()).not.toContain('memberPassword1!')
})

it('keeps only ciphertext and a non-exportable key in IndexedDB', async () => {
  await rememberLogin('13800000001', 'memberPassword1!', true)
  const record = await readRecord()
  expect(record.password).toBeUndefined()
  expect(record.key.extractable).toBe(false)
  expect(record.ciphertext).toBeInstanceOf(ArrayBuffer)
  expect(new TextDecoder().decode(record.ciphertext)).not.toContain('memberPassword1!')
})

it('clears the previous password immediately when remember-password is unchecked', async () => {
  await rememberLogin('13800000001', 'memberPassword1!', true)
  expect(await forgetLogin()).toBe(true)
  expect(await restoreLogin()).toBeNull()
  expect(loginPreference()).toEqual({ phone: '', remember: false })
})

it('does not retain a previously saved password after an unchecked login', async () => {
  await rememberLogin('13800000001', 'memberPassword1!', true)
  expect(await rememberLogin('13800000002', 'anotherPassword2!', false)).toBe(true)
  expect(await restoreLogin()).toBeNull()
})

it('serializes a clear after an in-flight save', async () => {
  const save = rememberLogin('13800000001', 'memberPassword1!', true)
  const clear = forgetLogin()
  await Promise.all([save, clear])
  expect(await restoreLogin()).toBeNull()
})

it('replaces the saved account after a successful account switch', async () => {
  await rememberLogin('13800000001', 'memberPassword1!', true)
  await rememberLogin('13800000002', 'anotherPassword2!', true)
  expect(await restoreLogin()).toEqual({ phone: '13800000002', password: 'anotherPassword2!' })
})

it('rejects tampered ciphertext and removes the damaged record', async () => {
  await rememberLogin('13800000001', 'memberPassword1!', true)
  const record = await readRecord()
  new Uint8Array(record.ciphertext)[0] ^= 1
  await updateRecord(record)
  expect(await restoreLogin()).toBeNull()
  expect(await readRecord()).toBeUndefined()
})

it('reports unavailable storage instead of claiming the password was saved', async () => {
  vi.stubGlobal('indexedDB', {
    open: () => {
      throw new Error('Blocked')
    }
  })
  expect(await rememberLogin('13800000001', 'memberPassword1!', true)).toBe(false)
  expect(await restoreLogin()).toBeNull()
  expect(loginPreference().remember).toBe(false)
})

it('does not treat a legacy phone-only preference as a saved password', async () => {
  saved.set('linlipin.login.preference', JSON.stringify({ phone: '13800000001', remember: true }))
  expect(await restoreLogin()).toBeNull()
})

it('honors an explicit opt-out even if a stale database record remains', async () => {
  await rememberLogin('13800000001', 'memberPassword1!', true)
  saved.set('linlipin.login.preference', JSON.stringify({ phone: '', remember: false }))
  expect(await restoreLogin()).toBeNull()
})

async function readRecord(): Promise<any> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('credentials', 'readonly')
    const request = tx.objectStore('credentials').get('current')
    tx.oncomplete = () => {
      db.close()
      resolve(request.result)
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}
async function updateRecord(record: unknown) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('credentials', 'readwrite')
    tx.objectStore('credentials').put(record, 'current')
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('linlipin-login-v1', 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
