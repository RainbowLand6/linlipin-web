<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { page } from '#lib/page.svelte.ts'
  import { session, startup, errorText, unresolved, csrf } from '#lib/api.ts'
  import { draft } from '#lib/basket.ts'
  import Icon from '#lib/components/Icon.svelte'
  import Confirm from '#lib/components/Confirm.svelte'
  import BackToTop from '#lib/components/BackToTop.svelte'
  let error = ''
  const navigation = [
    { to: '/', label: '首页', icon: 'home' },
    { to: '/cart', label: '购物车', icon: 'cart' },
    { to: '/me', label: '我的', icon: 'user' },
    { to: '/groups', label: '组团', icon: 'group' }
  ]
  $: publicPage = ['/me'].includes($page.url.pathname) || /^\/(c|g)\//.test($page.url.pathname)
  $: path = $page.url.pathname
  $: showBackToTop = ['/', '/orders', '/products', '/me/products', '/groups'].includes(path)
  $: title =
    path === '/products/select'
      ? '发布'
      : path === '/products'
        ? '我的商品库'
        : path === '/me/products'
          ? '我发布的商品'
          : path === '/me/profile'
            ? '个人信息管理'
            : path === '/me/invite'
              ? '社区入会邀请'
              : path === '/admin/reset'
                ? '管理员重置密码'
                : path === '/orders/pending'
                  ? '待成团认购'
                  : path.startsWith('/orders/')
                    ? '成交订单详情'
                    : path === '/orders'
                      ? '我的订单'
                      : path.startsWith('/pool/')
                        ? '商品详情'
                        : /^\/groups\/[^/]+\/share$/.test(path)
                          ? '分享本次团购'
                          : path.startsWith('/groups/')
                            ? '团长管理'
                            : path.startsWith('/c/')
                              ? '社区邀请'
                              : path.startsWith('/g/')
                                ? '团单信息'
                                : (navigation.find((n) => n.to === path)?.label ?? '邻里拼')
  $: back = /^\/groups\/[^/]+\/share$/.test(path)
    ? path.replace(/\/share$/, '')
    : path.startsWith('/groups/')
      ? '/groups'
      : path.startsWith('/orders/')
        ? '/orders'
        : path.startsWith('/pool/')
          ? '/'
          : '/me'
  async function load() {
    error = ''
    try {
      await startup()
    } catch (e) {
      error = errorText(e)
    }
  }
  onMount(load)
</script>

<Confirm />
<svelte:head><title>{title} · 邻里拼</title></svelte:head>
<a class="skip-link" href="#main">跳到内容</a>
<div class="app-shell">
  <aside class="sidebar">
    <a class="brand" href="/">邻里拼</a>
    <nav aria-label="主导航">
      {#each navigation as nav}<a class:router-link-active={$page.url.pathname === nav.to} href={nav.to}
          ><Icon name={nav.icon} />{nav.label}{#if nav.to === '/cart' && Object.keys($draft).length}<small
              >{Object.keys($draft).length}</small
            >{/if}</a
        >{/each}
    </nav>
    <div class="sidebar-foot">
      <span class="eyebrow">OUR NEIGHBORHOOD</span>
      <p>邻里拼社区</p>
      <small>线下付款 · 按号提货</small>
    </div>
  </aside>
  <div class="workspace">
    <header class="topbar">
      <div class="actions compact">
        {#if !navigation.some((n) => n.to === $page.url.pathname)}<a
            class="back"
            href={back}
            aria-label="返回上一页">←</a
          >{/if}<span>{title}</span>
      </div>
      {#if $session.me?.display_name}<span class="account-link">{$session.me.display_name}</span>{/if}
    </header>
    <main id="main" tabindex="-1">
      {#if error}<p class="notice error" role="alert">
          {error}<button class="btn" on:click={load}>重试连接</button>
        </p>{:else if !$session.ready}<p class="empty" role="status">
          正在建立安全会话…
        </p>{:else if !$session.me && !publicPage}<div class="welcome card">
          <span class="eyebrow">一起买，刚刚好</span>
          <h1>加入社区，一起拼单</h1>
          <p class="muted">加入社区，发布商品、共同拼件，满件后由邻居发起成团。</p>
          <a class="btn primary" href="/me">登录 / 注册</a>
        </div>{:else if $session.me?.must_change_password && !$page.url.pathname.startsWith('/me')}<p
          class="notice"
        >
          <a href="/me/profile">请先修改临时密码</a>
        </p>{:else}{#if $unresolved}<p class="notice error" role="status">
            有操作结果尚未确认，请保留原内容，用原账号原样重试。<button
              class="btn"
              aria-label="刷新安全会话"
              title="刷新安全会话"
              on:click={() => csrf().catch((e) => (error = errorText(e)))}><Icon /></button
            >
          </p>{/if}{#key $session.epoch}<slot />{/key}{/if}
    </main>
  </div>
</div>
<nav class="mobile-nav" aria-label="手机主导航">
  {#each navigation as nav}<a class:router-link-active={$page.url.pathname === nav.to} href={nav.to}
      ><span class="nav-icon"
        ><Icon name={nav.icon} />{#if nav.to === '/cart' && Object.keys($draft).length}<b
            >{Object.keys($draft).length}</b
          >{/if}</span
      >{nav.label}</a
    >{/each}
</nav>
{#if showBackToTop && $session.me && !$session.me.must_change_password}
  {#key path}<BackToTop />{/key}
{/if}
