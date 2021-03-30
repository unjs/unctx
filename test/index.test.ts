import { createContext, createNamespace } from '../src'

describe('createContext', () => {
  it('call and use', () => {
    const ctx = createContext()
    expect(ctx.use()).toBe(null)
    const res = ctx.call('A', () => {
      expect(ctx.use()).toBe('A')
      expect(ctx.use()).toBe('A')
      return 'OK'
    })
    expect(res).toBe('OK')
  })

  it('context conflict', () => {
    const ctx = createContext()
    expect(ctx.use()).toBe(null)
    ctx.call('A', () => {
      expect(() => ctx.call('B', jest.fn())).toThrow('Context conflict')
    })
  })

  it('use async', async () => {
    const ctx = createContext()
    expect(ctx.use()).toBe(null)
    const res = await ctx.call('A', async () => {
      expect(ctx.use()).toBe('A')
      await Promise.resolve()
      expect(ctx.use()).toBe(null)
      return 'OK'
    })
    expect(res).toBe('OK')
  })
})

describe('namespace', () => {
  it('createNamespace', () => {
    const ns = createNamespace()
    expect(ns.get('A')).toBe(ns.get('A'))
  })
})
