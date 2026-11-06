import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TourPlayer, type PlayerAdapter, type PlayerSnapshot } from '../interactiveHelp/player'
import type { Tour, TourStep } from '../interactiveHelp/types'

const step = (id: string, kind: TourStep['kind'], extra: Partial<TourStep> = {}): TourStep => ({ id, kind, caption: { pt: `legenda ${id}`, en: `caption ${id}` }, ...extra })

function fakeAdapter(missing: string[] = []) {
  const log: string[] = []
  const adapter: PlayerAdapter = {
    find: async (s) => (missing.includes(s.id) ? null : { id: s.id }),
    showStep: (el, caption) => { log.push(`show:${(el as any)?.id ?? '-'}:${caption}`) },
    click: (el: any) => { log.push(`click:${el.id}`) },
    setText: (el: any, text) => { log.push(`text:${el.id}:${text}`) },
    selectFirst: async (el: any) => { log.push(`first:${el.id}`); return true },
    selectValue: (el: any, v) => { log.push(`value:${el.id}:${v}`); return true },
    check: (el: any) => { log.push(`check:${el.id}`) },
    clear: () => { log.push('clear') },
  }
  return { adapter, log }
}

const tour = (steps: TourStep[]): Tour => ({ id: 't', action: 'create', title: { pt: 'T' }, fill: 'required', steps })
const target = { type: 'button' as const, ref: 'new' as const }

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('player da Ajuda Interativa', () => {
  it('executa os passos na ordem: clicar, digitar letra a letra, escolher e marcar', async () => {
    const { adapter, log } = fakeAdapter()
    const p = new TourPlayer(tour([
      step('a', 'click', { target }),
      step('b', 'type', { target: { type: 'field', ref: 'x' }, value: 'Oi' }),
      step('c', 'select', { target: { type: 'field', ref: 'y' }, value: { pick: 'first' } }),
      step('d', 'check', { target: { type: 'field', ref: 'z' } }),
    ]), adapter, { speed: 'fast' })
    p.play()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(log.filter(l => !l.startsWith('show'))).toEqual(['click:a', 'text:b:', 'text:b:O', 'text:b:Oi', 'first:c', 'check:d', 'clear'])
    expect(p.snapshot.state).toBe('ended')
  })

  it('mostra a legenda no idioma pedido, com queda para o português', async () => {
    const { adapter, log } = fakeAdapter()
    const p = new TourPlayer(tour([step('a', 'click', { target })]), adapter, { speed: 'fast', language: 'en' })
    p.play(); await vi.advanceTimersByTimeAsync(20_000)
    expect(log[0]).toBe('show:a:caption a')
    const { adapter: a2, log: l2 } = fakeAdapter()
    const p2 = new TourPlayer(tour([step('a', 'click', { target })]), a2, { speed: 'fast', language: 'es' })
    p2.play(); await vi.advanceTimersByTimeAsync(20_000)
    expect(l2[0]).toBe('show:a:legenda a')
  })

  it('pula o passo cujo elemento não existe, sem travar o resto', async () => {
    const { adapter, log } = fakeAdapter(['b'])
    const p = new TourPlayer(tour([step('a', 'click', { target }), step('b', 'click', { target }), step('c', 'click', { target })]), adapter, { speed: 'fast' })
    p.play(); await vi.advanceTimersByTimeAsync(60_000)
    expect(log.filter(l => l.startsWith('click'))).toEqual(['click:a', 'click:c'])
    expect(p.snapshot.skipped).toBe(1)
    expect(p.snapshot.state).toBe('ended')
  })

  it('a velocidade muda o tempo: Rápido termina antes do Lento', async () => {
    const run = async (speed: 'slow' | 'fast') => {
      const { adapter } = fakeAdapter()
      const p = new TourPlayer(tour([step('a', 'click', { target }), step('b', 'click', { target })]), adapter, { speed })
      p.play()
      let t = 0
      while (p.snapshot.state !== 'ended' && t < 120_000) { await vi.advanceTimersByTimeAsync(100); t += 100 }
      return t
    }
    const fast = await run('fast'); const slow = await run('slow')
    expect(fast).toBeLessThan(slow / 3)
  })

  it('pausa e continua; passo a passo executa um passo e volta a pausar', async () => {
    const { adapter, log } = fakeAdapter()
    const snaps: PlayerSnapshot[] = []
    const p = new TourPlayer(tour([step('a', 'click', { target }), step('b', 'click', { target }), step('c', 'click', { target })]), adapter, { speed: 'fast', onChange: s => snaps.push(s) })
    p.step() // parado no início: roda só o primeiro
    await vi.advanceTimersByTimeAsync(10_000)
    expect(log.filter(l => l.startsWith('click'))).toEqual(['click:a'])
    expect(p.snapshot.state).toBe('paused')
    p.step()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(log.filter(l => l.startsWith('click'))).toEqual(['click:a', 'click:b'])
    p.play() // continua até o fim
    await vi.advanceTimersByTimeAsync(20_000)
    expect(log.filter(l => l.startsWith('click'))).toEqual(['click:a', 'click:b', 'click:c'])
    expect(p.snapshot.state).toBe('ended')
  })

  it('parar interrompe e limpa o destaque', async () => {
    const { adapter, log } = fakeAdapter()
    const p = new TourPlayer(tour([step('a', 'click', { target }), step('b', 'click', { target })]), adapter, { speed: 'slow' })
    p.play(); await vi.advanceTimersByTimeAsync(500)
    p.stop(); await vi.advanceTimersByTimeAsync(60_000)
    expect(log.filter(l => l.startsWith('click'))).toEqual([])
    expect(log).toContain('clear')
  })

  it('passo de nota (sem elemento) só mostra a legenda', async () => {
    const { adapter, log } = fakeAdapter()
    const p = new TourPlayer(tour([step('n', 'note')]), adapter, { speed: 'fast' })
    p.play(); await vi.advanceTimersByTimeAsync(20_000)
    expect(log[0]).toBe('show:-:legenda n')
    expect(p.snapshot.state).toBe('ended')
  })
})

describe('passo de observação cujo elemento não existe', () => {
  it('espera pouco (não os 2,5 s de um clique), para não arrastar o tutorial', async () => {
    const timeouts: Record<string, number> = {}
    const { adapter } = fakeAdapter()
    const spy: PlayerAdapter = { ...adapter, find: async (s, ms) => { timeouts[s.id] = ms; return null } }
    const p = new TourPlayer(tour([step('click1', 'click', { target }), step('note1', 'note', { target: { type: 'field', ref: 'x' } })]), spy, { speed: 'fast' })
    p.play(); await vi.advanceTimersByTimeAsync(20_000)
    expect(timeouts.click1).toBe(2500)
    expect(timeouts.note1).toBe(600)
  })
})

describe('autocomplete: digita o termo e escolhe a primeira sugestão', () => {
  const acAdapter = (found: boolean) => {
    const { adapter, log } = fakeAdapter()
    adapter.isAutocomplete = () => true
    adapter.pickSuggestion = async (el: any) => { log.push(`pick:${el.id}`); return found }
    return { adapter, log }
  }
  const ac = (value: string) => tour([step('a', 'select', { target: { type: 'field', ref: 'p' }, value })])

  it('com termo: digita letra a letra e escolhe a primeira sugestão', async () => {
    const { adapter, log } = acAdapter(true)
    const p = new TourPlayer(ac('ca'), adapter, { speed: 'fast' })
    p.play(); await vi.advanceTimersByTimeAsync(60_000)
    expect(log.filter(l => !l.startsWith('show'))).toEqual(['text:a:', 'text:a:c', 'text:a:ca', 'pick:a', 'clear'])
    expect(p.snapshot.skipped).toBe(0)
  })

  it('sem termo o passo é pulado e nada é digitado', async () => {
    const { adapter, log } = acAdapter(true)
    const p = new TourPlayer(ac(''), adapter, { speed: 'fast' })
    p.play(); await vi.advanceTimersByTimeAsync(60_000)
    expect(log.some(l => l.startsWith('text') || l.startsWith('pick'))).toBe(false)
    expect(p.snapshot.skipped).toBe(1)
  })

  it('busca sem resultado: o passo conta como pulado e o tutorial termina', async () => {
    const { adapter } = acAdapter(false)
    const p = new TourPlayer(ac('zzz'), adapter, { speed: 'fast' })
    p.play(); await vi.advanceTimersByTimeAsync(60_000)
    expect(p.snapshot.skipped).toBe(1)
    expect(p.snapshot.state).toBe('ended')
  })
})

describe('arrastar', () => {
  it('chama o adaptador com o destino e conta como pulado se não conseguiu', async () => {
    const { adapter, log } = fakeAdapter()
    let ok = true
    adapter.drag = async (el: any, s) => { log.push(`drag:${el.id}:${(s.to as any).ref}`); return ok }
    const st = step('d', 'drag', { target: { type: 'button', ref: 'kanban-card' }, to: { type: 'kanban-column', ref: 'other' } })
    const p = new TourPlayer(tour([st]), adapter, { speed: 'fast' })
    p.play(); await vi.advanceTimersByTimeAsync(60_000)
    expect(log).toContain('drag:d:other')
    expect(p.snapshot.skipped).toBe(0)
    ok = false
    const { adapter: a2 } = fakeAdapter()
    a2.drag = async () => false
    const p2 = new TourPlayer(tour([st]), a2, { speed: 'fast' })
    p2.play(); await vi.advanceTimersByTimeAsync(60_000)
    expect(p2.snapshot.skipped).toBe(1)
  })
})
