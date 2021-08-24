
export interface UseContext<T> {
  use: () => T | null
  set: (instance?: T, replace?: Boolean) => void
  unset: () => void
  call: <R>(instance: T, cb: () => R) => R
}

export function createContext<T = any> (): UseContext<T> {
  let currentInstance: T = null
  let isSingleton = false

  const checkConflict = (instance: T) => {
    if (currentInstance && currentInstance !== instance) {
      throw new Error('Context conflict')
    }
  }

  return {
    use: () => currentInstance,
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
        const res = cb()
        if (!isSingleton) {
          currentInstance = null
        }
        return res
      } catch (err) {
        if (!isSingleton) {
          currentInstance = null
        }
        throw err
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
