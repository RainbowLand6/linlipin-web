<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from './Icon.svelte'

  let visible = false
  onMount(() => {
    const update = () => (visible = window.scrollY > 400)
    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => window.removeEventListener('scroll', update)
  })

  function backToTop() {
    document.getElementById('main')?.focus({ preventScroll: true })
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    })
  }
</script>

{#if visible}<button
    class="back-to-top"
    type="button"
    aria-label="回到顶部"
    title="回到顶部"
    on:click={backToTop}><Icon name="arrow-up" /></button
  >{/if}

<style>
  .back-to-top {
    position: fixed;
    right: max(24px, env(safe-area-inset-right));
    bottom: 96px;
    z-index: 4;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 50%;
    color: var(--green);
    background: var(--paper);
    box-shadow: var(--shadow);
  }
  .back-to-top:hover {
    background: var(--soft);
    border-color: var(--green);
  }
  @media (max-width: 639px) {
    .back-to-top {
      right: max(16px, env(safe-area-inset-right));
      bottom: calc(154px + env(safe-area-inset-bottom));
    }
  }
</style>
