import { EventEmitter } from 'events'
import { ipcMain, ipcRenderer } from 'electron'

interface IKeyValue {
  [key: string]: unknown
}

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

export declare interface ElectronSvelteStoreSync<T = IKeyValue>
  extends EventEmitter {
  /**
   * Emit when a value in the store changed.
   * @param key The key of the store value.
   * @param value The new value.
   */
  on(
    event: 'changed',
    listener: (key: keyof T, value: T[keyof T]) => void
  ): this
  once(
    event: 'changed',
    listener: (key: keyof T, value: T[keyof T]) => void
  ): this
  off(
    event: 'changed',
    listener: (key: keyof T, value: T[keyof T]) => void
  ): this
  addListener(
    event: 'changed',
    listener: (key: keyof T, value: T[keyof T]) => void
  ): this
  removeListener(
    event: 'changed',
    listener: (key: keyof T, value: T[keyof T]) => void
  ): this
}

export class ElectronSvelteStoreSync<T extends IKeyValue> extends EventEmitter {
  private storePath: string | undefined
  private store: T
  private namespace: string
  private listeningWindows: Electron.BrowserWindow[] = []

  constructor(namespace = '', storePath?: string) {
    super()
    this.storePath = storePath
    this.store = {} as T
    this.namespace = namespace

    ipcMain.handle(`${this.namespace}-get`, async (_event, key) => {
      return this.get(key)
    })

    ipcMain.handle(`${this.namespace}-set`, async (_event, key, value) => {
      this.set(key, value, _event.sender)
    })

    ipcMain.handle(`${this.namespace}-save`, async () => {
      await this.save()
    })
  }

  public addListeningWindow(window: Electron.BrowserWindow): void {
    this.listeningWindows.push(window)
  }

  public get<K extends keyof T>(key: K): T[K] {
    return this.store[key]
  }

  public set<K extends keyof T>(
    key: K,
    value: T[K],
    sender: Electron.WebContents | null
  ): void {
    this.store[key] = value
    this.emit('changed', key, value)

    // Send the new config value to all listening windows, except the one that
    // triggered this change.
    this.listeningWindows
      .filter((w) => w.webContents.id !== sender?.id)
      .forEach((w) => {
        w.webContents.send(`${this.namespace}-changed-${String(key)}`, value)
      })
    if (this.storePath) this.save()
  }

  public async save(): Promise<void> {
    throw new Error('Method not implemented.')
  }
}

// preload api to be exposeInMainWorld by contextBridge
export const createContextBridgeApi = <T extends IKeyValue>(
  namespace = ''
): IContextBridgeAPI<T> => {
  return {
    get: <K extends keyof T>(key: K): Promise<T[K]> =>
      ipcRenderer.invoke(`${namespace}-get`, key),
    set: <K extends keyof T>(key: K, value: T[K]): Promise<void> =>
      ipcRenderer.invoke(`${namespace}-set`, key, value),
    subscribe: <K extends keyof T>(
      key: K,
      listener: (value: T[K]) => void
    ): void => {
      ipcRenderer.on(`${namespace}-changed-${String(key)}`, (_event, value) => {
        listener(value)
      })
    },
    unsubscribe: <K extends keyof T>(key: K): void => {
      ipcRenderer.removeAllListeners(`${namespace}-changed-${String(key)}`)
    },
    save: (): Promise<void> => ipcRenderer.invoke(`${namespace}-save`)
  }
}
