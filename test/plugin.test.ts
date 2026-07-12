import { describe, expect, it } from "vitest";
import { unctxPlugin } from "../src/plugin.ts";

function createTransformHandler(asyncFunction: string) {
  const raw = unctxPlugin.raw(
    {
      asyncFunctions: [asyncFunction],
    },
    { framework: "vite" },
  );
  const plugin = Array.isArray(raw) ? raw[0]! : raw;
  if (!plugin.transform || typeof plugin.transform === "function") {
    throw new TypeError("Expected an object transform hook");
  }
  return plugin.transform.handler;
}

describe("plugin", () => {
  it("isolates transformer options between instances", async () => {
    const fooTransform = createTransformHandler("fooAsync");
    const barTransform = createTransformHandler("barAsync");

    const fooResult = await fooTransform.call(
      undefined as never,
      "fooAsync(async () => { await task() })",
      "foo.js",
    );
    const barResult = await barTransform.call(
      undefined as never,
      "barAsync(async () => { await task() })",
      "bar.js",
    );

    expect(fooResult).toBeTruthy();
    expect(barResult).toBeTruthy();
    expect(
      await fooTransform.call(
        undefined as never,
        "barAsync(async () => { await task() })",
        "foo.js",
      ),
    ).toBeUndefined();
  });
});
