<script lang="ts">
  import type { Order } from '#lib/types.ts'
  import { money, dateTime, statuses } from '#lib/ui.ts'
  import ItemThumb from './ItemThumb.svelte'
  export let order: Order
</script>

<div class="ticket">
  <header>
    <div>
      <span class="eyebrow">{order.member_name}</span>
      <h2>{statuses[order.status]}</h2>
    </div>
    <div class="pickup"><small>提货号</small><strong>{order.pickup_no}</strong></div>
  </header>
  {#each order.lines as line (line.id)}<div class="ticket-line">
      <div class="row" class:cancelled={line.cancelled}>
        <div class="ticket-line-info">
          <ItemThumb src={line.image_url} alt={line.name} />
          <div>
            <strong>{line.name}</strong> · 第 {line.item_no} 件<small
              >{line.quantity} 份 × {money(line.unit_price_cent)}{#if line.cancelled}<span>
                  · 已取消：{line.reason}</span
                >{/if}</small
            >
          </div>
        </div>
        <strong>{money(line.original_amount_cent)}</strong>
      </div>
    </div>{/each}
  <div class="row">
    <div>
      <small
        >原始 {money(order.original_amount_cent)} · 已付 {money(order.paid_amount_cent)} · 已退 {money(
          order.refunded_amount_cent
        )}</small
      >{#if order.refund_due_cent > 0}<small class="error">待退 {money(order.refund_due_cent)}</small
        >{/if}{#if order.picked_up_at}<small>提货 {dateTime(order.picked_up_at)}</small>{/if}
    </div>
    <strong>{money(order.payable_amount_cent)}<small>当前应付</small></strong>
  </div>
</div>
