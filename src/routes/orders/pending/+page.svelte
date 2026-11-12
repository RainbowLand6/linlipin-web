<script lang="ts">
  import { autoRefresh } from '#lib/autoRefresh.ts'
  import { onMount } from 'svelte'
  import { api, community, command, errorText, session, unresolved } from '#lib/api.ts'
  import type { SubscriptionSet, PoolDetail } from '#lib/types.ts'
  import { money, confirmation } from '#lib/ui.ts'
  import ItemThumb from '#lib/components/ItemThumb.svelte'
  import Icon from '#lib/components/Icon.svelte'
  let set: SubscriptionSet | null = null,
    error = '',
    busy = false,
    items: Record<string, PoolDetail> = {},
    success = ''
  let reading = false
  async function load(quiet = false) {
    if (reading) return
    reading = true
    if (!quiet) busy = true
    try {
      const next = await api<SubscriptionSet>(community + '/my-subscriptions')
      const detail = await Promise.all(
        next.lines.map((l) => api<PoolDetail>(community + '/pool-items/' + l.pool_item_id))
      )
      if (quiet && busy) return
      set = next
      items = Object.fromEntries(detail.map((p) => [p.id, p]))
    } catch (e) {
      error = errorText(e)
    } finally {
      reading = false
      if (!quiet) busy = false
    }
  }
  async function change(id: string, q: number) {
    if (!set || busy) return
    if (reading) {
      error = '正在更新认购状态，请稍后再试。'
      return
    }
    if (q === 0 && (await confirmation('删除认购', '取消该商品的待成团认购？')) === null) return
    busy = true
    error = ''
    try {
      set = await command(
        community + '/my-subscriptions',
        {
          version: set.version,
          member_name: $session.me?.display_name ?? set.display_name,
          changes: [{ pool_item_id: id, quantity: q }]
        },
        'PATCH'
      )
      success = '目标总量已更新，其他商品认购保持不变。'
      await load()
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
  onMount(() => {
    void load()
    return autoRefresh(
      () => load(true),
      () => !busy && !$unresolved
    )
  })
</script>

<div class="page-head">
  <div><h1>待成团认购详情</h1></div>
  <button class="btn" disabled={busy} on:click={() => load()} aria-label="刷新认购状态" title="刷新认购状态"
    ><Icon /></button
  >
</div>
{#if error}<p class="notice error preserve" role="alert">{error}</p>{/if}{#if success}<p
    class="notice success"
    role="status"
  >
    {success}
  </p>{/if}
{#if set}<section class="card">
    {#if !set.lines.length}<p class="empty">
        暂无待成团认购。<a href="/">去首页选购</a>
      </p>{/if}{#each set.lines as line}<div class="subscription-line">
        <ItemThumb src={items[line.pool_item_id]?.image_url} alt={line.name} />
        <div class="subscription-line-info">
          <a href={'/pool/' + line.pool_item_id}><strong>{line.name}</strong></a><small
            title={items[line.pool_item_id]?.can_edit_subscription ? '待成团，可修改' : '已成团或不可编辑'}
            >{line.quantity} 份 × {money(line.unit_price_cent)}</small
          >
        </div>
        <div class="subscription-controls">
          <div class="stepper">
            <button
              class="btn"
              aria-label={'减少' + line.name + '目标总量'}
              disabled={busy ||
                !items[line.pool_item_id]?.can_edit_subscription ||
                line.quantity <= (items[line.pool_item_id]?.min_quantity ?? 1)}
              on:click={() => change(line.pool_item_id, line.quantity - 1)}>−</button
            ><output aria-label={line.name + '目标总量'}>{line.quantity}</output><button
              class="btn"
              aria-label={'增加' + line.name + '目标总量'}
              disabled={busy ||
                !items[line.pool_item_id]?.can_edit_subscription ||
                line.quantity >=
                  (items[line.pool_item_id]?.remaining_quantity ?? 0) +
                    (items[line.pool_item_id]?.own_quantity ?? 0)}
              on:click={() => change(line.pool_item_id, line.quantity + 1)}>+</button
            >
          </div>
          <button
            class="btn danger"
            aria-label={'删除' + line.name + '认购'}
            disabled={busy || !items[line.pool_item_id]?.can_edit_subscription}
            on:click={() => change(line.pool_item_id, 0)}
            title="删除"><Icon name="trash" /></button
          >
        </div>
      </div>{/each}
  </section>{/if}
