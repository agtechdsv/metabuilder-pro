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
    expect(ids('/admin/w/p/studio/logs')).toEqual(['logs-configurar', 'logs-filtrar', 'logs-ler-registro'])
    expect(ids('/admin/w/p/studio/settings')).toEqual(['settings-visao-geral', 'settings-defaults-campos', 'settings-propagar-defaults', 'settings-campos-calculados'])
    expect(ids('/admin/w/p/studio/auth')).toEqual(['auth-visao-geral', 'auth-controle-acesso', 'auth-estrategia-managed', 'auth-estrategia-banco-legado', 'auth-estrategia-ldap', 'auth-estrategia-sem-login', 'auth-personalizacao-visual', 'auth-usuarios', 'auth-grupos', 'auth-permissoes-telas'])
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
          { const text = fs.readFileSync(full, 'utf8'); for (const m of text.matchAll(/data-help-id="([^"]+)"/g)) found.add(m[1]); for (const m of text.matchAll(/data-help-id=\{[^}]*?'([^']+)'/g)) found.add(m[1]) }
        }
      }
    }
    walk(src)
    const wanted = new Set<string>()
    for (const tour of PLATFORM_TOURS) for (const s of tour.steps) { if (s.target) wanted.add(s.target); if (s.enterClick) wanted.add(s.enterClick); if (s.alsoTarget) wanted.add(s.alsoTarget); if (s.backClick) wanted.add(s.backClick) }
    for (const tour of PLATFORM_TOURS) if (tour.needs) wanted.add(tour.needs)
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

  it('os passos do detalhe (mestre + detalhe) ficam entre o preenchimento das zonas e o próximo passo, e são pulados se não há detalhe', () => {
    const tour = PLATFORM_TOURS.find(t => t.id === 'studio-criar-caso-de-uso')!
    const ids = tour.steps.map(s => s.id)
    expect(ids.indexOf('detail-expand')).toBeGreaterThan(ids.indexOf('fill-zones'))
    expect(ids.indexOf('detail-fill')).toBeGreaterThan(ids.indexOf('detail-expand'))
    expect(ids.indexOf('detail-fill')).toBeLessThan(ids.indexOf('next3'))
    for (const id of ['detail-expand', 'detail-fill']) expect(tour.steps.find(s => s.id === id)?.skipIfMissing, id).toBe(true)
  })

  it('depois de criar o caso de uso não dá para voltar, e os passos de ações finais deixam a pessoa usar o item', () => {
    const tour = PLATFORM_TOURS.find(t => t.id === 'studio-criar-caso-de-uso')!
    for (const id of ['draft', 'publish', 'publish-confirm', 'open-published']) expect(tour.steps.find(s => s.id === id)?.noBack, id).toBe(true)
    for (const id of ['buttons', 'interface', 'export', 'query']) expect(tour.steps.find(s => s.id === id)?.interactive, id).toBe(true)
  })

  it('o primeiro passo de cada etapa do assistente volta o próprio assistente, e a profundidade vem antes da tabela', () => {
    const tour = PLATFORM_TOURS.find(t => t.id === 'studio-criar-caso-de-uso')!
    const by = (id: string) => tour.steps.find(s => s.id === id)
    expect(by('stepper')?.backClick).toBe('wizard.back')
    for (const id of ['depth', 'fields-panel', 'buttons']) expect(by(id)?.backClick, id).toBe('wizard.prev')
    const ids = tour.steps.map(s => s.id)
    expect(ids.indexOf('depth')).toBeLessThan(ids.indexOf('tables'))
    expect(ids.indexOf('tables')).toBeLessThan(ids.indexOf('next2'))
  })

  it('o tour aberto com o assistente já na tela começa na etapa em que a pessoa está', () => {
    const tour = PLATFORM_TOURS.find(t => t.id === 'studio-criar-caso-de-uso')!
    const ids = tour.steps.map(s => s.id)
    const got = Object.fromEntries((tour.entry || []).map(e => [e.rule.equals, e.step]))
    expect(got).toEqual({ '1': 'stepper', '2': 'depth', '3': 'fields-panel', '4': 'buttons' })
    for (const e of tour.entry || []) expect(ids.includes(e.step), e.step).toBe(true)
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
        else if (/\.tsx$/.test(e.name)) { const text = fs.readFileSync(full, 'utf8'); for (const m of text.matchAll(/data-help-id="([^"]+)"/g)) found.add(m[1]); for (const m of text.matchAll(/data-help-id=\{[^}]*?'([^']+)'/g)) found.add(m[1]) }
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

describe('todos os tours (Studio, Login, Configurações, Logs)', () => {
  const found = new Set<string>()
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '__tests__' || e.name.startsWith('.')) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.tsx$/.test(e.name)) { const text = fs.readFileSync(full, 'utf8'); for (const m of text.matchAll(/data-help-id="([^"]+)"/g)) found.add(m[1]); for (const m of text.matchAll(/data-help-id=\{[^}]*?'([^']+)'/g)) found.add(m[1]) }
    }
  }
  walk(path.join(process.cwd(), 'src'))
  const langs = ['pt', 'en', 'es'] as const
  const filled = (t: any) => langs.every(l => typeof t?.[l] === 'string' && t[l].trim().length > 0)

  it('toda condição (completeWhen) de qualquer tour aponta para algo que existe e tem dica nos 3 idiomas', () => {
    for (const tour of PLATFORM_TOURS) for (const s of tour.steps) {
      if (!s.completeWhen) continue
      expect(found.has(s.completeWhen.id), `${tour.id}/${s.id}: ${s.completeWhen.id}`).toBe(true)
      if (s.completeWhen.check === 'attr') expect(s.completeWhen.attr, `${tour.id}/${s.id}`).toBeTruthy()
      expect(filled(s.waitingHint), `${tour.id}/${s.id}: dica de espera`).toBe(true)
    }
  })

  it('passo opcional (skipIfMissing) e passo que clica (advanceOnClick) sempre têm alvo; backClick e enterClick existem na tela', () => {
    for (const tour of PLATFORM_TOURS) for (const s of tour.steps) {
      if (s.skipIfMissing || s.advanceOnClick) expect(s.target, `${tour.id}/${s.id}`).toBeTruthy()
      for (const id of [s.backClick, s.enterClick].filter(Boolean) as string[]) expect(found.has(id), `${tour.id}/${s.id}: ${id}`).toBe(true)
    }
  })

  it('os tours de Login, Configurações e Logs são ricos: vários tours por tela e muitos passos', () => {
    const count = (prefix: string) => PLATFORM_TOURS.filter(t => t.id.startsWith(prefix))
    expect(count('auth-').length).toBeGreaterThanOrEqual(8)
    expect(count('settings-').length).toBeGreaterThanOrEqual(4)
    expect(count('logs-').length).toBeGreaterThanOrEqual(3)
    for (const prefix of ['auth-', 'settings-', 'logs-']) expect(count(prefix).reduce((n, t) => n + t.steps.length, 0), prefix).toBeGreaterThanOrEqual(15)
  })

  it('cada estratégia de login tem seu tour e ele só segue depois da pessoa escolher o cartão certo', () => {
    for (const [id, kind] of [['auth-estrategia-managed', 'managed'], ['auth-estrategia-banco-legado', 'database'], ['auth-estrategia-ldap', 'ldap'], ['auth-estrategia-sem-login', 'none']] as const) {
      const first = PLATFORM_TOURS.find(t => t.id === id)!.steps[0]
      expect(first.completeWhen?.equals, id).toBe(kind)
      expect(first.interactive, id).toBe(true)
    }
  })
})
