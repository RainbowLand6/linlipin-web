// Origins only: never put credentials or an /api/v2 suffix in public Vite env.
export function configuredOrigin(value: string | undefined, allowLocal = false): string {
  if (!value) return ''
  try {
    const url = new URL(value)
    const local =
      allowLocal && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (
      (!local && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error()
    return url.origin
  } catch {
    throw new Error(
      '媒体 / API 配置必须是 HTTPS 来源（本地 API 可使用 localhost HTTP），不能包含路径或凭据。'
    )
  }
}
export const apiBaseUrl = configuredOrigin(import.meta.env.VITE_API_BASE_URL, true)
export const publicMediaOrigin = configuredOrigin(import.meta.env.VITE_PUBLIC_MEDIA_ORIGIN)
export const privateMediaOrigin = configuredOrigin(import.meta.env.VITE_PRIVATE_MEDIA_ORIGIN)
export function apiUrl(path: string) {
  return `${apiBaseUrl}/api/v2${path}`
}
export function apiOrigin(origin = globalThis.location?.origin) {
  return apiBaseUrl || origin || ''
}

// Legacy relative URLs belong to the API, not to the Pages frontend.
// Return the entire URL, including a private signature's query; never log it.
export function resolveMediaUrl(
  value: string | null | undefined,
  origin = globalThis.location?.origin
): string {
  if (!value || /[\u0000-\u0020\u007f\\]/u.test(value)) return ''
  const base = apiOrigin(origin)
  if (!base) return ''
  try {
    const url = new URL(value, `${base}/`)
    if (url.username || url.password || url.hash) return ''
    const allowed = new Set([base, publicMediaOrigin, privateMediaOrigin].filter(Boolean))
    if (
      !allowed.has(url.origin) ||
      (url.protocol !== 'https:' && !(url.origin === base && url.protocol === 'http:'))
    )
      return ''
    return url.href
  } catch {
    return ''
  }
}
export function mediaCrossOrigin(value: string): 'use-credentials' | 'anonymous' {
  try {
    return new URL(value).origin === apiOrigin() ? 'use-credentials' : 'anonymous'
  } catch {
    return 'anonymous'
  }
}

// Fixed list variant; signed/private URLs are left intact.
export function thumbnailUrl(value: string | null | undefined, origin = globalThis.location?.origin) {
  const resolved = resolveMediaUrl(value, origin)
  if (!resolved) return ''
  const url = new URL(resolved)
  if (
    url.origin === apiOrigin(origin) &&
    /^\/api\/v2\/media\/[1-9][0-9]*$/.test(url.pathname) &&
    !url.search
  ) {
    url.pathname += '/thumbnail'
    return url.href
  }
  if (
    publicMediaOrigin &&
    url.origin === publicMediaOrigin &&
    !url.search &&
    /\.(jpg|jpeg|png)$/i.test(url.pathname)
  ) {
    url.search = '?imageView2/2/w/480/h/480/q/75'
    return url.href
  }
  return resolved
}
