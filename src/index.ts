import type { AsyncLocalStorage } from "node:async_hooks";

export interface UseContext<T> {
  /**
   * Get the current context. Throws if no context is set.
   */
  use: () => T;
  /**
   * Get the current context. Returns `null` when no context is set.
   */
  tryUse: () => T | null;
  /**
   * Set the context as Singleton Pattern.
   */
  set: (instance?: T, replace?: boolean) => void;
  /**
   * Clear current context.
   */
  unset: () => void;
  /**
   * Exclude a synchronous function with the provided context.
   */
  call: <R>(instance: T, callback: () => R) => R;
  /**
   * Exclude an asynchronous function with the provided context.
   * Requires installing the transform plugin to work properly.
   */
  callAsync: <R>(instance: T, callback: () => R | Promise<R>) => Promise<R>;
}

type OnAsyncRestore = () => void;
type OnAsyncLeave = () => void | OnAsyncRestore;

export interface ContextOptions {
  asyncContext?: boolean;
  AsyncLocalStorage?: typeof AsyncLocalStorage;
}

export function createContext<T = any>(
  opts: ContextOptions = {}
): UseContext<T> {
  let currentInstance: T;
  let isSingleton = false;

  const checkConflict = (instance: T) => {
    if (currentInstance && currentInstance !== instance) {
      throw new Error("Context conflict");
    }
  };

  // Async hooks support
  let als: AsyncLocalStorage<any>;
  if (opts.asyncContext) {
    const _AsyncLocalStorage: typeof AsyncLocalStorage<any> =
      opts.AsyncLocalStorage || globalThis.AsyncLocalStorage;
    if (_AsyncLocalStorage) {
      als = new _AsyncLocalStorage();
    } else {
      console.warn("[unctx] `AsyncLocalStorage` is not provided.");
    }
  }

  const _getCurrentInstance = () => {
    if (als && currentInstance === undefined) {
      const instance = als.getStore();
      if (instance !== undefined) {
        return instance;
      }
    }
    return currentInstance;
  };

  return {
    use: () => {
      const _instance = _getCurrentInstance();
      if (_instance === undefined) {
        throw new Error("Context is not available");
      }
      return _instance;
    },
    tryUse: () => {
      return _getCurrentInstance();
    },
    set: (instance: T, replace?: boolean) => {
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
        return als ? als.run(instance, callback) : callback();
      } finally {
        if (!isSingleton) {
          currentInstance = undefined;
        }
      }
    },
    async callAsync(instance: T, callback) {
      currentInstance = instance;
      const onRestore: OnAsyncRestore = () => {
        currentInstance = instance;
      };
      const onLeave: OnAsyncLeave = () =>
        currentInstance === instance ? onRestore : undefined;
      asyncHandlers.add(onLeave);
      try {
        const r = als ? als.run(instance, callback) : callback();
        if (!isSingleton) {
          currentInstance = undefined;
        }
        return await r;
      } finally {
        asyncHandlers.delete(onLeave);
      }
    },
  };
}

export interface ContextNamespace {
  get: <T>(key: string, opts?: ContextOptions) => UseContext<T>;
}

export function createNamespace<T = any>(defaultOpts: ContextOptions = {}) {
  const contexts: Record<string, UseContext<T>> = {};

  return {
    get(key, opts: ContextOptions = {}) {
      if (!contexts[key]) {
        contexts[key] = createContext({ ...defaultOpts, ...opts });
      }
      contexts[key] as UseContext<T>;
      return contexts[key];
    },
  };
}

/* eslint-disable */
const _globalThis = (
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof self !== "undefined"
    ? self
    : typeof global !== "undefined"
    ? global
    : typeof window !== "undefined"
    ? window
    : {}
) as typeof globalThis;
/* eslint-enable */

const globalKey = "__unctx__";

export const defaultNamespace: ContextNamespace =
  _globalThis[globalKey] || (_globalThis[globalKey] = createNamespace());

export const getContext = <T>(key: string, opts: ContextOptions = {}) =>
  defaultNamespace.get<T>(key, opts);

export const useContext = <T>(key: string, opts: ContextOptions = {}) =>
  getContext<T>(key, opts).use;

const asyncHandlersKey = "__unctx_async_handlers__";
const asyncHandlers: Set<OnAsyncLeave> =
  _globalThis[asyncHandlersKey] || (_globalThis[asyncHandlersKey] = new Set());

type AsyncFunction<T> = () => Promise<T>;

export function executeAsync<T>(
  function_: AsyncFunction<T>
): [Promise<T>, () => void] {
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

export function withAsyncContext<T = any>(
  function_: AsyncFunction<T>,
  transformed?: boolean
): AsyncFunction<T> {
  if (!transformed) {
    // eslint-disable-next-line no-console
    console.warn(
      "[unctx] `withAsyncContext` needs transformation for async context support in",
      function_,
      "\n",
      function_.toString()
    );
  }
  return function_;
}
