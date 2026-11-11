import { writable } from 'svelte/store'
export const dialog = writable<{
  title: string
  message: string
  reason: boolean
  resolve: (v: string | null) => void
} | null>(null)
export function confirmation(title: string, message: string, reason = false): Promise<string | null> {
  return new Promise((resolve) => dialog.set({ title, message, reason, resolve }))
}
