<script lang="ts">
  import { draft, adjust, pendingBasket } from '#lib/basket.ts'
  import type { PoolItem } from '#lib/types.ts'
  export let item: PoolItem
  export let disabled = false
  $: quantity = $draft[item.id]?.quantity ?? 0
</script>

<div class="stepper">
  <button
    class="btn"
    aria-label={'减少' + item.name + '本次新增份数'}
    disabled={disabled || $pendingBasket || quantity <= 0}
    on:click|stopPropagation={() => adjust(item, -1)}>−</button
  ><output aria-label={item.name + '本次新增数量'}>{quantity}</output><button
    class="btn"
    aria-label={'增加' + item.name + '本次新增份数'}
    disabled={disabled || $pendingBasket || item.status !== 'POOL' || quantity >= item.remaining_quantity}
    on:click|stopPropagation={() => adjust(item, 1)}>+</button
  >
</div>
