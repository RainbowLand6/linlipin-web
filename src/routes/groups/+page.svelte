<script lang="ts">
  import { autoRefresh } from '#lib/autoRefresh.ts'
  import { onMount } from 'svelte'
  import { ApiError, unresolved, apiList, command, community, errorText } from '#lib/api.ts'
  import type { PoolItem, Preview, Group, GroupSummary } from '#lib/types.ts'
  import { money, dateTime, confirmation } from '#lib/ui.ts'
  import { goto } from '$app/navigation'
  import Icon from '#lib/components/Icon.svelte'
  let items: PoolItem[] = [],
    groups: GroupSummary[] = [],
    selected: string[] = [],
    preview: Preview | null = null,
    error = '',
    busy = false,
    title = '',
    location = '',
    pickup = '',
    notice = '',
    search = '',
    from = '',
    to = '',
    groupCount = 5
  let polling = false,
    selectionStale = false,
    refreshError = ''
  async function refreshItems() {
    if (polling || busy || $unresolved > 0) return
    polling = true
    try {
      const next = (await apiList<PoolItem>(community + '/pool-items')).filter(
        (i) => i.status === 'POOL' && i.reserved_quantity === i.capacity
      )
      if (busy || $unresolved > 0) return
      if (
        preview &&
        selected.some((id) => {
          const before = items.find((i) => i.id === id),
            after = next.find((i) => i.id === id)
          return (
            !before ||
            !after ||
            before.version !== after.version ||
            before.selection_token !== after.selection_token
          )
        })
      )
        selectionStale = true
      items = next
      refreshError = ''
    } catch {
      refreshError = '状态暂未更新，请检查网络或点击刷新。'
    } finally {
      polling = false
    }
  }
  async function load() {
    if (busy || polling) return
    if (preview) selectionStale = true
    busy = true
    try {
      items = (await apiList<PoolItem>(community + '/pool-items')).filter(
        (i) => i.status === 'POOL' && i.reserved_quantity === i.capacity
      )
      await find()
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
  async function find() {
    if (from && to && from > to) throw new Error('开始日期不能晚于结束日期。')
    const q = new URLSearchParams({ mine: 'true', name: search })
    if (from) q.set('created_from', new Date(from + 'T00:00:00+08:00').toISOString())
    if (to) q.set('created_to', new Date(new Date(to + 'T00:00:00+08:00').getTime() + 86400000).toISOString())
    groupCount = 5
    groups = await apiList(community + '/groups?' + q)
  }
  async function makePreview() {
    busy = true
    error = ''
    selectionStale = false
    selected = selected.filter((id) => items.some((i) => i.id === id))
    try {
      preview = await command(community + '/claims/preview', { pool_item_ids: selected })
      title = title || '邻里好物拼单'
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
  async function claim() {
    if (!preview || selectionStale) return
    if ((await confirmation('确认成团', '确认后按参与人生成订单与提货号，负责线下收款及提货。')) === null)
      return
    busy = true
    error = ''
    try {
      const group = await command<Group>(community + '/claims', {
        pool_item_ids: selected,
        versions: preview.versions,
        title,
        location,
        pickup_at: new Date(pickup).toISOString(),
        notice
      })
      await goto('/groups/' + group.id)
    } catch (e) {
      error = errorText(e)
      if (e instanceof ApiError && e.status === 409) selectionStale = true
    } finally {
      busy = false
      void refreshItems()
    }
  }
  onMount(() => {
    void load()
    return autoRefresh(refreshItems, () => !busy)
  })
</script>

<div class="parity-groups">
  <div class="page-head">
    <h2 class="section-title">可以成团的商品</h2>
    <button class="btn" disabled={busy} on:click={load} aria-label="刷新" title="刷新"><Icon /></button>
  </div>
  {#if refreshError}<p class="notice" role="status">{refreshError}</p>{/if}
  {#if selectionStale}<p class="notice error" role="alert">
      所选商品已成团或认购状态发生变化。已保留填写内容，请重新选择商品并预览后确认。
    </p>{/if}
  {#if error}<p class="notice error" role="alert">{error}</p>{/if}
  <section class="card" class:empty-stock={!items.length}>
    {#if !items.length}<p class="empty">暂时没有已满额、尚未成团的商品。先和邻居一起拼满吧。</p>{/if}
    {#if items.length}<button
        class="btn"
        disabled={busy}
        on:click={() => {
          selected = items.every((i) => selected.includes(i.id)) ? [] : items.map((i) => i.id)
          preview = null
        }}>{items.every((i) => selected.includes(i.id)) ? '取消全选' : '全选'}</button
      >{/if}
    {#each items as item}<label class="claim-row"
        ><input
          bind:group={selected}
          value={item.id}
          type="checkbox"
          disabled={busy}
          on:change={() => (preview = null)}
        /><span
          ><strong>{item.name} · 第 {item.item_no} 件</strong><small
            >{item.capacity} 份 · {money(item.unit_price_cent)}/份 · {item.owner_name}</small
          ></span
        ><span class="pill">已满件</span></label
      >{/each}
    <div class="actions">
      <button class="btn primary" disabled={!selected.length || busy} on:click={makePreview}
        >{busy ? '处理中…' : '预览成团与订单'}</button
      >
    </div>
  </section>
  {#if preview}<form novalidate class="card" on:submit|preventDefault={claim}>
      <h2>确认本次团信息</h2>
      <div class="notice">
        {preview.items.length} 件商品 · {preview.order_count} 份订单 · {money(preview.total_amount_cent)}
      </div>
      <label>团名称<input bind:value={title} maxlength="100" required disabled={busy} /></label><label
        >提货地点<input bind:value={location} required maxlength="200" disabled={busy} /></label
      ><label>提货时间<input bind:value={pickup} type="datetime-local" required disabled={busy} /></label
      ><label
        >团通知<textarea
          bind:value={notice}
          maxlength="1000"
          disabled={busy}
          placeholder="付款方式、提货说明等"></textarea></label
      >
      <div class="actions">
        <button class="btn primary" disabled={busy || selectionStale}>确认发起并生成订单</button>
      </div>
    </form>{/if}
  <h2 class="section-title">我发起的团</h2>
  <form
    novalidate
    class="group-search"
    on:submit|preventDefault={() => find().catch((e) => (error = errorText(e)))}
  >
    <label>团名<input bind:value={search} type="search" placeholder="按团名称筛选" /></label>
    <fieldset class="group-date-range">
      <legend>时间范围</legend>
      <div>
        <label>从<input bind:value={from} type="date" /></label><label
          >至（包含当日）<input bind:value={to} type="date" /></label
        >
      </div>
    </fieldset>
    <button class="btn" disabled={busy}>搜索</button>
  </form>
  {#if !groups.length}<div class="empty card">还没有你发起的团；作为购买者的订单在「我的订单」。</div>{/if}
  <div class="group-grid initiated-groups">
    {#each groups.slice(0, groupCount) as group}<article class="card initiated-group">
        <div class="initiated-group-copy">
          <div class="initiated-group-heading">
            <h2>{group.title}</h2>
            <span class="pill">{group.status === 'ENDED' ? '已结束' : '履约中'}</span>
          </div>
          <p class="muted initiated-group-pickup">{group.location} · {dateTime(group.pickup_at)}</p>
          <div class="initiated-group-total">
            <small>{group.order_count} 份订单</small><strong>{money(group.total_amount_cent)}</strong>
          </div>
        </div>
        <a class="btn primary" href={'/groups/' + group.id}>管理本次团</a>
      </article>{/each}
  </div>
  <div class="actions">
    {#if groupCount < groups.length}<button class="btn" disabled={busy} on:click={() => (groupCount += 5)}
        >再显示 5 条</button
      >{/if}{#if groupCount > 5}<button class="btn" disabled={busy} on:click={() => (groupCount = 5)}
        >收起</button
      >{/if}
  </div>
</div>
