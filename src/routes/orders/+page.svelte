<script lang="ts">
  import { autoRefresh } from '#lib/autoRefresh.ts'
  import { onMount } from 'svelte'
  import { api, apiList, community, errorText } from '#lib/api.ts'
  import type { MyOrder, SubscriptionSet } from '#lib/types.ts'
  import { dateTime, money, statuses } from '#lib/ui.ts'
  let orders: MyOrder[] = [],
    error = '',
    pending: SubscriptionSet | null = null
  let reading = false
  async function load() {
    if (reading) return
    reading = true
    try {
      ;[orders, pending] = await Promise.all([
        apiList<MyOrder>(community + '/my-orders'),
        api<SubscriptionSet>(community + '/my-subscriptions')
      ])
      error = ''
    } catch (e) {
      error = errorText(e)
    } finally {
      reading = false
    }
  }
  onMount(() => {
    void load()
    return autoRefresh(load)
  })
</script>

<div class="page-head"><div><h1>我的订单</h1></div></div>
{#if error}<p class="notice error" role="alert">{error}</p>{/if}
<section class="card">
  <span class="pill green">待领团认购</span>
  <div class="row">
    <div>
      <h2>{pending?.lines.length || 0} 件商品</h2>
      <small>领团前可逐件修改目标总量，设为 0 即取消。</small>
    </div>
    <strong>{money(pending?.lines.reduce((s, l) => s + l.quantity * l.unit_price_cent, 0) ?? 0)}</strong>
  </div>
  <div class="actions"><a class="btn primary" href="/orders/pending">查看待领认购详情</a></div>
</section>
<h2 class="section-title">成交订单</h2>
{#if !orders.length}<p class="card empty">还没有已领团的订单。</p>{/if}
{#each orders as order}<article class="card">
    <div class="row">
      <div>
        <h2>{order.group_title}</h2>
        <small>{order.organizer_name} 领团 · {order.location}<br />{dateTime(order.pickup_at)}</small>
      </div>
      <span class="pill">{statuses[order.status]}</span>
    </div>
    <div class="row">
      <span>提货号 {order.pickup_no} · {order.lines.length} 条商品</span><strong
        >{money(order.payable_amount_cent)}</strong
      >
    </div>
    <div class="actions"><a class="btn" href={'/orders/' + order.id}>查看成交详情</a></div>
  </article>{/each}
