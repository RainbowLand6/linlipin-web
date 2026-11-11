<script lang="ts">
  import { onMount } from 'svelte'
  import { api, apiList, command, community, errorText } from '#lib/api.ts'
  import type { Product, ProductInput, Media, PoolItem } from '#lib/types.ts'
  import Modal from './Modal.svelte'
  import LoadState from './LoadState.svelte'
  import { session } from '#lib/api.ts'
  import { page } from '#lib/page.svelte.ts'
  import { money, cents, confirmation, statuses } from '#lib/ui.ts'
  import { compressImage } from '#lib/compressImage.ts'
  import { resolveMediaUrl } from '#lib/urls.ts'
  import Icon from './Icon.svelte'
  import { goto } from '$app/navigation'
  export let selecting = false
  let products: Product[] = [],
    pools: PoolItem[] = [],
    search = '',
    error = '',
    success = '',
    busy = false,
    count = 5,
    editing = false,
    id = '',
    version = 0,
    kind: 'product' | 'pool' = 'product',
    name = '',
    remark = '',
    purchase = '',
    capacity = 1,
    minimum = 1,
    mode: 'AUTO' | 'MANUAL' = 'AUTO',
    unit = '',
    imageId: string | undefined,
    imageURL = '',
    poolCount = 5,
    selectedId = '',
    publication: Product | null = null,
    duplicateWarning = false,
    queryApplied = false
  $: shown = products.filter((p) => p.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  $: selected = products.find((p) => p.id === selectedId)
  $: myPools = pools.filter((p) => p.owner_id === $session.me?.id)
  $: duplicates = pools.filter(
    (p) =>
      p.status === 'POOL' &&
      p.name.trim().toLocaleLowerCase() === publication?.name.trim().toLocaleLowerCase()
  )
  $: returnTo = $page.url.searchParams.get('return') === '/products/select' ? '/products/select' : ''
  async function load() {
    busy = true
    error = ''
    try {
      ;[products, pools] = await Promise.all([
        apiList<Product>(community + '/products'),
        apiList<PoolItem>(community + '/pool-items')
      ])
      const editId = $page.url.searchParams.get('edit')
      if (!queryApplied && editId) {
        const product = products.find((p) => p.id === editId)
        if (product) edit(product)
      }
      if (!queryApplied && $page.url.searchParams.get('new') === '1') edit()
      queryApplied = true
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
  function edit(p?: Product | PoolItem, pool = false) {
    kind = pool ? 'pool' : 'product'
    id = p?.id ?? ''
    version = p?.version ?? 0
    name = p?.name ?? ''
    remark = p?.remark ?? ''
    purchase = p?.purchase_price_cent ? (p.purchase_price_cent / 100).toFixed(2) : ''
    capacity = p?.capacity ?? 1
    minimum = p?.min_quantity ?? 1
    mode = p?.price_mode ?? 'AUTO'
    unit = p?.unit_price_cent ? (p.unit_price_cent / 100).toFixed(2) : ''
    imageId = p?.image_id
    imageURL = resolveMediaUrl(p?.image_url)
    editing = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function upload(event: Event) {
    const target = event.currentTarget as HTMLInputElement
    const file = target.files?.[0]
    target.value = ''
    if (!file) return
    busy = true
    error = ''
    try {
      const compressed = await compressImage(file, 'PRODUCT')
      const body = new FormData()
      body.set('file', compressed)
      body.set('purpose', 'PRODUCT')
      const media = await api<Media>(community + '/media', { method: 'POST', body })
      imageId = media.id
      imageURL = resolveMediaUrl(media.url)
      success = '图片已上传，保存商品后绑定。'
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
  async function save() {
    busy = true
    error = ''
    try {
      const payload: ProductInput = {
        name: name.trim(),
        remark: remark.trim(),
        purchase_price_cent: cents(purchase),
        capacity,
        min_quantity: minimum,
        price_mode: mode,
        ...(mode === 'MANUAL' ? { unit_price_cent: cents(unit) } : {}),
        ...(imageId ? { image_id: imageId } : {})
      }
      if (!name.trim() || capacity < 1 || minimum < 1 || minimum > capacity)
        throw new Error('请检查商品名称、容量和起订量。')
      if (
        (await confirmation(
          !id ? '保存到商品库' : '确认保存修改',
          kind === 'pool'
            ? '保存此件的名称、图片和经济信息，认购后将锁定经济字段。'
            : '只保存本人商品模板，不会发布到拼单池，已发布的商品保持原样。'
        )) === null
      )
        return
      let body = { ...payload, ...(id ? { version } : {}) }
      try {
        await command(
          community + (kind === 'pool' ? '/pool-items' : '/products') + (id ? '/' + id : ''),
          body,
          id ? 'PATCH' : 'POST'
        )
      } catch (e) {
        if (
          !id &&
          e instanceof Error &&
          e.message.includes('同名') &&
          (await confirmation('已有同名商品', '确认继续创建本人商品模板？')) !== null
        ) {
          await command(community + '/products', { ...body, allow_duplicate: true })
        } else throw e
      }
      editing = false
      if (returnTo && kind !== 'pool') {
        await goto(returnTo)
        return
      }
      await load()
      success = '商品已保存。'
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
  async function publish(p: Product) {
    if (
      (await confirmation(
        '发布到拼单池',
        selecting
          ? '将「' + p.name + '」当前模板发布为一个独立新件。'
          : '使用「' + p.name + '」当前模板发布一个独立新件，已发布商品不受影响。'
      )) === null
    )
      return
    publication = p
    await performPublish(false)
  }
  async function performPublish(allowDuplicate: boolean) {
    if (!publication) return
    busy = true
    error = ''
    try {
      await command(community + '/products/' + publication.id + '/pool-items', {
        version: publication.version,
        allow_duplicate: allowDuplicate
      })
      publication = null
      duplicateWarning = false
      await load()
      success = '已发布到拼单池。'
    } catch (e) {
      error = errorText(e)
      if (error.includes('同名')) duplicateWarning = true
    } finally {
      busy = false
    }
  }
  async function cancel(p: PoolItem) {
    const reason = await confirmation('删除拼单商品', '取消本件及当前认购，保留历史记录。请输入原因。', true)
    if (!reason) return
    busy = true
    error = ''
    try {
      await command(community + '/pool-items/' + p.id + '/cancel', { version: p.version, reason })
      await load()
      success = '商品已删除。'
    } catch (e) {
      error = errorText(e)
    } finally {
      busy = false
    }
  }
  onMount(load)
</script>

{#if selecting}
  <div class="page-head">
    <div><h1>从我的商品库选择</h1></div>
    <a class="btn" href="/">返回首页</a>
  </div>
  <div class="actions">
    <a class="btn" href="/products?new=1&return=/products/select">去商品库新增</a><button
      class="btn"
      disabled={busy}
      on:click={load}
      aria-label="刷新商品库"
      title="刷新商品库"><Icon /></button
    >
  </div>
  {#if success}<p class="notice success" role="status">
      {success}<span class="actions"><a class="btn" href="/">去首页查看</a></span>
    </p>{/if}{#if error && !duplicateWarning}<p class="notice error" role="alert">{error}</p>{/if}
  <label class="search-label"
    ><span>搜索我的商品库</span><input
      bind:value={search}
      type="search"
      placeholder="输入商品名，支持模糊搜索"
    /></label
  >
  <LoadState loading={busy && !products.length}>
    {#if !products.length}<div class="empty card">
        商品库还是空的，请先新增商品。保存后会回到这里，不会自动发布。
      </div>{/if}{#if products.length && !shown.length}<p class="empty card">
        没有找到匹配商品，请更换关键词。
      </p>{/if}
    {#each shown.slice(0, count) as p (p.id)}<section class="card">
        <div class="row">
          <label class="library-choice"
            ><input bind:group={selectedId} type="radio" name="product" value={p.id} disabled={busy} /><span
              ><strong>{p.name}</strong><small
                >{p.capacity} 份/件 · {p.min_quantity} 份起 · {money(p.unit_price_cent)}/份</small
              ></span
            ></label
          ><a class="btn" href={'/products?edit=' + p.id + '&return=/products/select'}>编辑</a>
        </div>
      </section>{/each}
    {#if count < shown.length}<div class="actions">
        <button class="btn" on:click={() => (count += 5)}>再显示 5 条</button>
      </div>{/if}
    <section class="submit-bar" aria-label="发布所选商品">
      <div><strong>{selected?.name || '请选择一个商品'}</strong><small>仅点击发布后才进入拼单池</small></div>
      <button class="btn primary" disabled={busy || !selected} on:click={() => selected && publish(selected)}
        >{busy ? '发布中…' : '发布到拼单池'}</button
      >
    </section>
  </LoadState>
{:else}
  <div class="page-head">
    <div><h1>我的商品库</h1></div>
    <button class="btn primary" disabled={busy} on:click={() => edit()}>新增商品</button>
  </div>
  {#if error && !duplicateWarning}<p class="notice error" role="alert">{error}</p>{/if}{#if returnTo}<div
      class="actions"
    >
      <a class="btn" href={returnTo}>返回选品</a>
    </div>{/if}{#if success}<p class="notice success" role="status">{success}</p>{/if}
  {#if editing}<form novalidate class="card editor" on:submit|preventDefault={save}>
      <div class="row">
        <h2>{!id ? '新增商品' : kind === 'pool' ? '编辑未订件' : '编辑模板'}</h2>
        <button class="btn" type="button" disabled={busy} on:click={() => (editing = false)}>收起</button>
      </div>
      <fieldset disabled={busy}>
        <label>商品名称<input bind:value={name} required maxlength="100" /></label><label
          >备注（选填）<textarea
            bind:value={remark}
            maxlength="500"
            placeholder="规格、口味、保质期等，最多500字"></textarea></label
        >
        <div class="form-pair">
          <label
            >整件采购价（元）<input
              bind:value={purchase}
              inputmode="decimal"
              required
              placeholder="0.00"
            /></label
          ><label
            >一件可分多少份<input
              bind:value={capacity}
              type="number"
              min="1"
              max="9999"
              step="1"
              required
            /></label
          >
        </div>
        <div class="form-pair">
          <label
            >最少起订份数<input
              bind:value={minimum}
              type="number"
              min="1"
              max={capacity}
              step="1"
              required
            /></label
          ><label
            >每份价格方式<select bind:value={mode}
              ><option value="AUTO">自动均分 · 服务端四舍五入</option><option value="MANUAL">手动单价</option
              ></select
            ></label
          >
        </div>
        {#if mode === 'MANUAL'}<label
            >每份单价（元）<input bind:value={unit} inputmode="decimal" required placeholder="0.00" /></label
          >{/if}
        <label
          >JPEG / PNG 商品单图（≤5MiB、800万像素，自动压缩到最长边1600、≤512KiB（小于1MB））<input
            type="file"
            accept="image/jpeg,image/png"
            on:change={upload}
          /></label
        >{#if imageURL}<img class="upload-preview" src={imageURL} alt="待保存商品图" />{/if}
        <p class="micro muted">图片先上传，成功保存后绑定商品；未选择新图时保留原图。</p>
        <div class="actions">
          <button class="btn primary">{busy ? '处理中…' : !id ? '保存到商品库' : '确认保存'}</button>
        </div>
      </fieldset>
    </form>{/if}
  <LoadState loading={busy && !products.length && !editing}>
    <label class="search-label"
      ><span>搜索我的商品库</span><input
        bind:value={search}
        type="search"
        placeholder="输入商品名，支持模糊搜索"
      /></label
    >
    <h2 class="section-title">我的商品库 <small>{shown.length}</small></h2>
    {#if !products.length}<div class="empty card">
        尚未创建商品，新增商品并保存到商品库后，可选择发布。
      </div>{/if}{#if products.length && !shown.length}<p class="empty card">
        没有找到匹配商品，请更换关键词。
      </p>{/if}
    {#each shown.slice(0, count) as p (p.id)}<section class="card">
        <div class="row">
          <div>
            <h2>{p.name}</h2>
            {#if p.remark}<p class="muted preserve">{p.remark}</p>{/if}<small
              >采购 {money(p.purchase_price_cent)} · {p.capacity} 份/件 · {p.min_quantity} 份起 · 每份 {money(
                p.unit_price_cent
              )}</small
            >
          </div>
          <span class="pill">{p.price_mode === 'AUTO' ? '自动均分' : '手动单价'}</span>
        </div>
        <div class="actions">
          <button class="btn" disabled={busy} on:click={() => edit(p)}>编辑模板</button><button
            class="btn primary"
            disabled={busy}
            on:click={() => publish(p)}>发布到拼单池</button
          >
        </div>
      </section>{/each}
    <div class="actions">
      {#if count < shown.length}<button class="btn" on:click={() => (count += 5)}>再显示 5 条</button
        >{/if}{#if count > 5}<button class="btn" on:click={() => (count = 5)}>收起</button>{/if}
    </div>
    <h2 class="section-title">我发布的商品</h2>
    {#if !myPools.length}<div class="empty card">暂无已发布商品。</div>{/if}
    {#each myPools.slice(0, poolCount) as p (p.id)}<section class="card">
        <div class="row">
          <div>
            <h2>{p.name} <small>第 {p.item_no} 件</small></h2>
            <small>{p.reserved_quantity}/{p.capacity} 份 · {money(p.unit_price_cent)}/份</small>
          </div>
          <span class="pill">{statuses[p.status]}</span>
        </div>
        {#if p.status === 'POOL'}<div class="actions">
            <button class="btn" disabled={busy || p.ever_ordered} on:click={() => edit(p, true)}
              >编辑此件</button
            >{#if p.ever_ordered}<span class="micro muted">已被认购，经济字段已锁定</span>{/if}<button
              class="btn danger"
              disabled={busy}
              on:click={() => cancel(p)}
              aria-label="删除"
              title="删除"><Icon name="trash" /></button
            >
          </div>{/if}
      </section>{/each}
    <div class="actions">
      {#if poolCount < myPools.length}<button class="btn" on:click={() => (poolCount += 5)}
          >再显示 5 条</button
        >{/if}{#if poolCount > 5}<button class="btn" on:click={() => (poolCount = 5)}>收起</button
        >{/if}<button
        class="btn"
        disabled={busy}
        on:click={load}
        aria-label="刷新商品状态"
        title="刷新商品状态"><Icon /></button
      >
    </div>
  </LoadState>{/if}
<Modal open={duplicateWarning} title="拼单池中已有同名商品" {busy} close={() => (duplicateWarning = false)}
  ><p class="muted">可以查看已有商品，也可以仍发布一个独立新件。不会修改已发布商品。</p>
  {#if error}<p class="notice error" role="alert">{error}</p>{/if}{#each duplicates as item}<div class="row">
      <div><strong>{item.name}</strong><small>{item.owner_name} · 第 {item.item_no} 件</small></div>
      <a class="btn" href={'/pool/' + item.id} on:click={() => (duplicateWarning = false)}>查看已有商品</a>
    </div>{/each}
  <div class="actions">
    <button class="btn" disabled={busy} on:click={() => (duplicateWarning = false)}>返回选择</button><button
      class="btn primary"
      disabled={busy}
      on:click={() => performPublish(true)}>{busy ? '发布中…' : '仍要发布'}</button
    >
  </div></Modal
>
