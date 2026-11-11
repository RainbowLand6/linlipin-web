import { writable, get } from 'svelte/store'
import { api, apiList, community, command, session } from './api'
import type { PoolItem, SubscriptionSet } from './types'
export const pool = writable<PoolItem[]>([])
export const draft = writable<Record<string, { item: PoolItem; quantity: number }>>({})
export const subscriptions = writable<SubscriptionSet | null>(null)
let actor = ''
let readVersion = 0
let snapshot: {
  actor: string
  body: unknown
  lines: Record<string, { item: PoolItem; quantity: number }>
} | null = null
export const pendingBasket = writable(false)
session.subscribe((s) => {
  const next = s.me ? JSON.stringify([s.me.id, s.me.community_id]) : ''
  if (actor !== next) {
    actor = next
    draft.set(snapshot?.actor === next ? snapshot.lines : {})
    pendingBasket.set(snapshot?.actor === next)
    pool.set([])
    subscriptions.set(null)
  }
})
export async function readBasket() {
  const owner = actor
  const version = ++readVersion
  const [items, set] = await Promise.all([
    apiList<PoolItem>(community + '/pool-items'),
    api<SubscriptionSet>(community + '/my-subscriptions')
  ])
  if (owner === actor && version === readVersion) {
    pool.set(items)
    subscriptions.set(set)
  }
}
export function adjust(item: PoolItem, delta: number) {
  if (snapshot?.actor === actor) return
  draft.update((lines) => {
    const next = { ...lines }
    const line = next[item.id]
    const prior = line?.quantity ?? 0
    const step = prior === 0 && delta > 0 ? item.min_quantity : delta
    const q = prior + step
    if (q <= 0 || (delta < 0 && q < item.min_quantity)) delete next[item.id]
    else if (q <= item.remaining_quantity) next[item.id] = { item: line?.item ?? { ...item }, quantity: q }
    return next
  })
}
export function remove(id: string) {
  if (snapshot?.actor === actor) return
  draft.update((lines) => {
    const next = { ...lines }
    delete next[id]
    return next
  })
}
export function reconcile() {
  if (snapshot?.actor === actor) return
  const current = get(pool)
  draft.update((lines) =>
    Object.fromEntries(
      Object.entries(lines).map(([id, line]) => [
        id,
        { ...line, item: current.find((p) => p.id === id) ?? line.item }
      ])
    )
  )
}
export function hasPending() {
  return snapshot?.actor === actor
}
export async function submit(name: string) {
  const owner = actor
  if (snapshot && snapshot.actor !== owner) throw new Error('请使用原账号恢复未确认操作。')
  if (!snapshot) {
    const set = get(subscriptions)
    if (!set) throw new Error('请先刷新购物车。')
    const current = get(pool)
    const lines = Object.values(get(draft))
    if (!lines.length) throw new Error('购物车为空。')
    for (const l of lines) {
      const latest = current.find((p) => p.id === l.item.id)
      if (
        !latest ||
        latest.status !== 'POOL' ||
        latest.selection_token !== l.item.selection_token ||
        l.quantity > latest.remaining_quantity
      )
        throw new Error('商品信息已变化，请重新核对后提交。')
    }
    snapshot = {
      actor: owner,
      lines: get(draft),
      body: {
        version: set.version,
        member_name: name.trim(),
        lines: lines.map((l) => ({
          pool_item_id: l.item.id,
          quantity: l.quantity,
          item_version: l.item.version,
          selection_token: l.item.selection_token
        }))
      }
    }
  }
  pendingBasket.set(true)
  try {
    await command(community + '/my-subscriptions/add', snapshot.body)
    snapshot = null
    pendingBasket.set(false)
    draft.set({})
    await readBasket()
  } catch (e) {
    if (e instanceof Error && !e.message.includes('结果尚未确认')) {
      snapshot = null
      pendingBasket.set(false)
    }
    throw e
  }
}
