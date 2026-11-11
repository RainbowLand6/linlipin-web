export type ImagePurpose = 'PRODUCT' | 'AVATAR'
const MiB = 1024 * 1024
function check(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('图片处理已取消。', 'AbortError')
}
function encode(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
  signal?: AbortSignal
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('图片处理已取消。', 'AbortError'))
    signal?.addEventListener('abort', abort, { once: true })
    try {
      check(signal)
      canvas.toBlob(
        (blob) => {
          signal?.removeEventListener('abort', abort)
          if (signal?.aborted) {
            abort()
            return
          }
          if (!blob || blob.type !== type) reject(new Error('图片压缩失败，请重新选择 JPEG / PNG 图片。'))
          else resolve(blob)
        },
        type,
        quality
      )
    } catch (error) {
      signal?.removeEventListener('abort', abort)
      reject(error)
    }
  })
}
export async function compressImage(
  file: File,
  purpose: ImagePurpose,
  { signal }: { signal?: AbortSignal } = {}
): Promise<File> {
  check(signal)
  if (!['image/jpeg', 'image/png'].includes(file.type) || file.size === 0 || file.size > 5 * MiB)
    throw new Error('请选择不超过 5MiB 的 JPEG / PNG 图片。')
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  check(signal)
  const valid =
    file.type === 'image/jpeg'
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
  if (!valid) throw new Error('图片内容与 JPEG / PNG 格式不符。')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    check(signal)
    throw new Error('无法解码图片，请重新选择有效的 JPEG / PNG 图片。')
  }
  let canvas: HTMLCanvasElement | undefined
  try {
    check(signal)
    const { width, height } = bitmap
    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width < 1 ||
      height < 1 ||
      width * height > 8_000_000
    )
      throw new Error('图片须为有效尺寸，且不超过 800 万像素。')
    const edge = purpose === 'PRODUCT' ? 1600 : 256
    const limit = purpose === 'PRODUCT' ? 512 * 1024 : 256 * 1024
    const scale = Math.min(1, edge / Math.max(width, height))
    canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    while (true) {
      const context = canvas.getContext('2d')
      if (!context) throw new Error('当前浏览器无法处理图片，请更换浏览器后重试。')
      if (file.type === 'image/jpeg') {
        context.fillStyle = '#fff'
        context.fillRect(0, 0, canvas.width, canvas.height)
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      // Preserve PNG transparency; lower JPEG quality before reducing dimensions.
      const qualities = file.type === 'image/jpeg' ? [0.82, 0.65] : [0.82]
      for (const quality of qualities) {
        check(signal)
        const blob = await encode(canvas, file.type, quality, signal)
        check(signal)
        if (blob.size > 0 && blob.size <= limit)
          return new File([blob], file.name, { type: file.type, lastModified: file.lastModified })
      }
      if (canvas.width === 1 && canvas.height === 1)
        throw new Error('当前浏览器无法将图片压缩至上传限制，请更换图片重试。')
      canvas.width = Math.max(1, Math.floor(canvas.width * 0.65))
      canvas.height = Math.max(1, Math.floor(canvas.height * 0.65))
    }
  } finally {
    bitmap.close()
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  }
}
