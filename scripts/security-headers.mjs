import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const html = await readFile('build/200.html', 'utf8')
const hashes = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(
  (m) => "'sha256-" + createHash('sha256').update(m[1]).digest('base64') + "'"
)
function origin(value) {
  if (!value) return ''
  const url = new URL(value)
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !['https:', 'http:'].includes(url.protocol)
  )
    throw new Error('Expected a bare origin')
  return url.origin
}
const { loadEnv } = await import('vite')
const env = loadEnv('production', process.cwd(), 'VITE_')
const api = origin(env.VITE_API_BASE_URL),
  media = [env.VITE_PUBLIC_MEDIA_ORIGIN, env.VITE_PRIVATE_MEDIA_ORIGIN].filter(Boolean).map(origin)
const csp = [
  "default-src 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' " + hashes.join(' '),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: " + [api, ...media].filter(Boolean).join(' '),
  "connect-src 'self' " + api,
  "font-src 'self'"
].join('; ')
const headers = await readFile('static/_headers', 'utf8')
await writeFile(
  'build/_headers',
  headers.replace(/^\/\*\r?\n/, '/*\n  Content-Security-Policy: ' + csp + '\n')
)
