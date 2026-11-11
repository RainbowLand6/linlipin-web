<script>
  import { page } from '#lib/page.svelte.ts'
  import Share from '#lib/components/Share.svelte'
</script>

<Share groupId={$page.params.id} />
