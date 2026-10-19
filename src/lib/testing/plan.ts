import type { ManifestField, ManifestView } from './manifestTypes'

/**
 * Plano de testes de um caso de uso: a lista do que será conferido, derivada do manifesto. É a ÚNICA fonte: o painel da IDE mostra este plano
 * antes de rodar e o teste do Playwright (e2e/dynamic) gera exatamente estes testes, com estes nomes. Sem dependências: o e2e também a importa.
 *
 * Todas as regras daqui só LEEM dados: nenhuma grava no banco (o cadastro com dados gerados entra depois, junto com o banco de teste do cliente).
 */
export type PlannedKind =
  | 'abre' | 'lista' | 'formulario' | 'mascara' | 'obrigatorios'
  | 'grid_total' | 'grid_ordenacao' | 'grid_filtro' | 'exportacao'

export interface PlannedTest {
  kind: PlannedKind
  /** nome do teste (é o nome que o Playwright reporta: o painel casa o resultado por ele) */
  title: string
  /** coluna, quando o teste é de um campo (máscara, ordenação, filtro) */
  field?: string
  /** formato, quando é de exportação (csv, json, xlsx) */
  format?: string
}

/** Tipos de tela com gabarito COMPLETO (lista, formulário, grid, exportação). Os demais têm só "a tela abre" por enquanto (kanban, gantt, BI... entram aqui). */
export const SUPPORTED_LOGIC_TYPES = ['pesquisa_cadastro']
export const isSupportedView = (v: Pick<ManifestView, 'logicType'>): boolean => SUPPORTED_LOGIC_TYPES.includes(v.logicType)

/** Nome do grupo de testes de um caso de uso (o "describe" do Playwright). */
export const describeName = (v: Pick<ManifestView, 'title' | 'slug' | 'logicType'>): string => `${v.title} (${v.slug}) · ${v.logicType}`

/** Só máscaras de padrão fixo (0 = dígito; . - / ( ) e espaço literais). Máscaras numéricas (0.000,00) têm outra regra e não entram aqui. */
export const mascaraDePadrao = (m?: string): boolean => !!m && /^[0.\-/() ]+$/.test(m) && /0{2}/.test(m) && !/^0\.0+,0+$/.test(m)

/** "00.000.000/0000-00" + dígitos → "11.111.111/1111-11" (cada 0 consome um dígito; o resto é literal). */
export function aplicarMascara(digitos: string, mascara: string): string {
  let out = ''
  let i = 0
  for (const ch of mascara) {
    if (i >= digitos.length) break
    if (ch === '0') out += digitos[i++]
    else out += ch
  }
  return out
}

export const camposEditaveis = (v: Pick<ManifestView, 'form'>): ManifestField[] => v.form.filter(f => !f.isPrimaryKey)

/** Campo de texto livre (serve para ordenar e filtrar por texto): não é lista de opções, nem fórmula, nem chave. */
export const ehTexto = (f: ManifestField): boolean =>
  /char|text|string/i.test(f.dataType) && !f.options?.length && !f.hasFormula && !f.isPrimaryKey && !/select|sele[cç][aã]o|autocomplete/i.test(f.componentType || '')

/** Campo de data/hora: o app usa o seletor nativo de data e a máscara de texto não se aplica (o tipo do componente no Studio manda sobre a máscara). */
export const ehData = (f: ManifestField): boolean => /date|time/i.test(f.dataType) || /data|date|hora/i.test(f.componentType || '')

export const FORMATOS_EXPORTACAO: Record<string, string> = { csv: 'CSV', json: 'JSON', xlsx: 'Excel' }

/** A tela e os campos usados em cada regra de grid (a mesma escolha vale para o plano e para o teste). */
export const campoDeOrdenacao = (v: Pick<ManifestView, 'grid'>): ManifestField | undefined => v.grid.find(ehTexto)
/** O filtro precisa estar também no grid: é pelas células do grid que o teste confere que as linhas casam com o filtro. */
export const campoDeFiltro = (v: Pick<ManifestView, 'filter' | 'grid'>): ManifestField | undefined =>
  v.filter.find(f => ehTexto(f) && v.grid.some(g => g.column === f.column))

export function planView(v: ManifestView): PlannedTest[] {
  const plano: PlannedTest[] = [{ kind: 'abre', title: 'a tela abre sem erro e mostra o título do caso de uso' }]
  if (!isSupportedView(v)) return plano

  const editaveis = camposEditaveis(v)
  plano.push(
    { kind: 'lista', title: 'lista: os filtros e as colunas do caso de uso estão na tela' },
    { kind: 'formulario', title: 'formulário novo: os campos existem, com obrigatório e somente leitura como configurado' },
  )
  for (const f of editaveis.filter(x => mascaraDePadrao(x.mask) && !ehData(x))) plano.push({ kind: 'mascara', field: f.column, title: `máscara de "${f.label}" (${f.mask}) formata o que se digita` })
  if (editaveis.some(f => f.required)) plano.push({ kind: 'obrigatorios', title: 'obrigatórios: salvar o formulário vazio não cria registro' })

  plano.push({ kind: 'grid_total', title: 'grid: o total mostrado é igual ao total do banco' })
  const ord = campoDeOrdenacao(v)
  if (ord) plano.push({ kind: 'grid_ordenacao', field: ord.column, title: `grid: ordenar por "${ord.label}" nos dois sentidos` })
  const fil = campoDeFiltro(v)
  if (fil) plano.push({ kind: 'grid_filtro', field: fil.column, title: `filtro de "${fil.label}": filtra as linhas e o botão Limpar desfaz` })

  const descr: Record<string, string> = {
    csv: 'cabeçalho com as colunas do grid e uma linha por registro',
    json: 'um item por registro',
    xlsx: 'arquivo .xlsx válido',
  }
  for (const fmt of v.exportFormats.map(x => x.toLowerCase()).filter(x => FORMATOS_EXPORTACAO[x])) {
    plano.push({ kind: 'exportacao', format: fmt, title: `exportação ${FORMATOS_EXPORTACAO[fmt]}: ${descr[fmt]}` })
  }
  return plano
}
