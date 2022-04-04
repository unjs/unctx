export interface UseContext<T> {
  /**
   * Get the current context. Throws if no context is set.
   */
  use: () => T
  /**
   * Get the current context. Returns `null` when no context is set.
   */
  tryUse: () => T | null
  /**
   * Set the context as Singleton Pattern.
   */
  set: (instance?: T, replace?: Boolean) => void
  /**
   * Clear current context.
   */
  unset: () => void
  /**
   * Exclude a synchronous function with the provided context.
   */
  call: <R>(instance: T, cb: () => R) => R
  /**
   * Exclude an asynchronous function with the provided context.
   * Requires installing the transform plugin to work properly.
   */
  callAsync: <R>(instance: T, cb: () => R | Promise<R>) => Promise<R>
}

type OnAsyncRestore = () => void
type OnAsyncLeave = () => void | OnAsyncRestore

export function createContext<T = any> (): UseContext<T> {
  let currentInstance: T = null
  let isSingleton = false

  const checkConflict = (instance: T) => {
    if (currentInstance && currentInstance !== instance) {
      throw new Error('Context conflict')
    }
  }

  return {
    use: () => {
      if (currentInstance == null) {
        throw new Error('Context is not available')
      }
      return currentInstance
    },
    tryUse: () => {
      return currentInstance
    },
    set: (instance: T, replace?: Boolean) => {
      if (!replace) {
        checkConflict(instance)
      }
      currentInstance = instance
      isSingleton = true
    },
    unset: () => {
      currentInstance = null
      isSingleton = false
    },
    call: (instance: T, cb) => {
      checkConflict(instance)
      currentInstance = instance
      try {
        return cb()
      } finally {
        if (!isSingleton) {
          currentInstance = null
        }
      }
    },
    async callAsync (instance: T, cb) {
      currentInstance = instance
      const onRestore: OnAsyncRestore = () => { currentInstance = instance }
      const onLeave: OnAsyncLeave = () => currentInstance === instance ? onRestore : undefined
      asyncHandlers.add(onLeave)
      try {
        const r = cb()
        if (!isSingleton) {
          currentInstance = null
        }
        return await r
      } finally {
        asyncHandlers.delete(onLeave)
      }
    }
  }
}

export interface ContextNamespace {
  get: <T>(key: string) => UseContext<T>
}

export function createNamespace () {
  const contexts: Record<string, UseContext<any>> = {}

  return {
    get (key) {
      if (!contexts[key]) {
        contexts[key] = createContext()
      }
      contexts[key] as UseContext<any>
      return contexts[key]
    }
  }
}

const _globalThis = ((typeof globalThis !== 'undefined')
  ? globalThis
  : (typeof self !== 'undefined')
      ? self
      : (typeof global !== 'undefined')
          ? global
          : (typeof window !== 'undefined')
              ? window
              : {}) as typeof globalThis

const globalKey = '__unctx__'

export const defaultNamespace: ContextNamespace =
  _globalThis[globalKey] || (_globalThis[globalKey] = createNamespace())

export const getContext = <T>(key: string) => defaultNamespace.get<T>(key)

export const useContext = <T>(key: string) => getContext<T>(key).use

const asyncHandlersKey = '__unctx_async_handlers__'
const asyncHandlers: Set<OnAsyncLeave> =
  _globalThis[asyncHandlersKey] || (_globalThis[asyncHandlersKey] = new Set())

type AsyncFn<T> = () => Promise<T>

export function executeAsync<T> (fn: AsyncFn<T>): [Promise<T>, () => void] {
  const restores: OnAsyncRestore[] = []
  for (const leaveHandler of asyncHandlers) {
    const restore = leaveHandler()
    if (restore) {
      restores.push(restore)
    }
  }
  const restore = () => {
    for (const restore of restores) {
      restore()
    }
  }
  return [fn(), restore]
}

export function withAsyncContext<T=any> (fn: AsyncFn<T>, transformed?: boolean): AsyncFn<T> {
  if (!transformed) {
    // eslint-disable-next-line no-console
    console.warn('[unctx] `withAsyncContext` needs transformation for async context support in', fn, '\n', fn.toString())
  }
  return fn
}
