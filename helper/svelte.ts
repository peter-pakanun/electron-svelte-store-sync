import { writable } from 'svelte/store'
import type { Writable } from 'svelte/store'
import type { IContextBridgeAPI } from '../dist/index'

// Helper for svelte store
export function createSyncedWritable<T, K extends keyof T>(
  esssApi: IContextBridgeAPI<T>,
  key: K,
  defaultValue: T[K]
): Writable<T[K]> {
  const { subscribe, set, update } = writable<T[K]>(defaultValue, (set) => {
    esssApi.subscribe(key, (value) => {
      set(value)
    })

    // return unsubscribe function so that svelte store can unsubscribe
    // from store updates
    return () => {
      esssApi.unsubscribe(key)
    }
  })

  // If we have default value, check if main thread has it
  if (defaultValue !== undefined) {
    // We can use async/await inside svelte store writable init
    ;(async (): Promise<void> => {
      const value = await esssApi.get(key)
      if (value === undefined) {
        // This is a new key from renderer, set it in main thread
        esssApi.set(key, defaultValue)
      } else {
        // This is an existing key, set it in svelte store
        set(value)
      }
    })()
  }

  return {
    subscribe,
    set: (value): void => {
      esssApi.set(key, value)
    },
    update
  }
}
