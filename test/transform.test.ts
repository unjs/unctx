import { expect, it, describe } from 'vitest'
import { createTransformer } from '../src/transform'

describe('transforms', () => {
  const transformer = createTransformer()

  function transform (input: string) {
    return transformer.transform(
      // Slice 6 spaces indention for snapshot alignment
      input.split('\n').map(i => i.slice(6)).join('\n')
    )?.code
  }

  it('transforms', () => {
    expect(transform(`
      export default withAsyncContext(async () => {
        const ctx1 = useSomething()
        await something()
        const ctx2 = useSomething()
      })
    `)).toMatchInlineSnapshot(`
      "import { excuteAsync as __excuteAsync } from \\"unctx\\";
      export default withAsyncContext(async () => {let __temp, __restore;
        const ctx1 = useSomething()
        ;(([__temp,__restore]=__excuteAsync(()=>something())),await __temp,__restore);
        const ctx2 = useSomething()
      })
      "
    `)
  })

  it('transforms await as variable', () => {
    expect(transform(`
      export default withAsyncContext(async () => {
        const foo = await something()
        const bar = hello(await something())
        const ctx = useSomething()
      })
    `)).toMatchInlineSnapshot(`
      "import { excuteAsync as __excuteAsync } from \\"unctx\\";
      export default withAsyncContext(async () => {let __temp, __restore;
        const foo = (([__temp,__restore]=__excuteAsync(()=>something())),__temp=await __temp,__restore,__temp)
        const bar = hello((([__temp,__restore]=__excuteAsync(()=>something())),__temp=await __temp,__restore,__temp))
        const ctx = useSomething()
      })
      "
    `)
  })

  it('transforms await in nested scopes', () => {
    expect(transform(`
      export default withAsyncContext(async () => {
        for (const i of foo) {
          if (i) {
            await i()
          }
        }
        const ctx = useSomething()
      })
    `)).toMatchInlineSnapshot(`
      "import { excuteAsync as __excuteAsync } from \\"unctx\\";
      export default withAsyncContext(async () => {let __temp, __restore;
        for (const i of foo) {
          if (i) {
            ;(([__temp,__restore]=__excuteAsync(()=>i())),await __temp,__restore);
          }
        }
        const ctx = useSomething()
      })
      "
    `)
  })

  it('does not transform non async usage', () => {
    expect(transform(`
      export default withAsyncContext(async () => {
        const ctx = useSomething()
      })
    `)).toMatchInlineSnapshot(`
      "
      export default withAsyncContext(async () => {
        const ctx = useSomething()
      })
      "
    `)
  })

  it('does not transform nested functions', () => {
    expect(transform(`
      export default withAsyncContext(async () => {
        async function foo() {
          await something()
        }
        const bar = async () => {
          await something()
        }
        const ctx = useSomething()
      })
    `)).toMatchInlineSnapshot(`
      "
      export default withAsyncContext(async () => {
        async function foo() {
          await something()
        }
        const bar = async () => {
          await something()
        }
        const ctx = useSomething()
      })
      "
    `)
  })
})
