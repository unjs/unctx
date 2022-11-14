import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
// import { unctxPlugin } from './src/plugin' // TODO
import jiti from "jiti";
const { unctxPlugin } = jiti(import.meta.url, { esmResolve: true })("./src/plugin");

export default defineConfig({
  plugins: [
    unctxPlugin.vite({
      asyncFunctions: ["withAsyncContext", "callAsync"],
      helperModule: resolve("./src/index.ts"),
      transformInclude: id => id.includes("async.test")
    })
  ]
});
