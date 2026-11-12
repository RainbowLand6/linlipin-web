<script lang="ts">
  import { onMount } from 'svelte'
  import { ApiError, session, api, authenticate, clearSession, csrf, errorText } from '#lib/api.ts'
  import {
    loginPreference,
    rememberLogin,
    restoreLogin,
    forgetLogin,
    rememberedPasswordHelp,
    loginMemoryNotice
  } from '#lib/loginMemory.ts'
  import { passwordError, confirmation } from '#lib/ui.ts'
  import { compressImage } from '#lib/compressImage.ts'
  import Modal from './Modal.svelte'
  import defaultAvatar from '#lib/assets/default-avatar.svg'
  import { resolveMediaUrl } from '#lib/urls.ts'
  import type { Me, Media } from '#lib/types.ts'
  export let profile = false
  let avatarInput: HTMLInputElement
  let avatarFailed = false
  $: avatarSrc = (!avatarFailed && resolveMediaUrl($session.me?.avatar_url)) || defaultAvatar
  const passwordHelp = '密码须为 8–64位，至少包含字母、数字、其他字符中的两类，不能与手机号相同'
  const preference = loginPreference()
  let phone = preference.phone,
    remember = preference.remember,
    password = '',
    confirm = '',
    name = '',
    invite = '',
    mode = 'login',
    busy = false,
    error = '',
    success = '',
    current = '',
    next = '',
    repeat = '',
    nickname = '',
    avatarOpen = false
  let restoreVersion = 0
  async function fillRememberedLogin() {
    const version = ++restoreVersion
    const saved = await restoreLogin()
    if (version !== restoreVersion || mode !== 'login' || $session.me || busy) return
    if (saved && !password && (!phone || phone === saved.phone)) {
      phone = saved.phone
      password = saved.password
      remember = true
    }
  }
  function selectMode(value: 'login' | 'join') {
    if (mode === value) return
    restoreVersion++
    mode = value
    password = confirm = error = $loginMemoryNotice = ''
    if (value === 'login') void fillRememberedLogin()
  }
  async function rememberChanged() {
    restoreVersion++
    $loginMemoryNotice = ''
    if (!remember) {
      if (await forgetLogin()) $loginMemoryNotice = '已清除本浏览器保存的手机号和密码。'
      else $loginMemoryNotice = '无法清除保存的密码，请在浏览器设置中清除此网站数据。'
    }
  }
  $: if ($session.me && !nickname) nickname = $session.me.display_name ?? ''
  let retryUntil = 0,
    retrySeconds = 0
  onMount(() => {
    if (!$session.me) void fillRememberedLogin()
    const timer = setInterval(() => {
      retrySeconds = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000))
    }, 250)
    return () => clearInterval(timer)
  })
  async function login() {
    if (busy || retryUntil > Date.now()) return
    error = ''
    $loginMemoryNotice = ''
    if (!/^1[3-9][0-9]{9}$/.test(phone.trim())) {
      error = '请输入正确的11位手机号。'
      return
    }
    if (!password) {
      error = '请填写密码。'
      return
    }
    if (mode === 'join') {
      const problem = passwordError(password, phone)
      if (problem) {
        error = problem
        return
      }
      if (password !== confirm) {
        error = '两次密码不一致。'
        return
      }
      if (!name.trim() || !invite.trim()) {
        error = '请填写群昵称和邀请码。'
        return
      }
    }
    busy = true
    const checkedPassword = password
    const checkedPhone = phone.trim()
    const checkedMode = mode
    const checkedRemember = remember
    restoreVersion++
    try {
      await authenticate(
        mode === 'join' ? '/auth/register-and-join' : '/auth/login',
        mode === 'join'
          ? {
              phone: phone.trim(),
              password,
              confirm_password: confirm,
              display_name: name.trim(),
              invite_code: invite.trim()
            }
          : { phone: phone.trim(), password }
      )
      // Registering never persists a password; a temporary password is never remembered.
      if (checkedMode === 'login') {
        if ($session.me?.must_change_password) await forgetLogin()
        else {
          const saved = await rememberLogin(checkedPhone, checkedPassword, checkedRemember)
          if (!saved) $loginMemoryNotice = rememberedPasswordHelp
        }
      }
      password = ''
      confirm = ''
      success = '已登录。'
    } catch (e) {
      error = errorText(e)
      if (e instanceof ApiError && e.code === 'INVALID_CREDENTIALS') await forgetLogin()
      if (e instanceof ApiError && (e.status === 429 || e.code === 'LOGIN_BUSY')) {
        retrySeconds = e.retryAfter || (e.status === 429 ? 60 : 2)
        retryUntil = Date.now() + retrySeconds * 1000
      }
    } finally {
      busy = false
    }
  }
  async function logout() {
    if ((await confirmation('退出登录', '清除本次登录会话，已提交认购不受影响。')) === null) return
    busy = true
    try {
      await api('/auth/logout', { method: 'POST' })
      clearSession()
      await csrf()
      success = '已退出。'
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
  async function rename() {
    busy = true
    error = ''
    try {
      const me = await api<Me>('/auth/me')
      const result = await api<{ display_name: string; version: number }>('/communities/1/me', {
        method: 'PATCH',
        body: { display_name: nickname.trim(), version: me.membership_version }
      })
      session.update((s) => ({
        ...s,
        me: s.me ? { ...s.me, display_name: result.display_name, membership_version: result.version } : null
      }))
      success = '昵称已更新。'
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
  async function changePassword() {
    error = passwordError(next, $session.me?.phone ?? '')
    if (error) return
    if (next !== repeat) {
      error = '两次新密码不一致。'
      return
    }
    if ((await confirmation('修改密码', '修改后所有设备需重新登录。')) === null) return
    busy = true
    try {
      await api('/auth/password', {
        method: 'PUT',
        body: {
          ...(!$session.me?.must_change_password ? { current_password: current } : {}),
          new_password: next
        }
      })
      await forgetLogin()
      clearSession()
      current = next = repeat = ''
      success = '密码已修改，请重新登录。'
      await csrf()
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
  async function avatar(file: File | null) {
    busy = true
    error = ''
    try {
      let image: string | null = null
      if (file) {
        const compressed = await compressImage(file, 'AVATAR')
        const body = new FormData()
        body.set('file', compressed)
        body.set('purpose', 'AVATAR')
        image = (await api<Media>('/communities/1/media', { method: 'POST', body })).id
      }
      const me = await api<Me>('/auth/me')
      const updated = await api<Me>('/communities/1/me/avatar', {
        method: 'PUT',
        body: { version: me.membership_version, image_id: image }
      })
      session.update((s) => ({ ...s, me: updated }))
      avatarOpen = false
      avatarFailed = false
      success = '头像已更新。'
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
</script>

<div class="page-head">
  <div>
    <h1>
      {profile
        ? '个人信息'
        : $session.me
          ? '你好，' + ($session.me.display_name || '邻居')
          : '欢迎成为好邻居'}
    </h1>
  </div>
</div>
{#if error && $session.me}<p class="notice error" role="alert">{error}</p>{/if}{#if success}<p
    class="notice success"
    role="status"
  >
    {success}
  </p>{/if}
{#if $loginMemoryNotice}<p class="notice" role="status">{$loginMemoryNotice}</p>{/if}
{#if !$session.me}<div class="auth-layout">
    <section class="auth-aside">
      <h2>一件好物，<br />一群好邻居。</h2>
      <p>邀请制社区<br />线下付款，按号提货</p>
    </section>
    <form
      novalidate
      autocomplete="on"
      class="card"
      aria-busy={busy}
      aria-describedby={error ? 'auth-error' : undefined}
      on:submit|preventDefault={login}
    >
      <div class="tabs">
        <button
          type="button"
          disabled={busy}
          class:active={mode === 'login'}
          on:click={() => selectMode('login')}>登录</button
        ><button
          type="button"
          disabled={busy}
          class:active={mode === 'join'}
          on:click={() => selectMode('join')}>注册</button
        >
      </div>
      {#if mode === 'join'}<label
          >群昵称<input
            bind:value={name}
            disabled={busy}
            autocomplete="nickname"
            required
            maxlength="30"
          /></label
        >{/if}
      <label
        >手机号<input
          bind:value={phone}
          disabled={busy}
          type="tel"
          name="username"
          inputmode="tel"
          autocomplete="username"
          on:input={() => {
            restoreVersion++
          }}
          required
          maxlength="16"
        /></label
      >
      {#if mode === 'join'}<label
          >社区邀请码<input
            bind:value={invite}
            disabled={busy}
            required
            autocomplete="off"
            placeholder="请输入群公告内的社区邀请码"
          /></label
        >{/if}
      <label
        >密码<input
          bind:value={password}
          disabled={busy}
          name="password"
          type="password"
          autocomplete={mode === 'join' ? 'new-password' : 'current-password'}
          on:input={() => {
            restoreVersion++
          }}
          required
        /></label
      >
      {#if mode === 'join'}<p class="micro muted">{passwordHelp}</p>
        <label
          >确认密码<input
            bind:value={confirm}
            disabled={busy}
            type="password"
            autocomplete="new-password"
            required
          /></label
        >{/if}
      {#if mode === 'login'}<label class="remember-login"
          ><input
            bind:checked={remember}
            on:change={rememberChanged}
            type="checkbox"
            disabled={busy}
          />记住密码</label
        >
        <p class="micro muted">
          勾选后，登录成功会在本浏览器保存手机号和密码，下次自动填入；取消勾选会清除。请仅在个人设备使用。
        </p>
      {/if}
      <p class="micro muted">登录后默认保留7天。</p>
      {#if error}<p id="auth-error" class="notice error" role="alert" aria-live="assertive">
          {error}
        </p>{/if}<button class="btn primary wide" disabled={busy || retrySeconds > 0}
        >{retrySeconds > 0
          ? retrySeconds + '秒后可重试'
          : busy
            ? '请稍候…'
            : mode === 'join'
              ? '注册并加入社区'
              : '登录'}</button
      >
      {#if mode === 'login'}<p class="auth-switch">
          <a href="#join" on:click|preventDefault={() => selectMode('join')}>没有账号？去注册</a>
        </p>{/if}
      <p class="micro muted">忘记密码请联系平台管理员。</p>
    </form>
  </div>
{:else}
  {#if $session.me.must_change_password}<div class="notice">
      当前使用临时密码，必须先修改密码。修改前不可访问任何社区业务。
    </div>{/if}
  {#if !profile && !$session.me.must_change_password}<section class="card account-menu" aria-label="我的账户">
      <button
        type="button"
        class="account-row avatar-row"
        disabled={busy}
        aria-label="维护头像"
        aria-haspopup="dialog"
        aria-expanded={avatarOpen}
        on:click={() => (avatarOpen = true)}
        ><span class="account-row-label">头像<small>{$session.me.display_name}</small></span><img
          class="account-avatar"
          src={avatarSrc}
          alt="我的头像"
          referrerpolicy="no-referrer"
          on:error={() => (avatarFailed = true)}
        /><span class="account-chevron" aria-hidden="true">›</span></button
      >
      <a class="account-row" href="/me/profile"
        ><span class="account-row-label">个人信息<small>手机号、昵称与密码</small></span><span
          class="account-chevron"
          aria-hidden="true">›</span
        ></a
      >
      {#each [{ href: '/orders', label: '我的订单' }, { href: '/products', label: '我的商品库' }, { href: '/me/invite', label: '社区入会邀请' }] as link}<a
          class="account-row"
          href={link.href}
          ><span>{link.label}</span><span class="account-chevron" aria-hidden="true">›</span></a
        >{/each}
    </section>{/if}
  {#if profile || $session.me.must_change_password}
    <section class="card account-info">
      <h2>账号信息</h2>
      <label
        >手机号<input
          type="tel"
          value={$session.me.phone}
          readonly
          aria-describedby="profile-phone-help"
        /></label
      >
      <p id="profile-phone-help" class="micro muted">手机号用于登录，暂不支持修改。</p>
      {#if !$session.me.must_change_password}<form novalidate on:submit|preventDefault={rename}>
          <label>显示昵称<input bind:value={nickname} required maxlength="30" /></label>
          <p class="micro muted">更改不追溯订单，下次提交认购时再次确认群昵称。</p>
          <div class="actions"><button class="btn" disabled={busy}>确认更新昵称</button></div>
        </form>{/if}
    </section>
    <form novalidate class="card" on:submit|preventDefault={changePassword}>
      <h2>修改密码</h2>
      {#if !$session.me.must_change_password}<label
          >当前密码<input
            bind:value={current}
            type="password"
            autocomplete="current-password"
            required
          /></label
        >{:else}<p class="micro muted">
          当前受限会话已验证临时凭据，无需再次填写当前密码，请直接设置新密码。
        </p>{/if}<label
        >新密码<input bind:value={next} type="password" autocomplete="new-password" required /></label
      >
      <p class="micro muted">{passwordHelp}</p>
      <label
        >确认新密码<input bind:value={repeat} type="password" autocomplete="new-password" required /></label
      >
      <div class="actions"><button class="btn primary" disabled={busy}>修改密码并重新登录</button></div>
    </form>{/if}
  <div class="account-secondary">
    {#if $session.me.platform_admin && !$session.me.must_change_password}<a class="btn" href="/admin/reset"
        >管理员重置密码</a
      >{/if}<button type="button" class="btn danger" disabled={busy} on:click={logout}>退出登录</button>
  </div>
  <Modal open={avatarOpen} title="维护头像" {busy} close={() => (avatarOpen = false)}
    ><div class="avatar-maintenance" aria-busy={busy}>
      <button
        type="button"
        class="avatar-picker"
        disabled={busy}
        aria-label="选择并上传新头像"
        aria-describedby="avatar-help"
        on:click={() => avatarInput.click()}
        ><img
          class="account-avatar large"
          src={avatarSrc}
          alt="当前头像"
          referrerpolicy="no-referrer"
          on:error={() => (avatarFailed = true)}
        /></button
      >
      <p id="avatar-help" class="micro muted">
        点击圆头像更换 · JPEG / PNG，≤5MiB、800 万像素；自动压缩到最长边 256 像素、≤256KiB。
      </p>
      <input
        bind:this={avatarInput}
        type="file"
        accept="image/jpeg,image/png"
        hidden
        aria-label="选择头像文件"
        disabled={busy}
        on:change={(e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (file) void avatar(file)
        }}
      />{#if busy}<p role="status">正在保存头像…</p>{/if}{#if error}<p class="notice error" role="alert">
          {error}
        </p>{/if}<button
        type="button"
        class="btn"
        disabled={busy || !$session.me.avatar_url}
        on:click={() => avatar(null)}>恢复默认头像</button
      >
    </div></Modal
  >
{/if}

<style>
  .account-info > label {
    display: grid;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 15px;
  }
  .account-info input[readonly] {
    background: var(--soft);
  }
</style>
