import { writable, get } from 'svelte/store'
import { apiUrl } from './urls'
import type { Me } from './types'
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter = 0
  ) {
    super(message)
  }
}
export const session = writable<{ me: Me | null; ready: boolean; csrf: string; epoch: number }>({
  me: null,
  ready: false,
  csrf: '',
  epoch: 0
})
export const community = '/communities/1'
const pending = new Map<
  string,
  {
    actor: string
    path: string
    body: unknown
    method: string
    key: string
    uncertain: boolean
    inflight?: Promise<unknown>
  }
>()
export const unresolved = writable(0)
function actor() {
  const me = get(session).me
  return me ? JSON.stringify([me.id, me.community_id]) : ''
}
function updatePending() {
  unresolved.set([...pending.values()].filter((p) => p.actor === actor() && p.uncertain).length)
}
export function clearSession() {
  session.update((s) => ({ me: null, ready: true, csrf: '', epoch: s.epoch + 1 }))
  updatePending()
}
async function responseJson(response: Response) {
  try {
    return await response.json()
  } catch {
    throw new ApiError(response.status, 'INVALID_RESPONSE', '服务暂时不可用，请稍后重试。')
  }
}
export async function csrf() {
  let res: Response
  try {
    res = await fetch(apiUrl('/auth/csrf'), { credentials: 'include', cache: 'no-store' })
  } catch {
    throw new ApiError(0, 'NETWORK', '网络未连通，请检查网络后重试。')
  }
  if (!res.ok) throw new Error('无法建立安全会话，请稍后重试。')
  const data = await responseJson(res)
  if (!data || typeof data.token !== 'string' || !data.token)
    throw new ApiError(res.status, 'INVALID_RESPONSE', '服务暂时不可用，请稍后重试。')
  session.update((s) => ({ ...s, csrf: data.token }))
}
export async function api<T>(
  path: string,
  {
    method = 'GET',
    body,
    key,
    signal
  }: { method?: string; body?: unknown; key?: string; signal?: AbortSignal } = {}
): Promise<T> {
  const before = get(session)
  const owner = actor()
  if (method !== 'GET' && !before.csrf) await csrf()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (method !== 'GET') headers['X-XSRF-TOKEN'] = get(session).csrf
  if (key) headers['Idempotency-Key'] = key
  if (key && (owner !== actor() || before.epoch !== get(session).epoch))
    throw new ApiError(0, 'SESSION_CHANGED', '账号已变化，请用原账号恢复后重试。')
  const payload = body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body)
  if (payload && !(payload instanceof FormData)) headers['Content-Type'] = 'application/json'
  let response: Response
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers,
      body: payload,
      credentials: 'include',
      cache: 'no-store',
      signal
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'NETWORK', '网络未连通，请保留当前内容并原样重试。')
  }
  if (owner !== actor() || before.epoch !== get(session).epoch)
    throw new ApiError(0, 'SESSION_CHANGED', '账号已变化，请用当前账号重新读取。')
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    if (response.status === 401 && data.code !== 'INVALID_CREDENTIALS' && owner === actor()) clearSession()
    if (response.status === 403)
      session.update((s) => ({
        ...s,
        csrf: '',
        me: data.code === 'PASSWORD_CHANGE_REQUIRED' && s.me ? { ...s.me, must_change_password: true } : s.me
      }))
    throw new ApiError(
      response.status,
      data.code || 'HTTP_ERROR',
      data.message || (response.status >= 500 ? '系统繁忙，请稍后再试。' : '操作未完成，请检查后重试。'),
      Math.max(0, Math.min(3600, Number(response.headers.get('Retry-After')) || 0))
    )
  }
  if (response.status === 204) return undefined as T
  return responseJson(response)
}
export async function startup() {
  try {
    await csrf()
    const me = await api<Me>('/auth/me')
    session.update((s) => ({ ...s, me, ready: true }))
  } catch (e) {
    session.update((s) => ({ ...s, ready: true }))
    if (!(e instanceof ApiError && e.status === 401)) throw e
  }
}
export async function authenticate(path: string, body: unknown) {
  const me = await api<Me>(path, { method: 'POST', body })
  session.update((s) => ({ ...s, me, epoch: s.epoch + 1 }))
  updatePending()
  await csrf()
}
export async function apiList<T>(path: string) {
  const out: T[] = []
  for (let offset = 0; ; offset += 100) {
    const page = await api<T[]>(path + (path.includes('?') ? '&' : '?') + 'offset=' + offset + '&limit=100')
    out.push(...page)
    if (page.length < 100) return out
  }
}
const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => [k, canonical(x)])
        )
      : v
export async function command<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
  const owner = actor()
  if (!owner) throw new Error('请先登录。')
  body = canonical(body)
  const fingerprint = JSON.stringify([owner, path, method, body])
  let entry = pending.get(fingerprint)
  if (!entry) {
    if (
      [...pending.values()].some(
        (p) => p.actor === owner && p.path === path && p.method === method && p.uncertain
      )
    )
      throw new Error('该操作上次结果尚未确认，请恢复原内容并原样重试。')
    entry = { actor: owner, path, body, method, key: crypto.randomUUID(), uncertain: false }
    pending.set(fingerprint, entry)
  }
  if (entry.inflight) return entry.inflight as Promise<T>
  const current = entry
  const definitive409 = new Set([
    'VERSION_CONFLICT',
    'ITEM_VERSION_CONFLICT',
    'DUPLICATE_ACTIVE_PRODUCT',
    'DUPLICATE_PRODUCT_NAME',
    'ITEM_LOCKED',
    'ITEM_UNAVAILABLE',
    'CAPACITY_EXCEEDED',
    'NOT_FULL',
    'GROUP_ENDED',
    'ALREADY_PICKED_UP',
    'LINE_CANCELLED',
    'PAYMENT_NOT_ALLOWED',
    'REVOKE_NOT_ALLOWED',
    'NO_REFUND_DUE',
    'PICKUP_NOT_ALLOWED',
    'ITEM_CANCELLED',
    'GROUP_NOT_SETTLED'
  ])
  current.inflight = api<T>(path, { method, body, key: current.key })
    .then((result) => {
      if (owner !== actor()) throw new Error('账号已变化，请用原账号核对结果。')
      pending.delete(fingerprint)
      updatePending()
      return result
    })
    .catch((e) => {
      if (
        e instanceof ApiError &&
        e.status >= 400 &&
        e.status < 500 &&
        (!current.uncertain || (e.status === 409 && definitive409.has(e.code)))
      ) {
        pending.delete(fingerprint)
        throw e
      }
      current.uncertain = true
      updatePending()
      throw new Error(errorText(e) + ' 本次结果尚未确认，请用原账号保留原内容并原样重试，勿重复新建操作。')
    })
    .finally(() => {
      current.inflight = undefined
    })
  return current.inflight as Promise<T>
}
export function errorText(e: unknown) {
  return e instanceof Error ? e.message : '操作失败，请稍后重试。'
}
