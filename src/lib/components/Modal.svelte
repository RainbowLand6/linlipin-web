<script lang="ts">
  import { onDestroy } from 'svelte'
  export let open = false
  export let title: string
  export let busy = false
  export let close: () => void
  let node: HTMLDialogElement
  $: if (node) {
    if (open && !node.open) node.showModal()
    else if (!open && node.open) node.close()
  }
  onDestroy(() => node?.close())
</script>

<dialog bind:this={node} aria-label={title} on:cancel|preventDefault={() => !busy && close()}>
  <div class="row modal-head">
    <h2>{title}</h2>
    <button class="btn" type="button" disabled={busy} aria-label="关闭弹框" on:click={close}>关闭</button>
  </div>
  <slot />
</dialog>
