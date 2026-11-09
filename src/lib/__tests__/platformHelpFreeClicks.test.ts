import { describe, it, expect } from 'vitest'
import { PLATFORM_TOURS } from '../platformHelp/catalog'

describe('tours de cliques livres', () => {
  const free = PLATFORM_TOURS.filter(t => /\/studio\/(auth|settings|logs|data)$/.test(t.route))

  it('as telas de configuração deixam clicar no item destacado em todos os passos', () => {
    expect(free.length).toBe(22)
    for (const t of free) expect(t.freeClicks, t.id).toBe(true)
  })

  it('o fim dos tours de visão geral destaca o botão de ajuda', () => {
    for (const id of ['auth-visao-geral', 'studio-dados']) {
      const more = PLATFORM_TOURS.find(t => t.id === id)!.steps.find(s => s.id === 'more')
      expect(more?.target, id).toBe('platform.help_button')
    }
  })

  it('passos opcionais da lista de usuários e de grupos são pulados quando não há linha', () => {
    for (const [tour, ids] of [['auth-usuarios', ['group', 'edit', 'delete']], ['auth-grupos', ['edit', 'delete']]] as const) {
      const steps = PLATFORM_TOURS.find(t => t.id === tour)!.steps
      for (const id of ids) expect(steps.find(s => s.id === id)?.skipIfMissing, `${tour}:${id}`).toBe(true)
    }
  })
})

describe('tours das lógicas', () => {
  it('toda lógica do assistente (menos Pesquisa/Cadastro, que é o tour de criar) tem o seu tour, que escolhe exatamente aquela lógica', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('src/components/studio/UseCaseBuilder/steps/StepLogic.tsx', 'utf8')
    const logics = [...src.matchAll(/id: '([a-z_]+)', +title: t\('wizard\.logic\.types\./g)].map(m => m[1]).filter(l => l !== 'pesquisa_cadastro')
    expect(logics.length).toBe(10)
    for (const l of logics) {
      const tour = PLATFORM_TOURS.find(t => t.id === `studio-logica-${l.replace(/_/g, '-')}`)
      expect(tour, l).toBeTruthy()
      const pick = tour!.steps.find(s => s.id === 'pick')
      expect(pick?.completeWhen?.equals, l).toBe(l)
      expect(tour!.steps.some(s => s.id === 'buttons'), l).toBe(true)
    }
  })
})
