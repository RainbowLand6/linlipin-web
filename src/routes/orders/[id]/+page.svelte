<script lang="ts">
  import { onMount } from 'svelte'
  import { autoRefresh } from '#lib/autoRefresh.ts'
  import { page } from '#lib/page.svelte.ts'
  import { api, community, errorText } from '#lib/api.ts'
  import type { MyOrder } from '#lib/types.ts'
  import OrderTicket from '#lib/components/OrderTicket.svelte'
  import Icon from '#lib/components/Icon.svelte'
  import { dateTime } from '#lib/ui.ts'
  let order: MyOrder | null = null,
    error = '',
    busy = false,
    loaded = ''
  let generation = 0,
    reading = false,
    readingID = ''
  $: if ($page.params.id !== loaded) {
    loaded = $page.params.id ?? ''
    void load()
  }
  async function load() {
    const id = loaded
    if (reading && readingID === id) return
    readingID = id
    reading = true
    const request = ++generation
    try {
      const next = await api<MyOrder>(community + '/my-orders/' + id)
      if (request !== generation || id !== $page.params.id) return
      order = next
      error = ''
    } catch (e) {
      if (request === generation) error = errorText(e)
    } finally {
      if (request === generation) reading = false
    }
  }
  onMount(() => autoRefresh(load))
</script>

<div class="page-head">
  <div><h1>成交订单详情</h1></div>
</div>
{#if error}<p class="notice error" role="alert">{error}</p>{/if}{#if order}<section class="card">
    <div class="ticket-context">
      <h2>{order.group_title}</h2>
      <p>{order.organizer_name} 领团 · {order.location}<br />{dateTime(order.pickup_at)}</p>
    </div>
    <OrderTicket {order} />
  </section>{/if}
