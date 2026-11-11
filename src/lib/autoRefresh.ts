// One request at a time, jittered across clients; pause hidden/offline pages.
export function autoRefresh(
  refresh: () => Promise<unknown>,
  enabled: () => boolean = () => true,
  failed: (error: unknown) => void = () => {}
) {
  let stopped = false,
    running = false
  let timer: ReturnType<typeof setTimeout>
  const active = () => document.visibilityState === 'visible' && navigator.onLine !== false
  function schedule() {
    clearTimeout(timer)
    if (!stopped && active()) timer = setTimeout(tick, 12000 + Math.random() * 3000)
  }
  async function tick() {
    if (stopped || running) return
    if (!active() || !enabled()) {
      schedule()
      return
    }
    running = true
    try {
      await refresh()
    } catch (e) {
      if (!stopped) failed(e)
    } finally {
      running = false
      schedule()
    }
  }
  function resume() {
    clearTimeout(timer)
    schedule()
  }
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('online', resume)
  window.addEventListener('offline', resume)
  schedule()
  return () => {
    stopped = true
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', resume)
    window.removeEventListener('online', resume)
    window.removeEventListener('offline', resume)
  }
}
