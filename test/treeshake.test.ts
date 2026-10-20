import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { rolldown } from "rolldown";

const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url));

describe("tree-shaking", () => {
  it("drops context machinery for executeAsync-only consumers", async () => {
    const build = await rolldown({
      input: "entry",
      logLevel: "silent",
      plugins: [
        {
          name: "entry",
          resolveId: (id) => (id === "entry" ? id : null),
          load: (id) =>
            id === "entry"
              ? `export { executeAsync } from ${JSON.stringify(entry)}`
              : null,
        },
      ],
    });
    const { output } = await build.generate({ format: "esm", minify: true });

    expect(output[0].code).toContain("executeAsync");
    expect(output[0].code).not.toContain("Context conflict");
    expect(output[0].code).not.toContain("AsyncLocalStorage");
    expect(output[0].code).not.toContain("__unctx__");
  });
});
