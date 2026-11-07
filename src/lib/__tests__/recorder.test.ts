import { describe, expect, it } from 'vitest'
import { applyEvent, finishRecording, targetFromNode, type RecEvent, type RecNode, type RecState } from '../interactiveHelp/recorder'

const node = (attrs: Record<string, string> = {}, extra: Partial<RecNode> & { text?: string } = {}, parent: RecNode | null = null): RecNode => ({
  tagName: extra.tagName,
  getAttribute: (n: string) => attrs[n] ?? null,
  parentElement: parent,
  textContent: extra.text ?? null,
})

const run = (events: RecEvent[]) => {
  let state: RecState = {}
  const steps: any[] = []
  for (const ev of events) { const r = applyEvent(state, ev); state = r.state; steps.push(...r.steps) }
  steps.push(...finishRecording(state))
  return steps
}
const shape = (steps: any[]) => steps.map(s => `${s.kind}:${s.target?.type}:${s.target?.ref}${typeof s.value === 'string' ? '=' + s.value : ''}`)

describe('targetFromNode', () => {
  it('elemento marcado vira o alvo que o player sabe achar', () => {
    expect(targetFromNode(node({ 'data-tour': 'save' }))?.target).toEqual({ type: 'button', ref: 'save' })
    expect(targetFromNode(node({ 'data-tour': 'row-edit' }))?.target).toEqual({ type: 'row', ref: 'first', action: 'edit' })
    expect(targetFromNode(node({ 'data-tour-field': 'abc' }))?.target).toEqual({ type: 'field', ref: 'abc' })
    expect(targetFromNode(node({ 'data-tour-filter': 'f1' }))?.target).toEqual({ type: 'filter', ref: 'f1' })
    expect(targetFromNode(node({ 'data-tour-detail': 'm1' }))?.target).toEqual({ type: 'tab', ref: 'm1' })
    expect(targetFromNode(node({ 'data-tour-add': 'm1' }))?.target).toEqual({ type: 'detail-add', ref: 'm1' })
    expect(targetFromNode(node({ 'data-tour-expand': 'm1' }))?.target).toEqual({ type: 'detail-expand', ref: 'm1' })
  })

  it('clicar num ícone dentro do botão marcado acha o botão (sobe pelos ancestrais)', () => {
    const btn = node({ 'data-tour': 'new', title: 'Novo Registro' })
    const icon = node({}, { tagName: 'svg' }, btn)
    expect(targetFromNode(icon)).toEqual({ target: { type: 'button', ref: 'new' }, label: 'Novo Registro' })
  })

  it('sem marca: botão, link ou aba pelo texto visível; nada clicável = nada', () => {
    const b = node({}, { tagName: 'BUTTON', text: '  Exportar   dados ' })
    expect(targetFromNode(b)?.target).toEqual({ type: 'text', ref: 'Exportar dados' })
    expect(targetFromNode(node({ role: 'tab', title: 'Resumo' }))?.target).toEqual({ type: 'text', ref: 'Resumo' })
    expect(targetFromNode(node({}, { tagName: 'DIV', text: 'solto' }))).toBeNull()
  })
})

describe('applyEvent: eventos viram passos', () => {
  const nome = node({ 'data-tour-field': 'nome' })
  const cidade = node({ 'data-tour-field': 'cidade' })
  const save = node({ 'data-tour': 'save', title: 'Salvar' }, { tagName: 'BUTTON' })
  const novo = node({ 'data-tour': 'new' }, { tagName: 'BUTTON', text: 'Novo Registro' })

  it('digitar várias letras vira UM passo com o valor final, antes do clique seguinte', () => {
    const steps = run([
      { kind: 'click', node: novo },
      { kind: 'input', node: nome, value: 'M', label: 'Nome' },
      { kind: 'input', node: nome, value: 'Ma', label: 'Nome' },
      { kind: 'input', node: nome, value: 'Maria', label: 'Nome' },
      { kind: 'click', node: save },
    ])
    expect(shape(steps)).toEqual(['click:button:new', 'type:field:nome=Maria', 'click:button:save'])
    expect(steps[1].liveCaption).toBe(true)
    expect(steps.every(s => s.auto === false)).toBe(true)
  })

  it('trocar de campo fecha o anterior; o commit também fecha', () => {
    const steps = run([
      { kind: 'input', node: nome, value: 'Ana' },
      { kind: 'input', node: cidade, value: 'Rio' },
      { kind: 'commit', node: cidade, value: 'Rio' },
    ])
    expect(shape(steps)).toEqual(['type:field:nome=Ana', 'type:field:cidade=Rio'])
  })

  it('lista, marcação e autocomplete', () => {
    const steps = run([
      { kind: 'select', node: node({ 'data-tour-field': 'status' }), optionText: 'Aprovado', label: 'Status' },
      { kind: 'check', node: node({ 'data-tour-field': 'ativo' }), checked: true },
      { kind: 'check', node: node({ 'data-tour-field': 'ativo2' }), checked: false },
      { kind: 'input', node: node({ 'data-tour-field': 'produto' }), value: 'cane', autocomplete: true },
      { kind: 'option', node: node({ 'data-tour-field': 'produto' }), term: 'cane', label: 'Produto' },
    ])
    expect(shape(steps)).toEqual(['select:field:status=Aprovado', 'check:field:ativo', 'select:field:produto=cane'])
  })

  it('clicar num campo (só foco) ou num controle de formulário não vira passo', () => {
    expect(run([{ kind: 'click', node: nome }, { kind: 'click', node: node({}, { tagName: 'INPUT' }) }, { kind: 'click', node: node({}, { tagName: 'DIV' }) }])).toEqual([])
  })

  it('campo vazio não vira passo', () => {
    expect(run([{ kind: 'input', node: nome, value: '' }, { kind: 'commit', node: nome, value: '' }])).toEqual([])
  })
})
