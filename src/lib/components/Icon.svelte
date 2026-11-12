<script lang="ts">
  export let name = 'refresh'
</script>

<svg
  class:action-icon={name === 'refresh' || name === 'trash'}
  viewBox="0 0 24 24"
  width="20"
  height="20"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  >{#if name === 'arrow-up'}<path d="M12 20V4m-7 7 7-7 7 7" />{:else if name === 'trash'}<path
      d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"
    />{:else if name === 'home'}<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" />{:else if name === 'cart'}<path
      d="M2 3h3l3 12h11l3-9H6M9 20h.01M18 20h.01"
    />{:else if name === 'user'}<path
      d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2"
    />{:else if name === 'group'}<path
      d="M12 16v6M8 20h8M7 3H3v4c0 3 2 5 5 5M17 3h4v4c0 3-2 5-5 5M7 2h10v6a5 5 0 0 1-10 0Z"
    />{:else}<path d="M20 11a8 8 0 1 0-2.3 6.7M20 4v7h-7" />{/if}</svg
>
