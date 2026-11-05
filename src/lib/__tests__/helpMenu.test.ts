import { describe, it, expect } from 'vitest'
import { withHelpCenterMenu, collectHelpCenter, setHelpHidden } from '../helpText'

const nav = [{ id: 'a', label: 'Clientes', type: 'view', target: 'clientes' }]
const helpItem = { id: 'h', label: 'Ajuda', type: 'view', target: 'help' }

describe('item Central de Ajuda no menu', () => {
  it('com ajuda visível entra no fim do menu, no idioma do usuário', () => {
    const out = withHelpCenterMenu(nav, true, 'en')
    expect(out).toHaveLength(2)
    expect(out[1]).toMatchObject({ type: 'view', target: 'help', label: 'Help Center' })
    expect(withHelpCenterMenu(nav, true, 'xx')[1].label).toBe('Central de Ajuda')
    expect(nav).toHaveLength(1) // não altera o original
  })

  it('se o dev já pôs o item em Navegação, não duplica nem muda a posição', () => {
    const custom = [helpItem, ...nav]
    expect(withHelpCenterMenu(custom, true, 'pt')).toBe(custom)
  })

  it('sem nenhuma ajuda visível o item some, mesmo posto à mão (inclusive dentro de pasta)', () => {
    expect(withHelpCenterMenu([...nav, helpItem], false)).toEqual(nav)
    const folder = [{ id: 'f', type: 'folder', label: 'Ajuda', children: [helpItem] }]
    expect(withHelpCenterMenu(folder, false)).toEqual([{ id: 'f', type: 'folder', label: 'Ajuda', children: [] }])
    expect(withHelpCenterMenu(nav, false)).toBe(nav)
  })

  it('acompanha o "ocultar": tudo oculto = sem menu; um visível = com menu', () => {
    const view = (meta: any, hiddenScreen = false) => ({
      id: 'v', slug: 's', name: 'T',
      layout_config: { form_fields: ['a', 'b'], fields_metadata: meta, screen_help_hidden: hiddenScreen || undefined },
    })
    const meta = { a: { label: { help: { pt: 'A' } } }, b: { label: { help: { pt: 'B' } } } }
    expect(collectHelpCenter([view(meta)], 'pt').length > 0).toBe(true)

    let hidden: Record<string, any> = setHelpHidden(meta, 'a', 'form', true)
    expect(collectHelpCenter([view(hidden)], 'pt').length > 0).toBe(true) // b ainda aparece
    hidden = setHelpHidden(hidden, 'b', 'form', true)
    expect(collectHelpCenter([view(hidden)], 'pt').length > 0).toBe(false)
    expect(withHelpCenterMenu(nav, collectHelpCenter([view(hidden)], 'pt').length > 0)).toBe(nav)
  })
})

describe('Central lista a ajuda de qualquer zona', () => {
  const view = (lc: any) => ({ id: 'v', slug: 's', name: 'T', layout_config: lc })

  it('campo só no filtro entra, e o menu aparece por causa dele', () => {
    const lc = { filter_fields: ['n'], form_fields: [], fields_metadata: { n: { label: { text: 'Nome', help: { pt: 'filtro' } } } } }
    const [entry] = collectHelpCenter([view(lc)], 'pt')
    expect(entry.fields).toEqual([{ id: 'n', label: 'Nome', text: 'filtro' }])
  })

  it('formulário tem prioridade; se ele está oculto, usa a zona visível seguinte', () => {
    let meta: Record<string, any> = { a: { label: { text: 'A', help: { pt: 'padrão' } } } }
    const lc = (m: any) => ({ form_fields: ['a'], grid_fields: ['a'], fields_metadata: m })
    expect(collectHelpCenter([view(lc(meta))], 'pt')[0].fields[0].text).toBe('padrão')
    meta = setHelpHidden(meta, 'a', 'form', true)
    expect(collectHelpCenter([view(lc(meta))], 'pt')[0].fields[0].text).toBe('padrão') // ainda visível no grid
    meta = setHelpHidden(meta, 'a', 'grid', true)
    expect(collectHelpCenter([view(lc(meta))], 'pt')).toEqual([])
  })
})
