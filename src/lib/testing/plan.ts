import type { ManifestField, ManifestView } from './manifestTypes'

/**
 * Plano de testes de um caso de uso: a lista do que será conferido, derivada do manifesto. É a ÚNICA fonte: o painel da IDE mostra este plano
 * antes de rodar e o teste do Playwright (e2e/dynamic) gera exatamente estes testes, com estes nomes. Sem dependências: o e2e também a importa.
 */
export type PlannedKind = 'lista' | 'formulario' | 'mascara' | 'obrigatorios'

export interface PlannedTest {
  kind: PlannedKind
  /** nome do teste (é o nome que o Playwright reporta: o painel casa o resultado por ele) */
  title: string
  /** coluna, quando o teste é de um campo (máscara) */
  field?: string
}

/** Tipos de tela que já têm gabarito de teste. Os demais (kanban, gantt, BI...) entram aqui conforme ganharem o seu. */
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

export function planView(v: ManifestView): PlannedTest[] {
  if (!isSupportedView(v)) return []
  const editaveis = camposEditaveis(v)
  const plano: PlannedTest[] = [
    { kind: 'lista', title: 'lista: os filtros e as colunas do caso de uso estão na tela' },
    { kind: 'formulario', title: 'formulário novo: os campos existem, com obrigatório e somente leitura como configurado' },
    ...editaveis.filter(f => mascaraDePadrao(f.mask)).map((f): PlannedTest => ({ kind: 'mascara', field: f.column, title: `máscara de "${f.label}" (${f.mask}) formata o que se digita` })),
  ]
  if (editaveis.some(f => f.required)) plano.push({ kind: 'obrigatorios', title: 'obrigatórios: salvar o formulário vazio não cria registro' })
  return plano
}
