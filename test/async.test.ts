import { describe, it, expect, fn } from 'vitest'
import { createContext, withAsyncContext } from '../src'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('callAsync', () => {
  it('call and use', async () => {
    const ctx = createContext()
    expect(ctx.tryUse()).toBe(null)

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

  it('non transformed should unset context', async () => {
    const ctx = createContext()
    const _callAsync = ctx.callAsync // Skip transform
    await _callAsync('A', async () => {
      expect(ctx.tryUse()).toBe('A')
      await sleep(1)
      expect(ctx.tryUse()).toBe(null)
    })
  })

  it('withAsyncContext', async () => {
    const ctx = createContext()
    const _callAsync = ctx.callAsync // Skip transform
    await _callAsync('A', withAsyncContext(async () => {
      expect(ctx.use()).toBe('A')
      await sleep(1)
      expect(ctx.use()).toBe('A')
    }))
  })

  it('withAsyncContext (not transformed)', async () => {
    const ctx = createContext()
    const _callAsync = ctx.callAsync // Skip transform
    const _withAsyncContext = withAsyncContext
    // eslint-disable-next-line no-console
    const _warn = console.warn
    // eslint-disable-next-line no-console
    console.warn = fn()
    await _callAsync('A', _withAsyncContext(async () => {
      expect(ctx.use()).toBe('A')
      await sleep(1)
      expect(ctx.tryUse()).toBe(null)
    }))
    // eslint-disable-next-line no-console
    expect(console.warn).toHaveBeenCalledOnce()
    // eslint-disable-next-line no-console
    console.warn = _warn
  })
})
