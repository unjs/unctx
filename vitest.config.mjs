import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
// import { unctxPlugin } from './src/plugin' // TODO
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const { unctxPlugin } = await jiti.import("./src/plugin");

export default defineConfig({
  plugins: [
    unctxPlugin.vite({
      asyncFunctions: ["withAsyncContext", "callAsync"],
      helperModule: resolve("./src/index.ts"),
      transformInclude: (id) => id.includes("async.test"),
    }),
  ],
});
