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
  call: <R>(instance: T, callback: () => R) => R
  /**
   * Exclude an asynchronous function with the provided context.
   * Requires installing the transform plugin to work properly.
   */
  callAsync: <R>(instance: T, callback: () => R | Promise<R>) => Promise<R>
}

type OnAsyncRestore = () => void
type OnAsyncLeave = () => void | OnAsyncRestore

export function createContext<T = any> (): UseContext<T> {
  let currentInstance: T;
  let isSingleton = false;

  const checkConflict = (instance: T) => {
    if (currentInstance && currentInstance !== instance) {
      throw new Error("Context conflict");
    }
  };

  return {
    use: () => {
      if (currentInstance === undefined) {
        throw new Error("Context is not available");
      }
      return currentInstance;
    },
    tryUse: () => {
      return currentInstance;
    },
    set: (instance: T, replace?: Boolean) => {
      if (!replace) {
        checkConflict(instance);
      }
      currentInstance = instance;
      isSingleton = true;
    },
    unset: () => {
      currentInstance = undefined;
      isSingleton = false;
    },
    call: (instance: T, callback) => {
      checkConflict(instance);
      currentInstance = instance;
      try {
        return callback();
      } finally {
        if (!isSingleton) {
          currentInstance = undefined;
        }
      }
    },
    async callAsync (instance: T, callback) {
      currentInstance = instance;
      const onRestore: OnAsyncRestore = () => { currentInstance = instance; };
      const onLeave: OnAsyncLeave = () => currentInstance === instance ? onRestore : undefined;
      asyncHandlers.add(onLeave);
      try {
        const r = callback();
        if (!isSingleton) {
          currentInstance = undefined;
        }
        return await r;
      } finally {
        asyncHandlers.delete(onLeave);
      }
    }
  };
}

export interface ContextNamespace {
  get: <T>(key: string) => UseContext<T>
}

export function createNamespace<T = any> () {
  const contexts: Record<string, UseContext<T>> = {};

  return {
    get (key) {
      if (!contexts[key]) {
        contexts[key] = createContext();
      }
      contexts[key] as UseContext<T>;
      return contexts[key];
    }
  };
}

const _globalThis = ((typeof globalThis !== "undefined")
  ? globalThis
  : ((typeof self !== "undefined")
    // eslint-disable-next-line no-undef
      ? self
      // eslint-disable-next-line unicorn/no-nested-ternary
      : (typeof global !== "undefined")
          ? global
          : (typeof window !== "undefined")
              ? window
              : {})) as typeof globalThis;

const globalKey = "__unctx__";

export const defaultNamespace: ContextNamespace =
  _globalThis[globalKey] || (_globalThis[globalKey] = createNamespace());

export const getContext = <T>(key: string) => defaultNamespace.get<T>(key);

export const useContext = <T>(key: string) => getContext<T>(key).use;

const asyncHandlersKey = "__unctx_async_handlers__";
const asyncHandlers: Set<OnAsyncLeave> =
  _globalThis[asyncHandlersKey] || (_globalThis[asyncHandlersKey] = new Set());

type AsyncFunction<T> = () => Promise<T>

export function executeAsync<T> (function_: AsyncFunction<T>): [Promise<T>, () => void] {
  const restores: OnAsyncRestore[] = [];
  for (const leaveHandler of asyncHandlers) {
    const restore = leaveHandler();
    if (restore) {
      restores.push(restore);
    }
  }
  const restore = () => {
    for (const restore of restores) {
      restore();
    }
  };
  let awaitable = function_();
  if (awaitable && typeof awaitable === "object" && "catch" in awaitable) {
    awaitable = awaitable.catch((error) => {
      restore();
      throw error;
    });
  }
  return [awaitable, restore];
}

export function withAsyncContext<T=any> (function_: AsyncFunction<T>, transformed?: boolean): AsyncFunction<T> {
  if (!transformed) {
    // eslint-disable-next-line no-console
    console.warn("[unctx] `withAsyncContext` needs transformation for async context support in", function_, "\n", function_.toString());
  }
  return function_;
}
