export function remainingSeconds(expiresAt: string, serverTime: string | undefined, elapsedMs: number) {
  const start = serverTime ? Date.parse(serverTime) : Date.now() - elapsedMs
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - start - elapsedMs) / 1000)) || 0
}
export function duration(seconds: number) {
  return (
    Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0') +
    ':' +
    (seconds % 60).toString().padStart(2, '0')
  )
}
