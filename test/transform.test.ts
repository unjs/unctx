import { expect, it, describe } from "vitest";
import { createTransformer } from "../src/transform/acorn";

describe("transforms", () => {
  const transformer = createTransformer({
    asyncFunctions: ["withAsyncContext", "callAsync"],
    objectDefinitions: {
      defineSomething: ["someKey"],
    },
  });

  function transform(input: string) {
    return transformer.transform(
      // Slice 6 spaces indention for snapshot alignment
      input
        .split("\n")
        .map((index) => index.slice(6))
        .join("\n"),
    )?.code;
  }

  it("transforms", () => {
    expect(
      transform(`
      export default withAsyncContext(async () => {
        const ctx1 = useSomething()
        await something()
        const ctx2 = useSomething()
      })
    `),
    ).toMatchSnapshot();
  });

  it("transforms await as variable", () => {
    expect(
      transform(`
      export default withAsyncContext(async () => {
        const foo = await something()
        const bar = hello(await something())
        const ctx = useSomething()
      })
    `),
    ).toMatchSnapshot();
  });

  it("transforms await in nested scopes", () => {
    expect(
      transform(`
      export default withAsyncContext(async () => {
        for (const i of foo) {
          if (i) {
            await i()
          }
        }
        const ctx = useSomething()
      })
    `),
    ).toMatchSnapshot();
  });

  it("transforms await in try-catch", () => {
    expect(
      transform(`
      export default withAsyncContext(async () => {
        let user;

        try {
          user = await fetchUser();
        } catch (e) {
          user = null;
        }

        if (!user)
          return navigateTo('/');
      })
    `),
    ).toMatchSnapshot();
  });

  it("transforms dot usage", () => {
    expect(
      transform(`
      export default ctx.callAsync(async () => {
        const ctx1 = useSomething()
        await something()
        const ctx2 = useSomething()
      })
    `),
    ).toMatchSnapshot();

    expect(
      transform(`
      export default x.ctx.callAsync(async () => {
        const ctx1 = useSomething()
        await something()
        const ctx2 = useSomething()
      })
    `),
    ).toMatchSnapshot();
  });

  it("does not transform non async usage", () => {
    expect(
      transform(`
      export default withAsyncContext(async () => {
        const ctx = useSomething()
      })
    `),
    ).toBeUndefined();
  });

  it("does not transform unrelated nested functions", () => {
    expect(
      transform(`
      export default withAsyncContext(async () => {
        async function foo() {
          await something()
        }
        const bar = async () => {
          await something()
        }
        const ctx = useSomething()
      })
    `),
    ).toBeUndefined();
  });

  it("transforms validly nested functions", () => {
    expect(
      transform(`
      export default withAsyncContext(async () => {
        await something()

        withAsyncContext(async () => {
          await something()
        })

        const ctx = useSomething()
      })
    `),
    ).toMatchSnapshot();
  });

  it("transforms multiple awaits in same chunk", () => {
    expect(
      transform(`
      export default withAsyncContext(async () => {
        await writeConfig(await readConfig())
      })
    `),
    ).toMatchSnapshot();
  });

  it("does not transform non target function", () => {
    expect(
      transform(`
      export default someFunction(async () => {
        const ctx1 = useSomething()
        await something()
        const ctx2 = useSomething()
      })
    `),
    ).toBeUndefined();
  });

  it("transforms certain keys of an object", () => {
    expect(
      transform(`
      export default defineSomething({
        someKey: async () => {
          const ctx1 = useSomething()
          await something()
          const ctx2 = useSomething()
        },
        async someKey () {
          const ctx1 = useSomething()
          await something()
          const ctx2 = useSomething()
        },
        ...someKey,
        someKey: 421,
        someKey () {
          const ctx1 = useSomething()
          const ctx2 = useSomething()
        },
        async someOtherKey () {
          const ctx1 = useSomething()
          await something()
          const ctx2 = useSomething()
        }
      })
    `),
    ).toMatchSnapshot();
  });

  it("doesn't transform non-objects", () => {
    expect(
      transform(`
      export default defineSomething('test')
    `),
    ).toBeUndefined();
  });
  it("Should not add a statement terminator if expression comes after if statement", () => {
    expect(
      transform(`
      export default withAsyncContext(async () => {
        if(false) await something()
      })
    `),
    ).toMatchSnapshot();
  });
});
