import { beforeEach, describe, it, expect, vi } from 'vitest'
import { get } from 'svelte/store'
import { api, ApiError, command, session, unresolved, clearSession } from './api'
const me = {
  id: '1',
  community_id: '1',
  phone: '13800000001',
  display_name: '测试',
  platform_admin: false,
  must_change_password: false,
  avatar_url: null
}
beforeEach(() => {
  vi.restoreAllMocks()
  session.set({ me, ready: true, csrf: 'x'.repeat(43), epoch: 0 })
})
describe('command recovery', () => {
  it('preserves the server retry delay for login throttling', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: 'LOGIN_BUSY', message: '系统繁忙，请稍后再试' }), {
            status: 503,
            headers: { 'Retry-After': '2' }
          })
        )
    )
    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 503,
      code: 'LOGIN_BUSY',
      retryAfter: 2
    })
  })
  it('reuses the same key and payload after an uncertain network result', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response('{"ok":true}'))
    vi.stubGlobal('fetch', fetcher)
    await expect(command('/retry-case', { version: 1 })).rejects.toThrow('结果尚未确认')
    expect(get(unresolved)).toBe(1)
    await expect(command('/retry-case', { version: 2 })).rejects.toThrow('恢复原内容')
    expect(fetcher).toHaveBeenCalledTimes(1)
    await expect(command('/retry-case', { version: 1 })).resolves.toEqual({ ok: true })
    expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toBe(
      fetcher.mock.calls[1][1].headers['Idempotency-Key']
    )
    expect(get(unresolved)).toBe(0)
  })
  it('does not discard the login form session for incorrect credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'INVALID_CREDENTIALS', message: '手机号或密码不正确' }), {
          status: 401
        })
      )
    )
    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError)
    expect(get(session).me?.id).toBe('1')
  })
  it('clears an expired session', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('{"code":"LOGIN_REQUIRED","message":"登录已失效"}', { status: 401 }))
    )
    await expect(api('/auth/me')).rejects.toThrow('登录已失效')
    expect(get(session).me).toBeNull()
    clearSession()
  })
})
