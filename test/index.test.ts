import { describe, it, expect, vi } from 'vitest'
import { createContext, createNamespace } from '../src'

describe('createContext', () => {
  it('call and use', () => {
    const ctx = createContext()
    expect(() => ctx.use()).toThrowError()
    expect(ctx.tryUse()).toBe(null)

    const res = ctx.call('A', () => {
      expect(ctx.use()).toBe('A')
      expect(ctx.use()).toBe('A')
      return 'OK'
    })
    expect(res).toBe('OK')
  })

  it('context conflict', () => {
    const ctx = createContext()
    expect(ctx.tryUse()).toBe(null)
    ctx.call('A', () => {
      expect(() => ctx.call('B', vi.fn())).toThrow('Context conflict')
    })
  })

  it('unset on error', () => {
    const ctx = createContext()
    const throwError = () => { throw new Error('Foo') }
    expect(() => ctx.call('A', throwError)).toThrow('Foo')
    expect(() => ctx.call('B', throwError)).toThrow('Foo')
  })

  it('use async', async () => {
    const ctx = createContext()
    expect(ctx.tryUse()).toBe(null)
    const res = await ctx.call('A', async () => {
      expect(ctx.use()).toBe('A')
      await Promise.resolve()
      expect(ctx.tryUse()).toBe(null)
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

describe('singleton', () => {
  it('set/unset', () => {
    const ctx = createContext()
    expect(ctx.tryUse()).toBe(null)
    ctx.set('A')
    ctx.set('A')
    expect(ctx.use()).toBe('A')
    expect(ctx.use()).toBe('A')
    ctx.unset()
    expect(ctx.tryUse()).toBe(null)
  })

  it('call compatibility', () => {
    const ctx = createContext()
    ctx.set('A')
    ctx.call('A', () => {})
    expect(ctx.use()).toBe('A')
  })

  it('conflict', () => {
    const ctx = createContext()
    ctx.set('A')
    expect(() => ctx.set('B')).toThrow('Context conflict')
  })

  it('replace', () => {
    const ctx = createContext()
    ctx.set('A')
    ctx.set('B', true)
    expect(ctx.use()).toBe('B')
  })
})
