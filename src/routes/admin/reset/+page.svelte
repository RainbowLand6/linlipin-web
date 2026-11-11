<script lang="ts">
  import { onMount } from 'svelte'
  import { remainingSeconds, duration } from '#lib/temporaryPassword.ts'

  import { api, errorText, session } from '#lib/api.ts'
  import { confirmation, dateTime } from '#lib/ui.ts'
  let phone = '',
    reason = '',
    error = '',
    busy = false,
    result: { phone: string; temporary_password: string; expires_at: string; server_time?: string } | null =
      null
  let remaining = 0,
    copyMessage = '',
    receivedAt = 0
  let mounted = true
  onMount(() => {
    const timer = setInterval(() => {
      if (!result) return
      remaining = remainingSeconds(result.expires_at, result.server_time, performance.now() - receivedAt)
      if (!remaining) {
        result.temporary_password = ''
        copyMessage = ''
      }
    }, 250)
    return () => {
      mounted = false
      clearInterval(timer)
      result = null
    }
  })
  function clearResult() {
    result = null
    copyMessage = ''
    remaining = 0
  }
  async function copyPassword() {
    const currentResult = result
    if (!currentResult || !remaining || !currentResult.temporary_password) return
    try {
      await navigator.clipboard.writeText(currentResult.temporary_password)
      if (mounted && result === currentResult && remaining) copyMessage = '复制成功，临时密码已复制。'
    } catch {
      if (mounted && result === currentResult) copyMessage = '复制失败，请手动选中临时密码复制。'
    }
  }
  async function reset() {
    if (busy) return
    error = ''
    clearResult()
    const targetPhone = phone.trim()
    const resetReason = reason.trim()
    if (!/^1[3-9][0-9]{9}$/.test(targetPhone)) {
      error = '请输入正确的11位手机号。'
      return
    }
    if (!resetReason || [...resetReason].length > 300) {
      error = '请填写1–300个字符的重置原因。'
      return
    }
    busy = true
    try {
      if (
        (await confirmation(
          '重置用户密码',
          '将重置手机号 ' + targetPhone + ' 的密码，撤销该账号全部会话并生成一次性临时密码。'
        )) === null
      )
        return
      const nextResult = await api<NonNullable<typeof result>>('/platform/users/reset-password', {
        method: 'POST',
        body: { phone: targetPhone, reason: resetReason }
      })
      if (!mounted) return
      result = nextResult
      receivedAt = performance.now()
      remaining = remainingSeconds(result.expires_at, result.server_time, 0)
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
</script>

<div class="page-head"><div><h1>重置用户密码</h1></div></div>
{#if !$session.me?.platform_admin}<div class="notice error">
    此功能仅向平台管理员开放。
  </div>{:else}{#if error}<p class="notice error" role="alert">{error}</p>{/if}
  <form novalidate class="card" on:submit|preventDefault={reset}>
    <label
      >用户手机号<input
        bind:value={phone}
        type="tel"
        inputmode="tel"
        required
        pattern="1[3-9][0-9]{9}"
        maxlength="11"
        placeholder="请输入用户注册时的手机号"
        disabled={busy}
        autocomplete="off"
      /></label
    ><label>重置原因<textarea bind:value={reason} required maxlength="300" disabled={busy}></textarea></label>
    <div class="actions">
      <button class="btn danger" disabled={busy}>{busy ? '正在重置…' : '确认重置密码'}</button>
    </div>
  </form>
  {#if result}<section class="card sensitive">
      <h2>本次临时密码</h2>
      <p>用户手机号：{result.phone}</p>
      {#if remaining > 0}<p class="temporary-password">{result.temporary_password}</p>{/if}
      <p role="timer">临时密码剩余有效时间：{remaining > 0 ? duration(remaining) : '已过期，请重新重置'}</p>
      <p class="muted">
        有效期至 {dateTime(result.expires_at)}。请通过可信渠道交给本人，此页面不会保存该凭据。
      </p>
      <div class="actions">
        <button type="button" class="btn primary" disabled={!remaining} on:click={copyPassword}
          >复制临时密码</button
        >
        <button type="button" class="btn" on:click={clearResult}>已记下，清除此处显示</button>
      </div>
      {#if copyMessage}<p class="micro" role="status">{copyMessage}</p>{/if}
      <p class="micro muted">临时密码仅能登录一次；已使用或再次重置后，即使倒计时未结束也会失效。</p>
    </section>{/if}{/if}
