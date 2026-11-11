<script lang="ts">
  import { tick } from 'svelte'
  import QRCode from 'qrcode'
  import { errorText } from '#lib/api.ts'
  export let url: string
  export let title: string
  export let subtitle: string
  export let description: string
  export let footnote: string
  export let filename: string
  let canvas: HTMLCanvasElement,
    ready = false,
    rendering = false,
    error = '',
    message = '',
    rendered = ''
  $: if (canvas && rendered !== JSON.stringify([url, title, subtitle, description, footnote])) {
    rendered = JSON.stringify([url, title, subtitle, description, footnote])
    void draw()
  }
  function canonical(value: string) {
    const u = new URL(value)
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password)
      throw new Error('服务器返回的分享链接无效。')
    return u.href
  }
  function wrap(ctx: CanvasRenderingContext2D, text: string, y: number, size: number, maxLines = 2) {
    ctx.font = size + 'px "Microsoft YaHei", sans-serif'
    let line = '',
      lines = 0
    for (const c of text.slice(0, 100)) {
      if (ctx.measureText(line + c).width > 650) {
        ctx.fillText(line, 400, y)
        line = c
        y += size + 12
        lines++
        if (lines >= maxLines) return
      } else line += c
    }
    if (line) ctx.fillText(line, 400, y)
  }
  async function draw() {
    ready = false
    rendering = true
    error = ''
    message = ''
    try {
      await tick()
      const qr = document.createElement('canvas')
      await QRCode.toCanvas(qr, canonical(url), {
        width: 480,
        margin: 4,
        errorCorrectionLevel: 'M',
        color: { dark: '#173f35', light: '#fffdf7' }
      })
      canvas.width = 800
      canvas.height = 1100
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('当前浏览器不支持海报绘制。')
      ctx.fillStyle = '#f5f1e7'
      ctx.fillRect(0, 0, 800, 1100)
      ctx.strokeStyle = '#173f35'
      ctx.lineWidth = 3
      ctx.strokeRect(30, 30, 740, 1040)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#173f35'
      ctx.font = 'bold 50px "Microsoft YaHei", sans-serif'
      ctx.fillText('邻里拼', 400, 115)
      wrap(ctx, subtitle, 170, 23, 1)
      wrap(ctx, title, 240, 32)
      ctx.drawImage(qr, 160, 345, 480, 480)
      wrap(ctx, description, 875, 24)
      ctx.fillStyle = '#6a766e'
      wrap(ctx, footnote, 1000, 18)
      ready = true
    } catch (e) {
      error = errorText(e)
    } finally {
      rendering = false
    }
  }
  function download() {
    if (!ready) return
    canvas.toBlob((blob) => {
      if (!blob) {
        error = 'PNG 生成失败，请重新生成。'
        return
      }
      const link = document.createElement('a'),
        target = URL.createObjectURL(blob)
      link.href = target
      link.download = filename + '.png'
      link.click()
      setTimeout(() => URL.revokeObjectURL(target), 5000)
      message = 'PNG 海报已生成并交给浏览器下载。'
    }, 'image/png')
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(canonical(url))
      message = '分享链接已复制。'
    } catch {
      error = '浏览器未允许复制，请长按下方完整链接手动复制。'
    }
  }
</script>

{#if error}<p class="notice error" role="alert">{error}</p>{/if}{#if message}<p
    class="notice success"
    role="status"
  >
    {message}
  </p>{/if}
<div class="share-layout">
  <canvas bind:this={canvas} class="poster" aria-label="可下载的真实二维码海报"></canvas>
  <section class="card">
    <h2>{subtitle}</h2>
    <p class="muted">{description}</p>
    <label
      >服务器提供的分享链接<input
        value={url}
        readonly
        aria-label="完整分享链接"
        on:focus={(e) => e.currentTarget.select()}
      /></label
    ><a class="micro break" href={url} target="_blank" rel="noopener noreferrer">{url}</a>
    <div class="actions">
      <button class="btn primary" disabled={!ready || rendering} on:click={download}>下载 PNG 海报</button
      ><button class="btn" disabled={!ready || rendering} on:click={copy}>复制链接</button><button
        class="btn"
        disabled={rendering}
        on:click={draw}>重新生成</button
      >
    </div>
    <p class="micro muted">真实二维码仅编码服务器链接，本地绘制，保留四格留白，不向第三方发送链接。</p>
  </section>
</div>
