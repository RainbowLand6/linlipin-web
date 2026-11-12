<script lang="ts">
  import { page } from '#lib/page.svelte.ts'
  import { api, errorText, session } from '#lib/api.ts'
  import type { PublicGroup, PublicCommunity } from '#lib/types.ts'
  import { dateTime, money, statuses } from '#lib/ui.ts'
  import { resolveMediaUrl } from '#lib/urls.ts'
  export let community = false
  let data: PublicGroup | PublicCommunity | null = null,
    error = '',
    loaded = ''
  $: if (loaded !== $page.params.token) {
    loaded = $page.params.token ?? ''
    void load()
  }
  async function load() {
    try {
      data = await api('/public/' + (community ? 'communities' : 'groups') + '/' + loaded)
    } catch (e) {
      error = errorText(e)
    }
  }
</script>

{#if error}<p class="notice error" role="alert">{error}</p>{/if}
{#if data}{#if 'location' in data}<div class="page-head">
      <div><h1>{data.title || data.group_title}</h1></div>
      <span class="pill">{data.status === 'ENDED' ? '已结束' : '履约中'}</span>
    </div>
    <section class="card">
      <h2>提货安排</h2>
      <p>{data.location}<br />{dateTime(data.pickup_at)}</p>
      {#if data.notice}<p class="preserve muted">{data.notice}</p>{/if}
    </section>
    <section class="card">
      <h2>本次团商品</h2>
      {#each data.items as item}<div class="row">
          {#if resolveMediaUrl(item.image_url)}<img
              src={resolveMediaUrl(item.image_url)}
              alt={item.name}
              class="product-image"
            />{/if}<strong>{item.name} · 第 {item.item_no} 件</strong>
        </div>{:else}<p class="empty">暂无公开商品信息。</p>{/each}
    </section>
    <div class="notice">此页只展示本次团公开履约信息。已参与者请登录后查看自己的订单及提货号。</div>
    <div class="actions">
      <a class="btn primary" href={$session.me ? '/orders' : '/me'}
        >{$session.me ? '查看我的票据' : '登录查看本人订单'}</a
      >
    </div>
  {:else}<section class="card welcome">
      <h1>邻里拼社区</h1>
      <p class="muted">好物一起拼，满件再成团。每位社区成员都可以发布商品、认购和成团。</p>
      <div class="actions">
        <a class="btn primary" href={$session.me ? '/' : '/me'}>{$session.me ? '进入社区' : '注册 / 登录'}</a>
      </div>
      {#if !$session.me}<p class="micro muted">注册需要群昵称、手机号、社区邀请码与密码。</p>{/if}
    </section>{/if}{/if}
