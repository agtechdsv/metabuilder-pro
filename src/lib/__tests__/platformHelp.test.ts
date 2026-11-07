import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { PLATFORM_TOURS } from '../platformHelp/catalog'
import { matchRoute, toursForRoute } from '../platformHelp/routes'
import { getActiveTour, goToStep, nextStep, prevStep, startPlatformTour, stopPlatformTour } from '../platformHelp/store'
import { isServerActionCall } from '../demo/demoMode'

describe('rotas da ajuda da plataforma', () => {
  it('casa trechos fixos, :parâmetros e * no fim', () => {
    expect(matchRoute('/admin/:ws/:proj/studio', '/admin/a/b/studio')).toBe(true)
    expect(matchRoute('/admin/:ws/:proj/studio', '/admin/a/b/studio/')).toBe(true)
    expect(matchRoute('/admin/:ws/:proj/studio', '/admin/a/b/studio?x=1')).toBe(true)
    expect(matchRoute('/admin/:ws/:proj/studio', '/admin/a/b/studio/data')).toBe(false)
    expect(matchRoute('/admin/:ws/:proj/studio/data', '/admin/a/b/studio/data')).toBe(true)
    expect(matchRoute('/admin/:ws/*', '/admin/a/b/studio/data')).toBe(true)
    expect(matchRoute('/admin/:ws/:proj/studio', '/admin/a/studio')).toBe(false)
  })

  it('cada tela recebe só os tours dela', () => {
    const ids = (p: string) => toursForRoute(PLATFORM_TOURS, p).map(t => t.id)
    expect(ids('/admin/w/p/studio')).toEqual(['studio-visao-geral', 'studio-criar-caso-de-uso'])
    expect(ids('/admin/w/p/studio/data')).toEqual(['studio-dados'])
    expect(ids('/admin/w/p/studio/logs')).toEqual(['studio-logs'])
    expect(ids('/outra/rota')).toEqual([])
  })
})

describe('catálogo da ajuda da plataforma', () => {
  const langs = ['pt', 'en', 'es'] as const
  const filled = (t: any) => langs.every(l => typeof t?.[l] === 'string' && t[l].trim().length > 0)

  it('ids únicos, passos com texto nos 3 idiomas e advanceOnClick sempre com alvo', () => {
    const tourIds = new Set<string>()
    for (const tour of PLATFORM_TOURS) {
      expect(tourIds.has(tour.id), `tour repetido: ${tour.id}`).toBe(false)
      tourIds.add(tour.id)
      expect(filled(tour.title), `${tour.id}: título`).toBe(true)
      expect(filled(tour.summary), `${tour.id}: resumo`).toBe(true)
      expect(tour.steps.length).toBeGreaterThan(0)
      const stepIds = new Set<string>()
      for (const s of tour.steps) {
        expect(stepIds.has(s.id), `${tour.id}: passo repetido ${s.id}`).toBe(false)
        stepIds.add(s.id)
        expect(filled(s.body), `${tour.id}/${s.id}: texto`).toBe(true)
        if (s.title) expect(filled(s.title), `${tour.id}/${s.id}: título do passo`).toBe(true)
        if (s.advanceOnClick) expect(s.target, `${tour.id}/${s.id}: advanceOnClick sem alvo`).toBeTruthy()
      }
    }
  })

  it('todo data-help-id citado no catálogo existe no código (o tour não quebra em silêncio)', () => {
    const src = path.join(process.cwd(), 'src')
    const found = new Set<string>()
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '__tests__' || e.name.startsWith('.')) continue
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walk(full)
        else if (/\.(tsx|ts)$/.test(e.name) && !full.includes(`${path.sep}lib${path.sep}platformHelp${path.sep}`)) {
          for (const m of fs.readFileSync(full, 'utf8').matchAll(/data-help-id="([^"]+)"/g)) found.add(m[1])
        }
      }
    }
    walk(src)
    const wanted = new Set<string>()
    for (const tour of PLATFORM_TOURS) for (const s of tour.steps) { if (s.target) wanted.add(s.target); if (s.enterClick) wanted.add(s.enterClick) }
    const missing = [...wanted].filter(id => !found.has(id))
    expect(missing).toEqual([])
  })
})

describe('andamento do tour', () => {
  beforeEach(() => stopPlatformTour())

  it('começa no 1º passo, avança, volta e não sai dos limites', () => {
    const tour = PLATFORM_TOURS[0]
    startPlatformTour(tour)
    expect(getActiveTour()?.index).toBe(0)
    prevStep()
    expect(getActiveTour()?.index).toBe(0)
    nextStep()
    expect(getActiveTour()?.index).toBe(1)
    goToStep(999)
    expect(getActiveTour()?.index).toBe(tour.steps.length - 1)
    nextStep()
    expect(getActiveTour()?.index).toBe(tour.steps.length - 1)
    stopPlatformTour()
    expect(getActiveTour()).toBeNull()
  })
})

describe('demonstração recusa server actions', () => {
  const origin = 'https://app.test'
  it('POST na própria origem com Next-Action é recusado; GET, outra origem e POST comum não', () => {
    expect(isServerActionCall('POST', '/admin/a/b/studio', origin, { 'Next-Action': 'abc' })).toBe(true)
    expect(isServerActionCall('POST', 'https://app.test/x', origin, new Headers({ 'next-action': 'abc' }))).toBe(true)
    expect(isServerActionCall('GET', '/admin/a/b/studio', origin, { 'Next-Action': 'abc' })).toBe(false)
    expect(isServerActionCall('POST', 'https://outra.com/x', origin, { 'Next-Action': 'abc' })).toBe(false)
    expect(isServerActionCall('POST', '/api/tunnel/send', origin, { 'Content-Type': 'application/json' })).toBe(false)
  })
})

describe('passos do assistente que a pessoa precisa usar', () => {
  it('nome, lógica e tabela deixam o item destacado clicável', () => {
    const tour = PLATFORM_TOURS.find(t => t.id === 'studio-criar-caso-de-uso')!
    for (const id of ['name', 'logic', 'tables']) expect(tour.steps.find(s => s.id === id)?.interactive).toBe(true)
  })

  it('os tours do Studio sabem voltar ao ponto de partida', () => {
    for (const id of ['studio-visao-geral', 'studio-criar-caso-de-uso']) expect(PLATFORM_TOURS.find(t => t.id === id)?.recover?.length).toBeGreaterThan(0)
  })
})

describe('passos com condição', () => {
  const tour = () => PLATFORM_TOURS.find(t => t.id === 'studio-criar-caso-de-uso')!
  it('todo passo com condição tem o alvo da condição no código e uma dica de espera nos 3 idiomas', () => {
    const src = path.join(process.cwd(), 'src')
    const found = new Set<string>()
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '__tests__' || e.name.startsWith('.')) continue
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walk(full)
        else if (/\.tsx$/.test(e.name)) for (const m of fs.readFileSync(full, 'utf8').matchAll(/data-help-id="([^"]+)"/g)) found.add(m[1])
      }
    }
    walk(src)
    for (const s of tour().steps) {
      if (!s.completeWhen) continue
      expect(found.has(s.completeWhen.id), `${s.id}: ${s.completeWhen.id}`).toBe(true)
      if (s.completeWhen.check === 'attr') expect(s.completeWhen.attr).toBeTruthy()
      for (const l of ['pt', 'en', 'es'] as const) expect((s.waitingHint as any)?.[l], `${s.id}: dica ${l}`).toBeTruthy()
    }
  })

  it('o assistente só avança com o nome, a lógica, a tabela e os campos cumpridos; o painel de campos vem antes das zonas', () => {
    const ids = tour().steps.map(s => s.id)
    for (const id of ['name', 'logic', 'next1', 'tables', 'next2', 'fill-zones', 'next3']) expect(tour().steps.find(s => s.id === id)?.completeWhen, id).toBeTruthy()
    expect(ids.indexOf('fields-panel')).toBeLessThan(ids.indexOf('zone-filter'))
    expect(ids.indexOf('fill-zones')).toBeLessThan(ids.indexOf('next3'))
    expect(tour().steps.find(s => s.id === 'fill-zones')?.freeInteraction).toBe(true)
  })
})
