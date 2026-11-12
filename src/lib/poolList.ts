import type { PoolItem } from './types'

// Database IDs can exceed Number.MAX_SAFE_INTEGER.
function descendingId(a: string, b: string) {
  const left = BigInt(a)
  const right = BigInt(b)
  return left === right ? 0 : left > right ? -1 : 1
}

export function homePools(pools: PoolItem[], search = '') {
  const query = search.trim().toLocaleLowerCase()
  return pools
    .filter((item) => item.status === 'POOL' && item.enabled && item.name.toLocaleLowerCase().includes(query))
    .sort(
      (a, b) =>
        Number(b.remaining_quantity > 0) - Number(a.remaining_quantity > 0) ||
        a.remaining_quantity - b.remaining_quantity ||
        descendingId(a.id, b.id)
    )
}
