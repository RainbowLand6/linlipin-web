<script lang="ts">
  import { autoRefresh } from '#lib/autoRefresh.ts'
  import { onMount } from 'svelte'
  import { draft, remove, readBasket, submit, reconcile, hasPending, pendingBasket } from '#lib/basket.ts'
  import { session, errorText } from '#lib/api.ts'
  import { money } from '#lib/ui.ts'
  import Modal from '#lib/components/Modal.svelte'
  import ItemThumb from '#lib/components/ItemThumb.svelte'
  import { pool } from '#lib/basket.ts'
  import { csrf } from '#lib/api.ts'
  import LoadState from '#lib/components/LoadState.svelte'
  import Stepper from '#lib/components/Stepper.svelte'
  import Icon from '#lib/components/Icon.svelte'
  import { goto } from '$app/navigation'
  let error = '',
    busy = false,
    name = '',
    open = false,
    loaded = false
  $: total = Object.values($draft).reduce((s, l) => s + l.quantity * l.item.unit_price_cent, 0)
  async function load() {
    busy = true
    error = ''
    try {
      await readBasket()
      loaded = true
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
  async function checkout() {
    busy = true
    error = ''
    try {
      if (!name.trim() || [...name.trim()].length > 30) throw new Error('请输入1–30字的群昵称。')
      await submit(name)
      open = false
      await goto('/orders/pending')
    } catch (e) {
      error = errorText(e)
      await readBasket().catch(() => {})
    } finally {
      busy = false
    }
  }
  $: lines = Object.values($draft)
  $: conflict = lines.some((l) => {
    const p = $pool.find((p) => p.id === l.item.id)
    return !p || p.selection_token !== l.item.selection_token
  })
  $: invalid = lines.some((l) => {
    const p = $pool.find((p) => p.id === l.item.id)
    return (
      !p ||
      p.status !== 'POOL' ||
      !p.enabled ||
      l.quantity > p.remaining_quantity ||
      l.quantity < p.min_quantity
    )
  })
  function show() {
    name = $session.me?.display_name ?? ''
    error = ''
    open = true
  }
  async function restoreSecurity() {
    try {
      await csrf()
    } catch (e) {
      error = errorText(e)
    }
  }
  onMount(() => {
    name = $session.me?.display_name ?? ''
    void load()
    return autoRefresh(
      () => readBasket(),
      () => !busy && !open && !$pendingBasket
    )
  })
</script>

<div class="page-head"><div><h1>我的购物车</h1></div></div>
<LoadState loading={busy && !loaded} retry={load}>
  {#if !lines.length}<div class="card empty">购物车是空的。<a href="/">去首页看看好物</a></div>{:else}<section
      class="card cart-lines"
    >
      {#each lines as line (line.item.id)}<div class="cart-line">
          <ItemThumb src={line.item.image_url} alt={line.item.name || '商品图片'} />
          <div class="cart-line-info">
            <a href={'/pool/' + line.item.id}><strong>{line.item.name}</strong></a><strong
              class="cart-line-price">{money(line.item.unit_price_cent * line.quantity)}</strong
            >
          </div>
          <div class="cart-line-controls">
            <Stepper item={$pool.find((p) => p.id === line.item.id) ?? line.item} disabled={busy} /><button
              type="button"
              class="btn cart-remove"
              disabled={busy || $pendingBasket}
              aria-label={'删除' + line.item.name + '购物车商品'}
              title="删除"
              on:click={() => remove(line.item.id)}><Icon name="trash" /></button
            >
          </div>
        </div>{/each}
    </section>{/if}
  <section class="card subscription-summary">
    {#if conflict && !$pendingBasket}<p class="notice error" role="alert">
        商品版本、价格或认购状态已变化，已保留选购时的快照和数量。点击“重新核对”将更新选购快照，请检查新金额后再次确认群昵称。<span
          class="actions"
          ><button
            class="btn"
            disabled={busy}
            on:click={async () => {
              await load()
              reconcile()
            }}>重新核对</button
          ></span
        >
      </p>{/if}
    {#if $pendingBasket}<p class="notice" role="status">
        上次提交结果尚未确认，原昵称、数量和商品版本已锁定。安全校验失败可刷新安全会话后原样重试；登录失效或需改密时，请用同一账号完成后返回重试。<span
          class="actions"
          ><button
            class="btn"
            disabled={busy}
            aria-label="刷新安全会话"
            title="刷新安全会话"
            on:click={restoreSecurity}><Icon /></button
          ></span
        >
      </p>{/if}
    {#if error && !open}<p class="notice error preserve" role="alert">{error}</p>{/if}
    <div class="row"><strong>{lines.length} 件商品</strong><strong class="price">{money(total)}</strong></div>
    {#if invalid}<p class="error" role="alert">
        商品已失效、超过余量或不满足起订量，请调整数量。<span class="actions"
          ><button
            class="btn"
            disabled={busy || $pendingBasket}
            on:click={async () => {
              await load()
              reconcile()
            }}>重新核对</button
          ></span
        >
      </p>{/if}
    <div class="actions">
      <button
        class="btn primary"
        disabled={busy || !loaded || (!$pendingBasket && (!lines.length || invalid || conflict))}
        on:click={show}>提交认购</button
      >
    </div>
  </section>
</LoadState>
<Modal {open} title="确认本次认购" {busy} close={() => (open = false)}
  ><form novalidate on:submit|preventDefault={checkout}>
    <p class="muted">本次新增 {lines.length} 件商品，{money(total)}。已提交的认购保持不变。</p>
    <label
      >本次确认的群昵称<input
        bind:value={name}
        disabled={busy || $pendingBasket}
        autocomplete="nickname"
      /></label
    >
    <p class="micro muted">预填当前群昵称，可在提交前修改。本次确认昵称用于订单。</p>
    {#if error}<p class="notice error preserve" role="alert">{error}</p>{/if}
    <div class="actions">
      <button
        class="btn primary"
        disabled={busy || (!$pendingBasket && (conflict || invalid || !lines.length))}
        >{busy ? '正在提交…' : $pendingBasket ? '原样重试提交' : '确认并提交认购'}</button
      >
    </div>
  </form></Modal
>
