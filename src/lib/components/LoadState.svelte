<script lang="ts">
  export let loading = false
  export let error = ''
  export let empty = false
  export let emptyText = '暂无数据。'
  export let retry: () => void = () => {}
</script>

{#if loading}<div class="skeleton-stack" role="status" aria-label="正在加载">
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <span class="muted">正在读取最新数据…</span>
  </div>{:else if error}<div class="notice error" role="alert">
    {error}
    <div class="actions"><button class="btn" on:click={retry}>重新读取</button></div>
  </div>{:else if empty}<div class="empty card">{emptyText || '这里还没有内容。'}</div>{:else}<slot />{/if}
