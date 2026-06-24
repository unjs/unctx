import { describe, expect, it } from "vitest";
import { unctxPlugin } from "../src/plugin.ts";

function createTransformHandler(
  parser: "acorn" | "oxc",
  asyncFunction: string,
) {
  const plugin = unctxPlugin.raw(
    {
      parser,
      asyncFunctions: [asyncFunction],
    },
    { framework: "vite" },
  );
  if (!plugin.transform || typeof plugin.transform === "function") {
    throw new TypeError("Expected an object transform hook");
  }
  return plugin.transform.handler;
}

describe("plugin", () => {
  it("isolates transformer options between instances", async () => {
    const acornTransform = createTransformHandler("acorn", "acornAsync");
    const oxcTransform = createTransformHandler("oxc", "oxcAsync");

    const acornResult = await acornTransform.call(
      undefined as never,
      "acornAsync(async () => { await task() })",
      "acorn.js",
    );
    const oxcResult = await oxcTransform.call(
      undefined as never,
      "oxcAsync(async () => { await task() })",
      "oxc.js",
    );

    expect(acornResult).toBeTruthy();
    expect(oxcResult).toBeTruthy();
    expect(
      await acornTransform.call(
        undefined as never,
        "oxcAsync(async () => { await task() })",
        "acorn.js",
      ),
    ).toBeUndefined();
  });
});
