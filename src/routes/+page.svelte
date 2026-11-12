<script lang="ts">
  import { autoRefresh } from '#lib/autoRefresh.ts'
  import { onMount } from 'svelte'
  import { pool, draft, readBasket, pendingBasket } from '#lib/basket.ts'
  import { session, command, community, errorText } from '#lib/api.ts'
  import { money, confirmation } from '#lib/ui.ts'
  import { thumbnailUrl } from '#lib/urls.ts'
  import Icon from '#lib/components/Icon.svelte'
  import Stepper from '#lib/components/Stepper.svelte'
  import { goto } from '$app/navigation'
  import LoadState from '#lib/components/LoadState.svelte'
  import LoadMore from '#lib/components/LoadMore.svelte'
  import type { PoolItem } from '#lib/types.ts'
  let search = '',
    error = '',
    busy = false,
    count = 10
  $: resetSearch(search)
  function resetSearch(_search: string) {
    count = 10
  }
  $: items = $pool.filter(
    (p) =>
      p.status === 'POOL' &&
      p.enabled &&
      p.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  )
  $: total = Object.values($draft).reduce((s, l) => s + l.quantity * l.item.unit_price_cent, 0)
  let reading = false
  async function load(quiet = false) {
    if (reading) return
    reading = true
    if (!quiet) {
      busy = true
      error = ''
    }
    try {
      await readBasket()
      refreshError = ''
    } catch (e) {
      if (quiet) refreshError = '状态暂未更新，请检查网络或点击刷新。'
      else error = errorText(e)
    } finally {
      reading = false
      if (!quiet) busy = false
    }
  }
  async function remove(p: PoolItem) {
    const reason = await confirmation('删除拼单商品', '取消本件及当前认购，保留历史记录。请输入原因。', true)
    if (!reason) return
    busy = true
    try {
      await command(community + '/pool-items/' + p.id + '/cancel', { version: p.version, reason })
      await readBasket()
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
  function openItem(event: MouseEvent | KeyboardEvent, id: string) {
    if ((event.target as HTMLElement).closest('a,button,input,output')) return
    event.preventDefault()
    void goto('/pool/' + id)
  }
  let refreshError = ''
  onMount(() => {
    void load()
    return autoRefresh(
      () => load(true),
      () => !busy
    )
  })
</script>

<div class="home-compact">
  <div class="page-head home-head">
    <div class="actions">
      <button class="btn" disabled={busy} aria-label="刷新" title="刷新" on:click={() => load()}
        ><Icon /></button
      ><a class="btn primary" href="/products/select">发布</a>
    </div>
  </div>
  {#if $pendingBasket}<p class="notice" role="status">
      上次提交结果尚未确认，请前往购物车恢复安全会话并原样重试。<span class="actions"
        ><a class="btn" href="/cart">去购物车处理</a></span
      >
    </p>{/if}
  {#if refreshError}<p class="notice" role="status">{refreshError}</p>{/if}
  <label class="search-label home-search"
    ><span class="visually-hidden">搜索商品</span><input
      type="search"
      bind:value={search}
      placeholder="搜索想拼的好物"
    /></label
  >
  <LoadState
    loading={busy}
    {error}
    empty={!items.length}
    emptyText={search.trim()
      ? '没有找到匹配商品，可以发布一件好物，邀请邻居一起拼。'
      : '暂时没有可拼商品。可以发布一件好物，邀请邻居一起拼。'}
    emptyAction="去发布"
    emptyHref="/products/select"
    retry={() => load()}
  >
    <div class="home-pools">
      {#each items.slice(0, count) as item (item.id)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
        <article
          class="card home-pool product-clickable"
          tabindex="0"
          aria-label={'查看' + item.name + '详情'}
          on:click={(e) => openItem(e, item.id)}
          on:keydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') openItem(e, item.id)
          }}
        >
          <a class="home-pool-image" href={'/pool/' + item.id} aria-label={'查看' + item.name + '详情'}
            >{#if thumbnailUrl(item.image_url)}<img
                src={thumbnailUrl(item.image_url)}
                alt={item.name}
                loading="lazy"
                decoding="async"
              />{:else}<span class="home-no-image">无图</span>{/if}</a
          >
          <div class="home-pool-copy">
            <h2><a href={'/pool/' + item.id}>{item.name}</a></h2>
            <p class="home-pool-publisher" title={'发布者：' + item.owner_name}>{item.owner_name} 发布</p>
            <div class="home-pool-meta">
              <strong>{money(item.unit_price_cent)}</strong><span
                >{item.remaining_quantity > 0 ? '待拼' + item.remaining_quantity : '已满'}</span
              >
            </div>
            <div class="home-progress">
              <progress
                value={item.reserved_quantity}
                max={item.capacity}
                aria-label={'已拼' + item.reserved_quantity + '份，共' + item.capacity + '份'}
              ></progress><small>{item.reserved_quantity}/{item.capacity}</small>
            </div>
          </div>
          <div class="home-pool-controls">
            {#if item.owner_id === $session.me?.id}<button
                class="home-delete"
                disabled={busy}
                aria-label={'删除' + item.name}
                title="删除"
                on:click|stopPropagation={() => remove(item)}><Icon name="trash" /></button
              >{/if}<Stepper {item} disabled={busy} />
          </div>
        </article>{/each}
    </div>
    <LoadMore
      shown={Math.min(count, items.length)}
      total={items.length}
      disabled={busy}
      more={() => (count += 10)}
    />
  </LoadState>
  {#if !busy}<section class="submit-bar home-submit" aria-label="购物车摘要">
      <strong>{Object.keys($draft).length} 件商品 · {money(total)}</strong><a class="btn primary" href="/cart"
        >结算</a
      >
    </section>{/if}
</div>
