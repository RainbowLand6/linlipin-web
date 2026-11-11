import { page as state } from '$app/state'
import { toStore } from 'svelte/store'
// Bridge route state into the legacy component store syntax during this port.
export const page = toStore(() => ({ params: state.params, url: state.url }))
