import { expect, it, describe } from "vitest";
import { createTransformer as acornTransformer } from "../src/transform/acorn";
import { createTransformer as oxcTransformer } from "../src/transform/oxc";

const transformers = [
  { name: "acorn", create: acornTransformer },
  { name: "oxc", create: oxcTransformer },
] as const;

describe("transforms", () => {
  for (const { name, create } of transformers) {
    describe(name, () => {
      const transformer = create({
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
        ).toMatchInlineSnapshot(`
      "import { executeAsync as __executeAsync } from "unctx";
      export default withAsyncContext(async () => {let __temp, __restore;
        const ctx1 = useSomething()
        ;(([__temp,__restore]=__executeAsync(()=>something())),await __temp,__restore());
        const ctx2 = useSomething()
      },1)
      "
    `);
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
        ).toMatchInlineSnapshot(`
      "import { executeAsync as __executeAsync } from "unctx";
      export default withAsyncContext(async () => {let __temp, __restore;
        const foo = (([__temp,__restore]=__executeAsync(()=>something())),__temp=await __temp,__restore(),__temp)
        const bar = hello((([__temp,__restore]=__executeAsync(()=>something())),__temp=await __temp,__restore(),__temp))
        const ctx = useSomething()
      },1)
      "
    `);
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
        ).toMatchInlineSnapshot(`
      "import { executeAsync as __executeAsync } from "unctx";
      export default withAsyncContext(async () => {let __temp, __restore;
        for (const i of foo) {
          if (i) {
            ;(([__temp,__restore]=__executeAsync(()=>i())),await __temp,__restore());
          }
        }
        const ctx = useSomething()
      },1)
      "
    `);
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
        ).toMatchInlineSnapshot(`
      "import { executeAsync as __executeAsync } from "unctx";
      export default withAsyncContext(async () => {let __temp, __restore;
        let user;

        try {
          user = (([__temp,__restore]=__executeAsync(()=>fetchUser())),__temp=await __temp,__restore(),__temp);
        } catch (e) {
          user = null;
        }

        if (!user)
          return navigateTo('/');
      },1)
      "
    `);
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
        ).toMatchInlineSnapshot(`
      "import { executeAsync as __executeAsync } from "unctx";
      export default ctx.callAsync(async () => {let __temp, __restore;
        const ctx1 = useSomething()
        ;(([__temp,__restore]=__executeAsync(()=>something())),await __temp,__restore());
        const ctx2 = useSomething()
      })
      "
    `);

        expect(
          transform(`
      export default x.ctx.callAsync(async () => {
        const ctx1 = useSomething()
        await something()
        const ctx2 = useSomething()
      })
    `),
        ).toMatchInlineSnapshot(`
      "import { executeAsync as __executeAsync } from "unctx";
      export default x.ctx.callAsync(async () => {let __temp, __restore;
        const ctx1 = useSomething()
        ;(([__temp,__restore]=__executeAsync(()=>something())),await __temp,__restore());
        const ctx2 = useSomething()
      })
      "
    `);
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
        ).toMatchInlineSnapshot(`
      "import { executeAsync as __executeAsync } from "unctx";
      export default withAsyncContext(async () => {let __temp, __restore;
        ;(([__temp,__restore]=__executeAsync(()=>something())),await __temp,__restore());

        withAsyncContext(async () => {let __temp, __restore;
          ;(([__temp,__restore]=__executeAsync(()=>something())),await __temp,__restore());
        },1)

        const ctx = useSomething()
      },1)
      "
    `);
      });

      it("transforms multiple awaits in same chunk", () => {
        expect(
          transform(`
      export default withAsyncContext(async () => {
        await writeConfig(await readConfig())
      })
    `),
        ).toMatchInlineSnapshot(`
      "import { executeAsync as __executeAsync } from "unctx";
      export default withAsyncContext(async () => {let __temp, __restore;
        ;(([__temp,__restore]=__executeAsync(()=>writeConfig((([__temp,__restore]=__executeAsync(()=>readConfig())),__temp=await __temp,__restore(),__temp)))),await __temp,__restore());
      },1)
      "
    `);
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
        ).toMatchInlineSnapshot(`
      "import { executeAsync as __executeAsync } from "unctx";
      export default defineSomething({
        someKey: async () => {let __temp, __restore;
          const ctx1 = useSomething()
          ;(([__temp,__restore]=__executeAsync(()=>something())),await __temp,__restore());
          const ctx2 = useSomething()
        },
        async someKey () {let __temp, __restore;
          const ctx1 = useSomething()
          ;(([__temp,__restore]=__executeAsync(()=>something())),await __temp,__restore());
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
      "
    `);
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
        ).toMatchInlineSnapshot(`
      "import { executeAsync as __executeAsync } from "unctx";
      export default withAsyncContext(async () => {let __temp, __restore;
        if(false) (([__temp,__restore]=__executeAsync(()=>something())),__temp=await __temp,__restore(),__temp)
      },1)
      "
    `);
      });
    });
  }
});
