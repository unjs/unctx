
export interface UseContext<T> {
  use: () => T | null
  call: <R>(ctx: T, cb: () => R) => R
}

export function createContext<T = any> (): UseContext<T> {
  let currentInstance: T = null

  return {
    use: () => currentInstance,
    call: (instance: T, cb) => {
      if (currentInstance && currentInstance !== instance) {
        throw new Error('Context conflict')
      }
      currentInstance = instance
      const res = cb()
      currentInstance = null
      return res
    }
  }
}

export interface ContextNamespace {
  get: <T>(key: string) => UseContext<T>
}

export function createNamespace () {
  const contexts: Record<string, UseContext<any>> = {}

  return {
    get<T> (key) {
      if (!contexts[key]) {
        contexts[key] = createContext()
      }
      contexts[key] as UseContext<T>
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

export const useContext = <T>(key: string) => defaultNamespace.get<T>(key)
