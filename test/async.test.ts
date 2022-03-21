import { describe, it, expect } from 'vitest'
import { createContext } from '../src'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('callAsync', () => {
  it('call and use', async () => {
    const ctx = createContext()
    expect(ctx.use()).toBe(null)

    const { callAsync } = ctx
    const res = await Promise.all([
      callAsync('A', async () => {
        expect(ctx.use()).toBe('A')
        await sleep(1)
        expect(ctx.use()).toBe('A')
        return 'A'
      }),
      callAsync('B', async () => {
        expect(ctx.use()).toBe('B')
        await sleep(1)
        expect(ctx.use()).toBe('B')
        return 'B'
      })
    ])

    expect(res).toEqual(['A', 'B'])
  })
})
