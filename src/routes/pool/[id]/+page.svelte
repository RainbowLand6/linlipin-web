<script lang="ts">
  import { onMount } from 'svelte'
  import { autoRefresh } from '#lib/autoRefresh.ts'

  import { page } from '#lib/page.svelte.ts'
  import { api, community, errorText } from '#lib/api.ts'
  import { readBasket, draft, pool, pendingBasket } from '#lib/basket.ts'
  import type { PoolDetail, Participation } from '#lib/types.ts'
  import { dateTime, money, statuses } from '#lib/ui.ts'
  import { resolveMediaUrl } from '#lib/urls.ts'
  import fallback from '#lib/assets/default-product.svg'
  import Icon from '#lib/components/Icon.svelte'
  import LoadState from '#lib/components/LoadState.svelte'
  import Stepper from '#lib/components/Stepper.svelte'
  let item: PoolDetail | null = null
  let people: Participation | null = null
  let error = '',
    busy = false,
    open = true
  let loaded = '',
    refreshError = ''
  let reading = false,
    readingID = '',
    generation = 0
  $: if ($page.params.id && loaded !== $page.params.id) {
    loaded = $page.params.id ?? ''
    void load(loaded)
  }
  $: current = item ? $pool.find((p) => p.id === item?.id) : undefined
  $: total = Object.values($draft).reduce((s, l) => s + l.quantity * l.item.unit_price_cent, 0)
  async function load(id: string, quiet = false) {
    if (reading && readingID === id) return
    readingID = id
    const request = ++generation
    reading = true
    if (!quiet) error = ''
    if (!quiet) busy = true
    try {
      await readBasket()
      const result = await api<PoolDetail>(community + '/pool-items/' + id)
      if (id !== $page.params.id || request !== generation) return
      const participants =
        result.status === 'CANCELLED'
          ? null
          : await api<Participation>(community + '/pool-items/' + id + '/participants')
      if (id !== $page.params.id || request !== generation) return
      item = result
      people = participants
      refreshError = ''
    } catch (e) {
      if (request !== generation) return
      if (quiet) refreshError = '状态暂未更新，请检查网络或点击刷新。'
      else error = errorText(e)
    } finally {
      if (request === generation) {
        busy = false
        reading = false
      }
    }
  }
  onMount(() =>
    autoRefresh(
      () => load(loaded, true),
      () => !busy
    )
  )
</script>

<div class="page-head detail-toolbar">
  <button
    class="btn"
    disabled={busy}
    aria-label="刷新商品状态"
    title="刷新商品状态"
    on:click={() => load(loaded)}><Icon /></button
  >
</div>
{#if refreshError}<p class="notice" role="status">{refreshError}</p>{/if}
{#if error}<p class="notice error" role="alert">{error}</p>{/if}{#if item}<article class="card">
    <img
      class="detail-image"
      src={resolveMediaUrl(item.image_url) || fallback}
      alt={item.name}
      decoding="async"
      fetchpriority="high"
      on:error={(e) => ((e.currentTarget as HTMLImageElement).src = fallback)}
    /><span class="pill">{statuses[item.status]}</span>
    <h2>{item.name} · 第 {item.item_no} 件</h2>
    {#if item.remark}<p class="muted preserve product-remark">{item.remark}</p>{/if}
    <p class="muted">{item.owner_name} 发布 · {dateTime(item.created_at)}</p>
    <div class="price">{money(item.unit_price_cent)} <small>/ 份 · {item.min_quantity} 份起</small></div>
    <progress
      value={item.reserved_quantity}
      max={item.capacity}
      aria-label={'已拼' + item.reserved_quantity + '份，共' + item.capacity + '份'}
    ></progress>
    <div class="stats">
      <div><small>拼单进度</small><strong>{item.reserved_quantity}/{item.capacity}</strong></div>
      <div><small>参与人数</small><strong>{item.participant_count}</strong></div>
      <div><small>我已认购</small><strong>{item.own_quantity} 份</strong></div>
    </div>
    {#if item.status === 'POOL' && item.enabled}<div class="row">
        <div>
          <strong>本次新增份数</strong><small>还可认购 {item.remaining_quantity} 份，结算后才实际占量。</small
          >
        </div>
        <Stepper
          item={current ?? item}
          disabled={busy || !current || current.selection_token !== item.selection_token}
        />
      </div>{/if}{#if people}<div class="participation-details">
        <button class="btn" aria-expanded={open} on:click={() => (open = !open)}
          >{open ? '收起拼单详情' : '拼单详情'}</button
        >{#if open}<section aria-label="拼单参与明细" class="participation-body" aria-live="polite">
            <p class="micro muted">
              {people.state === 'CLAIMED'
                ? '已成团，以下昵称与份数来自成交订单冻结记录。'
                : people.state === 'CANCELLED'
                  ? '本件已取消。'
                  : '仅展示本件当前参与人的群昵称与份数。'}
            </p>
            {#if people.participants.length}<ul class="participant-list">
                {#each people.participants as member}<li>
                    <span>{member.member_name}</span><span
                      >{member.quantity} 份 {#if member.cancelled}<strong class="error">· 已取消</strong
                        >{/if}</span
                    >
                  </li>{/each}
              </ul>{:else}<p class="muted">暂无参与明细。</p>{/if}
          </section>{/if}
      </div>{/if}
    {#if $pendingBasket}<p class="notice">上次提交结果尚未确认，请去购物车原样重试。</p>{/if}
  </article>
  <section class="submit-bar">
    <div>
      <strong>{Object.keys($draft).length} 件商品 · {money(total)}</strong><small
        >购物车仅保留本次新增份数</small
      >
    </div>
    <a class="btn primary" href="/cart">去结算</a>
  </section>{:else if busy}<p class="empty">正在读取商品…</p>{/if}
