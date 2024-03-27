export interface IContextBridgeAPI<T = IKeyValue> {
  get: <K extends keyof T>(key: K) => Promise<T[K]>
  set: <K extends keyof T>(key: K, value: T[K]) => Promise<void>
  subscribe: <K extends keyof T>(
    key: K,
    listener: (value: T[K]) => void
  ) => void
  unsubscribe: <K extends keyof T>(key: K) => void
  save: () => Promise<void>
}
