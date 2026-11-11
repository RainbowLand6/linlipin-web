import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compressImage } from './compressImage'
import { canvasMock, jpegFile, pngFile } from './imageTestSupport'
const close = vi.fn()
const decode = vi.fn()
beforeEach(() => {
  close.mockReset()
  decode.mockReset().mockResolvedValue({ width: 4000, height: 2000, close })
  vi.stubGlobal('createImageBitmap', decode)
})
afterEach(() => vi.unstubAllGlobals())
describe('real compression canvas pipeline', () => {
  it.each([
    ['PRODUCT', 1600, 800],
    ['AVATAR', 256, 128]
  ] as const)(
    'scales %s to %i × %i and uploads encoded file, not original',
    async (purpose, width, height) => {
      const { canvas, drawImage } = canvasMock()
      const file = jpegFile()
      const result = await compressImage(file, purpose)
      expect(drawImage).toHaveBeenCalledWith(
        expect.objectContaining({ width: 4000, height: 2000 }),
        0,
        0,
        width,
        height
      )
      expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.82)
      expect(result).not.toBe(file)
      expect(result.name).toBe(file.name)
      expect(result.type).toBe('image/jpeg')
      expect(await result.text()).toBe('encoded')
      expect(close).toHaveBeenCalledOnce()
      expect(canvas.width).toBe(0)
    }
  )
  it('preserves PNG transparency and does not enlarge small images', async () => {
    decode.mockResolvedValueOnce({ width: 80, height: 100, close })
    const { drawImage, fillRect } = canvasMock()
    expect((await compressImage(pngFile(), 'AVATAR')).type).toBe('image/png')
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 80, 100)
    expect(fillRect).not.toHaveBeenCalled()
  })
  it('reduces dimensions after JPEG quality attempts until the file fits', async () => {
    const { canvas, drawImage } = canvasMock()
    canvas.toBlob.mockImplementation((callback, type) =>
      callback(new Blob([new Uint8Array(canvas.width > 1040 ? 1_000_001 : 200_000)], { type }))
    )
    const result = await compressImage(jpegFile(), 'PRODUCT')
    expect(result.size).toBeLessThan(1_000_000)
    expect(canvas.toBlob.mock.calls.map((c) => c[2])).toEqual([0.82, 0.65, 0.82])
    expect(drawImage).toHaveBeenLastCalledWith(expect.anything(), 0, 0, 1040, 520)
    expect(close).toHaveBeenCalledOnce()
  })
  it('returns the first JPEG encoding within the output budget', async () => {
    const { canvas } = canvasMock()
    canvas.toBlob.mockImplementationOnce((callback, type) =>
      callback(new Blob([new Uint8Array(256 * 1024 + 1)], { type }))
    )
    expect((await compressImage(jpegFile(), 'AVATAR')).size).toBeLessThanOrEqual(256 * 1024)
    expect(canvas.toBlob).toHaveBeenCalledTimes(2)
  })
  it('shrinks noisy PNG dimensions while retaining transparency and format', async () => {
    const { canvas, fillRect } = canvasMock()
    canvas.toBlob.mockImplementation((callback, type) =>
      callback(new Blob([new Uint8Array(canvas.width > 166 ? 300_000 : 100_000)], { type }))
    )
    const result = await compressImage(pngFile(), 'AVATAR')
    expect(result.type).toBe('image/png')
    expect(result.size).toBeLessThanOrEqual(256 * 1024)
    expect(canvas.toBlob).toHaveBeenCalledTimes(2)
    expect(fillRect).not.toHaveBeenCalled()
  })
  it('never returns oversized bytes even when a broken encoder ignores dimensions', async () => {
    const { canvas } = canvasMock()
    canvas.toBlob.mockImplementation((callback, type) =>
      callback(new Blob([new Uint8Array(600_000)], { type }))
    )
    await expect(compressImage(pngFile(), 'PRODUCT')).rejects.toThrow('无法将图片压缩')
    expect(canvas.toBlob.mock.calls.length).toBeLessThan(25)
    expect(close).toHaveBeenCalledOnce()
  })
  it.each([
    [4000, 2001],
    [0, 1],
    [NaN, 20]
  ])('rejects invalid dimensions %i × %i before canvas allocation', async (width, height) => {
    const { createElement } = canvasMock()
    decode.mockResolvedValueOnce({ width, height, close })
    await expect(compressImage(pngFile(), 'PRODUCT')).rejects.toThrow('800')
    expect(createElement).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })
  it('rejects invalid signature without decoding', async () => {
    canvasMock()
    await expect(
      compressImage(new File(['wrong'], 'x.png', { type: 'image/png' }), 'PRODUCT')
    ).rejects.toThrow('格式')
    expect(decode).not.toHaveBeenCalled()
  })
  it('rejects decode failure in Chinese', async () => {
    decode.mockRejectedValueOnce(new Error('secret decoder text'))
    await expect(compressImage(pngFile(), 'PRODUCT')).rejects.toThrow('无法解码')
  })
  it('rejects aborted decode and closes the bitmap when decoding eventually returns', async () => {
    canvasMock()
    const controller = new AbortController()
    let finish!: (bitmap: unknown) => void
    decode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const work = compressImage(pngFile(), 'AVATAR', { signal: controller.signal })
    await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce())
    controller.abort()
    finish({ width: 4000, height: 2000, close })
    await expect(work).rejects.toMatchObject({ name: 'AbortError' })
    expect(close).toHaveBeenCalledOnce()
  })
  it('aborts an in-flight canvas encoding and releases its bitmap', async () => {
    const { canvas } = canvasMock()
    canvas.toBlob.mockImplementation(() => undefined)
    const controller = new AbortController()
    const work = compressImage(pngFile(), 'PRODUCT', { signal: controller.signal })
    await vi.waitFor(() => expect(canvas.toBlob).toHaveBeenCalledOnce())
    controller.abort()
    await expect(work).rejects.toMatchObject({ name: 'AbortError' })
    expect(close).toHaveBeenCalledOnce()
  })
  it('releases bitmap if canvas fails', async () => {
    const { canvas } = canvasMock()
    canvas.getContext.mockReturnValueOnce(null as never)
    await expect(compressImage(pngFile(), 'AVATAR')).rejects.toThrow('浏览器')
    expect(close).toHaveBeenCalledOnce()
  })
})
