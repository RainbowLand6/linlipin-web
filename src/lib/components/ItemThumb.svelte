<script lang="ts">
  import fallback from '#lib/assets/default-product.svg'
  import { thumbnailUrl } from '#lib/urls.ts'
  export let src: string | null | undefined = null
  export let alt = ''
  let failed = false
  $: if (src) failed = false
</script>

<img
  class="item-thumb"
  src={failed ? fallback : thumbnailUrl(src) || fallback}
  {alt}
  loading="lazy"
  decoding="async"
  on:error={() => (failed = true)}
/>
