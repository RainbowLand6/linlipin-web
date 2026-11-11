import { afterEach, describe, expect, it, vi } from 'vitest'
import { autoRefresh } from './autoRefresh'
import { passwordError } from './ui'
import { duration, remainingSeconds } from './temporaryPassword'
import { thumbnailUrl } from './urls'
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
describe('password boundaries', () => {
  it('accepts 64 Unicode code points without a hidden byte limit', () => {
    for (const p of ['汉'.repeat(63) + '1', '😀'.repeat(63) + 'a', 'abcdefg1'])
      expect(passwordError(p, '13800000001')).toBe('')
    for (const p of ['汉'.repeat(64) + '1', 'abcdefgh', '12345678', '13800000001'])
      expect(passwordError(p, '13800000001')).not.toBe('')
  })
})
describe('temporary credential clock', () => {
  it('uses server time plus elapsed duration and stops at zero', () => {
    vi.spyOn(Date, 'now').mockReturnValue(0)
    expect(remainingSeconds('2026-11-11T01:15:00Z', '2026-11-11T01:00:00Z', 1000)).toBe(899)
    expect(duration(899)).toBe('14:59')
    expect(remainingSeconds('2026-11-11T01:15:00Z', '2026-11-11T01:00:00Z', 900001)).toBe(0)
  })
})
describe('media variants', () => {
  it('only transforms known API media paths and preserves signatures', () => {
    const base = 'https://api.example.test'
    expect(thumbnailUrl('/api/v2/media/12', base)).toBe(base + '/api/v2/media/12/thumbnail')
    expect(thumbnailUrl('/api/v2/media/12?e=1&token=secret', base)).toBe(
      base + '/api/v2/media/12?e=1&token=secret'
    )
    expect(thumbnailUrl('https://evil.example/12.jpg', base)).toBe('')
  })
})
describe('visible page refresh', () => {
  it('pauses hidden/offline, serializes requests and removes timers/listeners', async () => {
    vi.useFakeTimers()
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    const win = new EventTarget()
    const nav = { onLine: true }
    vi.stubGlobal('document', doc)
    vi.stubGlobal('window', win)
    vi.stubGlobal('navigator', nav)
    let finish: () => void = () => {}
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const stop = autoRefresh(refresh)
    await vi.advanceTimersByTimeAsync(15001)
    expect(refresh).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60000)
    expect(refresh).toHaveBeenCalledTimes(1)
    finish()
    await Promise.resolve()
    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(60000)
    expect(refresh).toHaveBeenCalledTimes(1)
    doc.visibilityState = 'visible'
    nav.onLine = false
    doc.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(60000)
    expect(refresh).toHaveBeenCalledTimes(1)
    nav.onLine = true
    win.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(15001)
    expect(refresh).toHaveBeenCalledTimes(2)
    stop()
    finish()
    await Promise.resolve()
    win.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(60000)
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })
})
