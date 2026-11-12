<script lang="ts">
  import { onMount, tick } from 'svelte'
  export let shown = 0
  export let total = 0
  export let disabled = false
  export let more: () => void
  let sentinel: HTMLDivElement
  let visible = false
  let advancing = false
  let frame = 0
  async function advance() {
    if (advancing || disabled || shown >= total) return
    advancing = true
    more()
    await tick()
    advancing = false
  }
  onMount(() => {
    function check() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (visible && window.scrollY > 0) void advance()
      })
    }
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting
      if (visible) check()
    })
    observer.observe(sentinel)
    window.addEventListener('scroll', check, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', check)
      cancelAnimationFrame(frame)
    }
  })
</script>

<div bind:this={sentinel} class="load-more">
  {#if shown < total}
    <button class="btn" disabled={disabled || advancing} on:click={advance}>加载更多</button>
    <small>向下滑动，继续查看商品</small>
  {:else if total > 0}<small>已展示全部 {total} 件商品</small>{/if}
</div>
