<script lang="ts">
  import { onMount } from 'svelte'
  import { autoRefresh } from '#lib/autoRefresh.ts'

  import { page } from '#lib/page.svelte.ts'
  import { api, command, community, errorText } from '#lib/api.ts'
  import type { Group, Order } from '#lib/types.ts'
  import { money, dateTime, confirmation, statuses } from '#lib/ui.ts'
  import OrderTicket from '#lib/components/OrderTicket.svelte'
  import Icon from '#lib/components/Icon.svelte'
  let group: Group | null = null,
    error = '',
    busy = false,
    loaded = '',
    lookup = '',
    status = 'all'
  let reading = false,
    generation = 0,
    readingPath = ''
  $: base = community + '/groups/' + $page.params.id
  $: if (loaded !== $page.params.id) {
    loaded = $page.params.id ?? ''
    void load()
  }
  $: shown =
    group?.orders.filter(
      (o) =>
        (!lookup.trim() ||
          o.member_name.includes(lookup.trim()) ||
          String(o.pickup_no).includes(lookup.trim())) &&
        (status === 'all' || status === o.status)
    ) ?? []
  async function load(quiet = false) {
    const path = base
    if (reading && readingPath === path) return
    readingPath = path
    reading = true
    const request = ++generation
    if (!quiet) busy = true
    try {
      const next = await api<Group>(path)
      if (request !== generation || path !== base || (quiet && busy)) return
      group = next
    } catch (e) {
      if (request === generation) error = errorText(e)
    } finally {
      if (request === generation) {
        reading = false
        if (!quiet) busy = false
      }
    }
  }
  onMount(() =>
    autoRefresh(
      () => load(true),
      () => !busy
    )
  )
  async function act(order: Order, action: string, line?: string) {
    const label: Record<string, string> = {
      payments: '确认线下收款',
      'payments/revoke': '撤销收款',
      'cancel-line': '取消整条商品明细',
      refunds: '确认线下已退款',
      pickup: '核号并确认整单提货'
    }
    const reason = await confirmation(
      label[action] + ' · ' + order.pickup_no + '号',
      action === 'refunds'
        ? '确认已退还 ' + money(order.refund_due_cent)
        : '操作将更新服务器记录，请核对后确认。',
      action === 'payments/revoke' || action === 'cancel-line'
    )
    if (reason === null) return
    generation++
    reading = false
    busy = true
    error = ''
    try {
      await command(base + '/orders/' + order.id + '/' + action, {
        version: order.version,
        ...(line ? { line_id: line } : {}),
        ...(['payments/revoke', 'cancel-line'].includes(action) ? { reason } : {})
      })
      await load()
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
  async function cancelItem(id: string) {
    if (!group) return
    const reason = await confirmation('取消本团整件商品', '填写缺货原因，已收款将产生待退款。', true)
    if (!reason) return
    generation++
    reading = false
    busy = true
    try {
      group = await command(base + '/cancel-item', { version: group.version, pool_item_id: id, reason })
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
  async function end() {
    if (!group || (await confirmation('结束本次团', '服务器将检查所有提货与退款记录。')) === null) return
    generation++
    reading = false
    busy = true
    try {
      group = await command(base + '/end', { version: group.version })
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
</script>

<div class="page-head">
  <h1>{group?.title ?? '本次团管理'}</h1>
</div>
{#if error}<p class="notice error" role="alert">{error}</p>{/if}{#if group}<section class="card">
    <div class="row">
      <div>
        <h2>{group.organizer_name} 发起</h2>
        <small>{group.location} · {dateTime(group.pickup_at)}</small>
      </div>
      <span class="pill">{statuses[group.status]}</span>
    </div>
    <p class="preserve muted">{group.notice || '暂无额外通知'}</p>
    <div class="stats">
      <div><small>订单数</small><strong>{group.orders.length}</strong></div>
      <div>
        <small>当前应付合计</small><strong
          >{money(group.orders.reduce((s, o) => s + o.payable_amount_cent, 0))}</strong
        >
      </div>
      <div>
        <small>待退合计</small><strong
          >{money(group.orders.reduce((s, o) => s + o.refund_due_cent, 0))}</strong
        >
      </div>
    </div>
    <div class="actions">
      <a class="btn primary" href={'/groups/' + group.id + '/share'}>分享本次团购</a><button
        class="btn"
        disabled={busy || group.status === 'ENDED'}
        on:click={end}>结束本次团</button
      >
    </div>
  </section>
  <details class="card">
    <summary>本团商品 · 整件取消</summary>{#each group.items as item}<div class="row">
        <div>{item.name}<small>第 {item.item_no} 件</small></div>
        <button
          class="btn danger"
          disabled={busy || group.status === 'ENDED' || item.status === 'CANCELLED'}
          on:click={() => cancelItem(item.id)}>取消整件</button
        >
      </div>{/each}
  </details>
  <div class="search">
    <label>查提货号 / 群昵称<input type="search" bind:value={lookup} placeholder="输入号码或昵称" /></label
    ><label
      >订单状态<select bind:value={status}
        ><option value="all">全部</option
        >{#each ['WAIT_PAYMENT', 'WAIT_PICKUP', 'WAIT_REFUND', 'COMPLETED', 'NO_DEAL'] as value}<option
            {value}>{statuses[value]}</option
          >{/each}</select
      ></label
    >
  </div>
  {#each shown as order}<section class="card">
      <OrderTicket {order} />
      <div class="actions">
        <button
          class="btn primary"
          disabled={busy || group.status === 'ENDED' || order.status !== 'WAIT_PAYMENT'}
          on:click={() => act(order, 'payments')}>确认收款</button
        ><button
          class="btn"
          disabled={busy ||
            group.status === 'ENDED' ||
            order.paid_amount_cent <= 0 ||
            !!order.picked_up_at ||
            order.refunded_amount_cent > 0 ||
            order.lines.some((l) => l.cancelled)}
          on:click={() => act(order, 'payments/revoke')}>撤销收款</button
        ><button
          class="btn"
          disabled={busy || group.status === 'ENDED' || order.refund_due_cent <= 0}
          on:click={() => act(order, 'refunds')}>确认已退 {money(order.refund_due_cent)}</button
        ><button
          class="btn primary"
          disabled={busy || group.status === 'ENDED' || order.status !== 'WAIT_PICKUP'}
          on:click={() => act(order, 'pickup')}>核号并提货</button
        >
      </div>
      {#if group.status !== 'ENDED'}<details>
          <summary>更正订单 · 取消商品明细</summary>{#each order.lines as line}<div class="row">
              <span>{line.name} · 第 {line.item_no} 件 · {line.quantity}份</span><button
                class="btn danger"
                disabled={busy || line.cancelled || !!order.picked_up_at}
                on:click={() => act(order, 'cancel-line', line.id)}
                >{line.cancelled ? '已取消' : '取消整条明细'}</button
              >
            </div>{/each}
        </details>{/if}
      <small class="micro muted">订单版本 {order.version}</small>
    </section>{:else}<p class="card empty">没有符合条件的订单。</p>{/each}{/if}
