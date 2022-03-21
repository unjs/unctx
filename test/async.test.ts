import { describe, it, expect } from 'vitest'
import { createContext } from '../src'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('callAsync', () => {
  it('call and use', async () => {
    const ctx = createContext()
    expect(ctx.use()).toBe(null)

    const res = await Promise.all([
      ctx.callAsync('A', async () => {
        expect(ctx.use()).toBe('A')
        await sleep(1)
        expect(ctx.use()).toBe('A')
        return ctx.use()
      }),
      ctx.callAsync('B', async () => {
        expect(ctx.use()).toBe('B')
        await sleep(1)
        expect(ctx.use()).toBe('B')
        return ctx.use()
      }),
      ctx.callAsync('C', async () => {
        await sleep(5)
        expect(ctx.use()).toBe('C')
        return ctx.use()
      })
    ])

    expect(res).toEqual(['A', 'B', 'C'])
  })
})
