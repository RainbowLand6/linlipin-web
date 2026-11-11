<script lang="ts">
  import { dialog } from '#lib/dialog.ts'
  import { tick } from 'svelte'
  let node: HTMLDialogElement,
    value = ''
  async function show() {
    const current = $dialog
    value = ''
    await tick()
    if (current && current === $dialog && !node.open) node.showModal()
  }
  $: if (node && $dialog) void show()
  function close(result: string | null) {
    $dialog?.resolve(result)
    dialog.set(null)
    node.close()
  }
</script>

<dialog bind:this={node} on:cancel|preventDefault={() => close(null)} aria-labelledby="confirm-title">
  {#if $dialog}<form on:submit|preventDefault={() => close($dialog?.reason ? value.trim() : '')}>
      <h2 id="confirm-title">{$dialog.title}</h2>
      <p class="muted preserve">{$dialog.message}</p>
      {#if $dialog.reason}<label>操作原因<textarea bind:value required maxlength="300"></textarea></label
        >{/if}
      <div class="actions">
        <button class="btn" type="button" on:click={() => close(null)}>再想想</button><button
          class="btn primary">确认操作</button
        >
      </div>
    </form>{/if}
</dialog>
