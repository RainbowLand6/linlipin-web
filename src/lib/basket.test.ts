import { expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import { session } from './api'
import { draft, pool, readBasket } from './basket'
import type { PoolItem } from './types'

it('refreshes available stock without rewriting draft selection snapshots', async () => {
  session.set({ me: { id: '1', community_id: '1' } as never, csrf: '', ready: true, epoch: 1 })
  const selected = {
    id: '7',
    name: '测试商品',
    selection_token: 'original',
    remaining_quantity: 3
  } as PoolItem
  draft.set({ '7': { item: selected, quantity: 2 } })
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.includes('my-subscriptions')
              ? { version: 2, lines: [] }
              : [{ ...selected, selection_token: 'changed', remaining_quantity: 1 }]
          )
        )
    )
  )
  await readBasket()
  expect(get(pool)[0].remaining_quantity).toBe(1)
  expect(get(draft)['7'].quantity).toBe(2)
  expect(get(draft)['7'].item.selection_token).toBe('original')
  vi.unstubAllGlobals()
})
