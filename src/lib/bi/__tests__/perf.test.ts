import { describe, it, expect, vi } from 'vitest'
import { BiTimeoutError, QueryCache, perfSettings, withTimeout } from '../perf'

describe('perfSettings', () => {
  it('padrões e limites', () => {
    expect(perfSettings(undefined)).toEqual({ cacheSeconds: 0, refreshSeconds: 0, timeoutSeconds: 30 })
    expect(perfSettings({ cache_seconds: '60', refresh_seconds: 300, timeout_seconds: 10 })).toEqual({ cacheSeconds: 60, refreshSeconds: 300, timeoutSeconds: 10 })
  })
  it('valores absurdos são limitados', () => {
    expect(perfSettings({ cache_seconds: 999999, refresh_seconds: 5, timeout_seconds: 1 })).toEqual({ cacheSeconds: 3600, refreshSeconds: 0, timeoutSeconds: 5 })
    expect(perfSettings({ cache_seconds: -3, refresh_seconds: 'x', timeout_seconds: 9999 })).toEqual({ cacheSeconds: 0, refreshSeconds: 0, timeoutSeconds: 300 })
  })
})

describe('withTimeout', () => {
  it('resolve quando a promessa termina a tempo', async () => {
    await expect(withTimeout(Promise.resolve(5), 50)).resolves.toBe(5)
  })
  it('rejeita com BiTimeoutError quando demora', async () => {
    vi.useFakeTimers()
    const p = withTimeout(new Promise(() => {}), 1000)
    const assertion = expect(p).rejects.toBeInstanceOf(BiTimeoutError)
    await vi.advanceTimersByTimeAsync(1001)
    await assertion
    vi.useRealTimers()
  })
  it('repassa o erro original', async () => {
    await expect(withTimeout(Promise.reject(new Error('x')), 50)).rejects.toThrow('x')
  })
})

describe('QueryCache', () => {
  const make = () => {
    let t = 0
    return { cache: new QueryCache<number>(3, () => t), tick: (ms: number) => { t += ms } }
  }

  it('guarda por tempo e expira', async () => {
    const { cache, tick } = make()
    const fn = vi.fn(async () => 1)
    expect((await cache.run('a', 1000, fn)).cached).toBe(false)
    expect((await cache.run('a', 1000, fn)).cached).toBe(true)
    tick(1001)
    expect((await cache.run('a', 1000, fn)).cached).toBe(false)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('ttl 0 não guarda, mas junta chamadas simultâneas', async () => {
    const { cache } = make()
    let release!: (v: number) => void
    const fn = vi.fn(() => new Promise<number>(r => { release = r }))
    const a = cache.run('k', 0, fn)
    const b = cache.run('k', 0, fn)
    release(9)
    expect((await a).value).toBe(9)
    expect((await b).value).toBe(9)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(cache.size).toBe(0)
  })

  it('fresh ignora o cache e o atualiza', async () => {
    const { cache } = make()
    let n = 0
    const fn = async () => ++n
    await cache.run('a', 1000, fn)
    expect((await cache.run('a', 1000, fn, true)).value).toBe(2)
    expect((await cache.run('a', 1000, fn)).value).toBe(2)
  })

  it('erro não fica em cache', async () => {
    const { cache } = make()
    const bad = vi.fn(async () => { throw new Error('banco fora') })
    await expect(cache.run('a', 1000, bad)).rejects.toThrow('banco fora')
    expect((await cache.run('a', 1000, async () => 3)).value).toBe(3)
  })

  it('respeita o tamanho máximo removendo o menos usado', async () => {
    const { cache } = make()
    for (const k of ['a', 'b', 'c']) await cache.run(k, 1000, async () => 1)
    cache.get('a') // "a" foi usado: "b" vira o mais antigo
    await cache.run('d', 1000, async () => 1)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe(1)
    expect(cache.size).toBe(3)
  })
})
