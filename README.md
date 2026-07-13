# 🍦 unctx

> Composition-API in Vanilla js

[![npm version][npm-v-src]][npm-v-href]
[![npm downloads][npm-dm-src]][npm-dm-href]
[![package phobia][packagephobia-src]][packagephobia-href]
[![bundle phobia][bundlephobia-src]][bundlephobia-href]
[![codecov][codecov-src]][codecov-href]

## What is unctx?

[Vue.js](https://vuejs.org) introduced an amazing pattern called [Composition API](https://v3.vuejs.org/guide/composition-api-introduction.html) that allows organizing complex logic by splitting it into reusable functions and grouping in logical order. `unctx` allows easily implementing composition API pattern in your javascript libraries without hassle.

## Usage

In your **awesome** library:

```bash
npx nypm i unctx
```

```js
import { createContext } from "unctx";

const ctx = createContext();

export const useAwesome = ctx.use;

// ...
ctx.call({ test: 1 }, () => {
  // This is similar to the vue setup function
  // Any function called here can use `useAwesome` to get { test: 1 }
});
```

User code:

```js
import { useAwesome } from "awesome-lib";

// ...
function setup() {
  const ctx = useAwesome();
}
```

**Note:** When no context is presented `ctx.use` will throw an error. Use `ctx.tryUse` for tolerant usages (return nullable context).

### Using Namespaces

To avoid issues with multiple version of the library, `unctx` provides a safe global namespace to access context by key (kept in [`globalThis`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis)). **Important:** Please use a verbose name for the key to avoid conflict with other js libraries. Using the npm package name is recommended. Using symbols has no effect since it still causes multiple context issues.

```js
import { useContext, getContext } from "unctx";

const useAwesome = useContext("awesome-lib");

// or
// const awesomeContext = getContext('awesome-lib')
```

You can also create your internal namespace with `createNamespace` utility for more advanced use cases.

## Async Context

Using context is only possible in non-async usages and only before the first await statement. This is to make sure context is not shared between concurrent calls.

```js
async function setup() {
  console.log(useAwesome()); // Returns context
  setTimeout(() => {
    console.log(useAwesome());
  }, 1); // Returns null
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log(useAwesome()); // Returns null
}
```

A simple workaround is caching context into a local variable:

```js
async function setup() {
  const ctx = useAwesome(); // We can directly access cached version of ctx
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log(ctx);
}
```

This is not always an elegant and easy way by making a variable and passing it around. After all, this is the purpose of unctx to make sure context is magically available everywhere in composables!

### Native Async Context

Unctx supports Node.js [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) as a native way to preserve and track async contexts. To enable this mode, set the `asyncContext: true` option.

```ts
import { createContext } from "unctx";

const ctx = createContext({ asyncContext: true });

ctx.call("123", () => {
  setTimeout(() => {
    // Prints 123
    console.log(ctx.use());
  }, 100);
});
```

The `AsyncLocalStorage` implementation is auto-detected from `globalThis.AsyncLocalStorage` or the `node:async_hooks` built-in module. If neither is available (or you want to use a custom implementation), you can explicitly pass one with the `AsyncLocalStorage` option:

```ts
import { createContext } from "unctx";
import { AsyncLocalStorage } from "node:async_hooks";

const ctx = createContext({
  asyncContext: true,
  AsyncLocalStorage,
});
```

### Async Transform

Since native async context is not supported in all platforms yet, unctx provides a build-time solution that transforms async syntax to automatically restore context after each async/await statement. This requires using a bundler such as Rollup, Vite, or Webpack.

First, install the plugin peer dependencies. You always need `unplugin` and
`magic-string`, plus an oxc parser — either `oxc-parser` directly, or `rolldown`
(which re-exports the oxc utilities), which is convenient if you already depend
on it:

```sh
npx nypm i -D unplugin magic-string oxc-parser
# or, if you already use rolldown:
npx nypm i -D unplugin magic-string rolldown
```

These are all optional peer dependencies, so they only get installed if you use
the async transform.

Import and register transform plugin:

```js
import { unctxPlugin } from "unctx/plugin";

// Rollup
// TODO: Add to rollup configuration
unctxPlugin.rollup();

// Vite
// TODO: Add to vite configuration
unctxPlugin.vite();

// Webpack
// TODO: Add to webpack configuration
unctxPlugin.webpack();
```

Use `ctx.callAsync` instead of `ctx.call`:

```js
await ctx.callAsync("test", setup);
```

**_NOTE:_** `callAsync` is not transformed by default. You need to add it to the plugin's `asyncFunctions: []` option to transform it.

Any async function that requires context, should be wrapped with `withAsyncContext`:

```js
import { withAsyncContext } from "unctx";

const setup = withAsyncContext(async () => {
  console.log(useAwesome()); // Returns context
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log(useAwesome()); // Still returns context with dark magic!
});
```

### Transform API

If you are not using a bundler (or are building your own integration), the transform used by the plugin is also available standalone from `unctx/transform`. It only needs `magic-string` and an oxc parser (`oxc-parser` or `rolldown`) — `unplugin` is not required.

```js
import { createTransformer } from "unctx/transform";

const transformer = await createTransformer({
  // asyncFunctions: ["withAsyncContext"],
  // helperModule: "unctx",
  // helperName: "executeAsync",
  // objectDefinitions: {},
});

const result = transformer.transform(code);

if (result) {
  console.log(result.code); // Transformed code
  console.log(result.magicString.generateMap()); // Source map
}
```

`createTransformer` is async because the parser is imported lazily. It resolves to an object with:

- `transform(code, { force? })`: Returns `{ code, magicString }`, or `undefined` when nothing was transformed. Pass `{ force: true }` to skip the `shouldTransform` pre-check and always parse.
- `shouldTransform(code)`: Cheap check whether `code` contains a transformable call and an `await`.
- `filter`: `{ code: RegExp }` used to skip files that cannot contain a transformable call.

The same regexp can be computed without loading the parser via `getTransformFilter(options)`, which is useful for pre-filtering files:

```js
import { getTransformFilter } from "unctx/transform";

const { code: codeFilter } = getTransformFilter();
```

Options are shared with `unctxPlugin`:

| Option              | Default                | Description                                                                                                                                                          |
| ------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asyncFunctions`    | `["withAsyncContext"]` | Function names whose function arguments should be transformed. Add `"callAsync"` to transform `ctx.callAsync` usages.                                                |
| `helperModule`      | `"unctx"`              | Module the async helper is imported from.                                                                                                                            |
| `helperName`        | `"executeAsync"`       | Name of the async helper exported by `helperModule`.                                                                                                                 |
| `objectDefinitions` | `{}`                   | Object properties to transform, keyed by the defining function. For example `{ defineMeta: ["middleware"] }` transforms the `middleware` key passed to `defineMeta`. |

## Singleton Pattern

If you are sure it is safe to use a shared instance (not depending to request), you can also use `ctx.set` and `ctx.unset` for a [singleton pattern](https://en.wikipedia.org/wiki/Singleton_pattern).

**Note:** You cannot combine `set` with `call`. Always use `unset` before replacing the instance otherwise you will get `Context conflict` error.

```js
import { createContext } from "unctx";

const ctx = createContext();
ctx.set(new Awesome());

// Replacing instance without unset
// ctx.set(new Awesome(), true)

export const useAwesome = ctx.use;
```

## Typed Context

A generic type exists on all utilities to be set for instance/context type for typescript support.

```ts
// Return type of useAwesome is Awesome | null
const { use: useAwesome } = createContext<Awesome>();
```

## Under the hood

The composition of functions is possible using temporary context injection. When calling `ctx.call(instance, cb)`, `instance` argument will be stored in a temporary variable then `cb` is called. Any function inside `cb`, can then implicitly access the instance by using `ctx.use` (or `useAwesome`)

## Pitfalls

**context can be only used before first await**:

Please check [Async Context](#async-context) section.

**`Context conflict` error**:

In your library, you should only keep one `call()` running at a time (unless calling with the same reference for the first argument)

For instance, this makes an error:

```js
ctx.call({ test: 1 }, () => {
  ctx.call({ test: 2 }, () => {
    // Throws error!
  });
});
```

## License

MIT. Made with 💖

<!-- Refs -->

[npm-v-src]: https://flat.badgen.net/npm/v/unctx/latest
[npm-v-href]: https://npmjs.com/package/unctx
[npm-dm-src]: https://flat.badgen.net/npm/dm/unctx
[npm-dm-href]: https://npmjs.com/package/unctx
[packagephobia-src]: https://flat.badgen.net/packagephobia/install/unctx
[packagephobia-href]: https://packagephobia.now.sh/result?p=unctx
[bundlephobia-src]: https://flat.badgen.net/bundlephobia/min/unctx
[bundlephobia-href]: https://bundlephobia.com/result?p=unctx
[codecov-src]: https://flat.badgen.net/codecov/c/github/unjs/unctx/master
[codecov-href]: https://codecov.io/gh/unjs/unctx
