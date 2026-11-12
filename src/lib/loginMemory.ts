import { writable } from 'svelte/store'

const preferenceKey = 'linlipin.login.preference'
const databaseName = 'linlipin-login-v1'
const storeName = 'credentials'
const recordKey = 'current'
export const rememberedPasswordHelp = '无法在此浏览器保存密码，请检查浏览器存储设置。'
export const loginMemoryNotice = writable('')

export function loginPreference(): { phone: string; remember: boolean } {
  try {
    const value = JSON.parse(localStorage.getItem(preferenceKey) || '{}')
    return { phone: typeof value.phone === 'string' ? value.phone : '', remember: value.remember === true }
  } catch {
    return { phone: '', remember: false }
  }
}

function preference(phone: string, remember: boolean) {
  try {
    localStorage.setItem(preferenceKey, JSON.stringify({ phone: remember ? phone : '', remember }))
  } catch {
    // IndexedDB can still be available when localStorage is blocked.
  }
}

interface SavedLogin {
  version: 1
  phone: string
  key: CryptoKey
  iv: Uint8Array<ArrayBuffer>
  ciphertext: ArrayBuffer
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    let finished = false
    const fail = () => {
      finished = true
      clearTimeout(timeout)
      reject(new Error('Credential storage unavailable'))
    }
    const timeout = setTimeout(fail, 3000)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onerror = fail
    request.onblocked = fail
    request.onsuccess = () => {
      clearTimeout(timeout)
      if (finished) request.result.close()
      else resolve(request.result)
    }
  })
}

async function storedLogin(): Promise<SavedLogin | undefined> {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly')
      const request = transaction.objectStore(storeName).get(recordKey)
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

async function writeLogin(value?: SavedLogin) {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      if (value) store.put(value, recordKey)
      else store.delete(recordKey)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

// Serialize writes so unchecking cannot race an in-flight successful login save.
let writes: Promise<void> = Promise.resolve()
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writes.then(operation)
  writes = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

export function rememberLogin(phone: string, password: string, remember: boolean): Promise<boolean> {
  return enqueue(async () => {
    if (!remember) return clearSavedLogin()
    preference('', false)
    try {
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
        'encrypt',
        'decrypt'
      ])
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(phone) },
        key,
        new TextEncoder().encode(password)
      )
      await writeLogin({ version: 1, phone, key, iv, ciphertext })
      preference(phone, true)
      return true
    } catch {
      await clearSavedLogin()
      return false
    }
  })
}

async function clearSavedLogin(): Promise<boolean> {
  preference('', false)
  try {
    await writeLogin()
    return true
  } catch {
    return false
  }
}

export function forgetLogin(): Promise<boolean> {
  return enqueue(clearSavedLogin)
}

export async function restoreLogin(): Promise<{ phone: string; password: string } | null> {
  await writes
  try {
    if (JSON.parse(localStorage.getItem(preferenceKey) || '{}').remember === false) return null
  } catch {
    // Allow IndexedDB recovery when localStorage itself is unavailable.
  }
  try {
    const saved = await storedLogin()
    if (!saved || saved.version !== 1 || !/^1[3-9][0-9]{9}$/.test(saved.phone)) return null
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: saved.iv, additionalData: new TextEncoder().encode(saved.phone) },
      saved.key,
      saved.ciphertext
    )
    return { phone: saved.phone, password: new TextDecoder().decode(plaintext) }
  } catch {
    await forgetLogin()
    return null
  }
}
