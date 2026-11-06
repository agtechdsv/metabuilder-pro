import { describe, it, expect } from 'vitest'
import { filtersFromSearch, NON_FILTER_URL_PARAMS } from '../urlFilters'

describe('filtros vindos da URL', () => {
  it('parâmetros comuns viram filtro', () => {
    expect(filtersFromSearch('?nome_empresa=ACME&status=ativo')).toEqual({ nome_empresa: 'ACME', status: 'ativo' })
  })

  it('parâmetros de controle e do modo demonstração NÃO viram filtro (o erro "coluna mb_demo não existe")', () => {
    expect(filtersFromSearch('?mb_demo=1&mb_seed=abc&preview=draft&embedded=true&nome=Z')).toEqual({ nome: 'Z' })
    for (const k of ['mb_demo', 'mb_seed', 'preview', 'embedded', 'return_to', 'edit_id', 'standalone', 'mode']) expect(NON_FILTER_URL_PARAMS).toContain(k)
  })

  it('URL sem parâmetros não gera filtro', () => {
    expect(filtersFromSearch('')).toEqual({})
  })
})
