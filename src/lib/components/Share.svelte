<script lang="ts">
  import { onMount } from 'svelte'
  import { api, community, errorText } from '#lib/api.ts'
  import type { Share, CommunityShare } from '#lib/types.ts'
  import { dateTime } from '#lib/ui.ts'
  import QRCodePoster from './QRCodePoster.svelte'
  import LoadState from './LoadState.svelte'
  export let groupId = ''
  let data: Share | CommunityShare | null = null,
    loading = true,
    error = ''
  async function load() {
    loading = true
    error = ''
    try {
      data = await api(groupId ? community + '/groups/' + groupId + '/share' : community + '/community-share')
    } catch (e) {
      error = errorText(e)
    } finally {
      loading = false
    }
  }
  onMount(load)
</script>

<div class="page-head"><div><h1>{groupId ? '分享本次团购' : '社区入会邀请'}</h1></div></div>
<LoadState {loading} {error} retry={load}
  >{#if data}{#if 'group_url' in data}<QRCodePoster
        url={data.group_url}
        title={data.group_title || data.title}
        subtitle="本次团购 · 提货与履约信息"
        description={data.organizer_name + ' 领团 · ' + data.location + ' · ' + dateTime(data.pickup_at)}
        footnote="公开团信息不包含购买者私单"
        filename="邻里拼-本次团购"
      />{:else}<QRCodePoster
        url={data.community_url}
        title="邻里拼社区"
        subtitle="好物一起拼 · 邀请加入社区"
        description="扫码查看社区邀请，凭邀请码、手机号与密码入会。"
        footnote="社区邀请不包含私有拼单信息"
        filename="邻里拼-社区邀请"
      />{/if}{/if}</LoadState
>
