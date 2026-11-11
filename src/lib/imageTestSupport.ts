import { vi } from 'vitest'
// Mock browser primitives, not compressImage: real signature/dimensions/draw/encode run.
export function canvasMock() {
  const drawImage = vi.fn()
  const fillRect = vi.fn()
  const context = { drawImage, fillRect, fillStyle: '' }
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn((callback: BlobCallback, type: string, _quality?: number) =>
      callback(new Blob(['encoded'], { type }))
    )
  }
  const createElement = vi.fn(() => canvas)
  vi.stubGlobal('document', { createElement })
  return { canvas, context, drawImage, fillRect, createElement }
}
export const pngFile = () =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'image.png', { type: 'image/png' })
export const jpegFile = () =>
  new File([new Uint8Array([255, 216, 255, 224])], 'image.jpg', { type: 'image/jpeg' })
