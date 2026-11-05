import { describe, it, expect } from 'vitest'
import { mergeHelpIntoLayout, patchComponentHelp, draftLayoutOf } from '../helpPatch'
import { setFieldHelp, setZoneHelp, setHelpHidden, isHelpHidden, visibleHelp, collectHelpCenter } from '../helpText'

describe('ocultar ajuda', () => {
  it('visibleHelp devolve o texto, ou nada quando oculto', () => {
    expect(visibleHelp({ help: { pt: 'a' } })).toEqual({ pt: 'a' })
    expect(visibleHelp({ help: { pt: 'a' }, help_hidden: true })).toBeUndefined()
    expect(visibleHelp(undefined)).toBeUndefined()
  })

  it('oculta por zona, mantém o texto e volta a mostrar', () => {
    let meta: Record<string, any> = setFieldHelp({ 'grid-f': { label: { text: 'F' } } }, 'f', { pt: 'texto' })
    meta = setHelpHidden(meta, 'f', 'grid', true)
    expect(isHelpHidden(meta, 'f', 'grid')).toBe(true)
    expect(isHelpHidden(meta, 'f', 'form')).toBe(false)
    expect(meta['grid-f'].label.help).toEqual({ pt: 'texto' })
    meta = setHelpHidden(meta, 'f', 'grid', false)
    expect(isHelpHidden(meta, 'f', 'grid')).toBe(false)
    expect(meta['grid-f'].label.help).toEqual({ pt: 'texto' })
  })

  it('ocultar numa zona sem chave cria a chave a partir da base e preserva o rótulo', () => {
    const base = { f: { label: { text: 'Nome', help: { pt: 'x' } }, component: { type: 'text' } } }
    const meta = setHelpHidden(base, 'f', 'filter', true)
    expect(meta['filter-f'].label).toMatchObject({ text: 'Nome', help: { pt: 'x' }, help_hidden: true })
    expect(isHelpHidden(meta, 'f', 'grid')).toBe(false)
    // desfazer numa zona sem chave não cria nada
    expect(Object.keys(setHelpHidden(base, 'f', 'grid', false))).toEqual(['f'])
  })

  it('editar o texto padrão não desfaz o "ocultar" da zona', () => {
    let meta = setHelpHidden({ f: { label: { help: { pt: 'a' } } } }, 'f', 'grid', true)
    meta = setFieldHelp(meta, 'f', { pt: 'novo' })
    expect(isHelpHidden(meta, 'f', 'grid')).toBe(true)
    expect(meta['grid-f'].label.help).toEqual({ pt: 'novo' })
  })

  it('a Central não lista ajuda oculta (campo no formulário nem a da tela)', () => {
    const views = [{
      id: 'v', slug: 's', name: 'Tela',
      layout_config: {
        screen_help: { pt: 'tela' }, form_fields: ['a', 'b'],
        fields_metadata: { a: { label: { help: { pt: 'A' } } }, 'form-b': { label: { help: { pt: 'B' }, help_hidden: true } } },
      },
    }]
    const [entry] = collectHelpCenter(views, 'pt')
    expect(entry.fields.map(f => f.id)).toEqual(['a'])
    const hiddenScreen = collectHelpCenter([{ ...views[0], layout_config: { ...views[0].layout_config, screen_help_hidden: true } }], 'pt')
    expect(hiddenScreen[0].screen).toBe('')
  })
})

describe('gravar só a ajuda', () => {
  const published = {
    items_per_page: 50, screen_help: { pt: 'velha' },
    fields_metadata: { f: { label: { text: 'F', help: { pt: 'velha' } }, component: { type: 'text' } } },
  }

  it('copia a ajuda para o destino e não mexe em mais nada', () => {
    const edited = { ...published, items_per_page: 999, screen_help: { pt: 'nova' }, screen_help_hidden: true,
      fields_metadata: setFieldHelp(published.fields_metadata, 'f', { pt: 'nova' }) }
    const out = mergeHelpIntoLayout(published, edited)
    expect(out.items_per_page).toBe(50)
    expect(out.screen_help).toEqual({ pt: 'nova' })
    expect(out.screen_help_hidden).toBe(true)
    expect(out.fields_metadata.f.label).toMatchObject({ text: 'F', help: { pt: 'nova' } })
    expect(published.screen_help).toEqual({ pt: 'velha' }) // original intacto
  })

  it('apagar o texto na edição tira só o help, e o rascunho mantém o que só ele tem', () => {
    const draft = { fields_metadata: { f: { label: { text: 'F', help: { pt: 'x' } } }, novo: { label: { text: 'Novo', help: { pt: 'só no rascunho' } } } } }
    const edited = { fields_metadata: setFieldHelp(published.fields_metadata, 'f', {}) }
    const out = mergeHelpIntoLayout(draft, edited)
    expect(out.fields_metadata.f.label.help).toBeUndefined()
    expect(out.fields_metadata.f.label.text).toBe('F')
    expect(out.fields_metadata.novo.label.help).toEqual({ pt: 'só no rascunho' })
  })

  it('draftLayoutOf entende rascunho do Studio e rascunho de IA', () => {
    expect(draftLayoutOf(null)).toBeNull()
    expect(draftLayoutOf({ layout_config: { a: 1 } })).toEqual({ a: 1 })
    const ai = { generated_by_ai: true, x: 1 }
    expect(draftLayoutOf(ai)).toBe(ai)
    expect(draftLayoutOf({ name: 'sem layout' })).toBeNull()
  })

  it('atualiza a ajuda de cada zona do componente publicado', () => {
    let meta: Record<string, any> = setFieldHelp({ 'grid-f': { label: { text: 'F' } }, 'form-f': { label: { text: 'F' } } }, 'f', { pt: 'padrão' })
    meta = setZoneHelp(meta, 'f', 'grid', { pt: 'só no grid' })
    meta = setHelpHidden(meta, 'f', 'form', true)
    const config = { zones: ['grid', 'form'], grid_config: { label: { text: 'F' }, component: { type: 'text' } }, form_config: { label: { text: 'F' } }, label: { text: 'F' } }
    const out = patchComponentHelp(config, meta, 'f')
    expect(out.grid_config.label).toMatchObject({ text: 'F', help: { pt: 'só no grid' }, help_custom: true })
    expect(out.form_config.label).toMatchObject({ help: { pt: 'padrão' }, help_hidden: true })
    expect(out.grid_config.component).toEqual({ type: 'text' })
    // sem mudança, devolve o mesmo objeto
    expect(patchComponentHelp(out, meta, 'f')).toBe(out)
  })
})
