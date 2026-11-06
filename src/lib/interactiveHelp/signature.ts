/**
 * Assinatura da configuração que um roteiro da Ajuda Interativa usa: a camada BARATA da detecção de "desatualizado".
 *
 * É calculada só a partir do `layout_config` do caso de uso (que a lista de casos de uso já tem carregado), sem consultar o banco.
 * Guardada ao gerar o roteiro (`Tour.sourceSig`) e comparada depois com a de agora: diferente = "pode estar desatualizado".
 * Como é derivada da configuração, e não de um evento de gravação, nenhum caminho que altere o caso de uso consegue "esquecer" de avisar.
 *
 * Cada ação observa só as zonas que usa (cadastrar não liga para o filtro), e só o que importa para o roteiro: quais campos, em que ordem,
 * rótulo, obrigatório, componente, somente leitura, oculto e dependência. Ajuda do campo (a legenda é ao vivo), cores e estilos ficam de fora.
 * A comparação exata (com os dados do banco) continua existindo dentro da Central de Ajuda.
 */

import { normalizeInteractiveHelp, type Tour, type TourAction } from './types'

type Zone = 'form' | 'filter' | 'grid'

/** Zonas que cada ação observa (editar, ver, excluir e pesquisar também leem o grid, que forma a linha de exemplo). */
const ZONES_BY_ACTION: Record<TourAction, Zone[]> = {
  create: ['form'],
  edit: ['form', 'grid'],
  view: ['form', 'grid'],
  delete: ['form', 'grid'],
  search: ['filter', 'form', 'grid'],
  move: ['grid'],
}

const idsOf = (list: unknown): string[] =>
  (Array.isArray(list) ? list : []).map((f: any) => (typeof f === 'string' ? f : f?.id)).filter((x: unknown): x is string => typeof x === 'string' && !!x)

/** FNV-1a de 32 bits em hexadecimal: curto, estável e suficiente para comparar (não é segurança). */
function fnv1a(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function layoutSignature(layoutConfig: any, action: TourAction, screenName?: string): string {
  const lc = layoutConfig || {}
  const meta: Record<string, any> = lc.fields_metadata || {}
  const zones = ZONES_BY_ACTION[action].map(zone => [
    zone,
    idsOf(lc[`${zone}_fields`]).map(id => {
      const e = meta[`${zone}-${id}`] ?? meta[id] ?? {}
      return [
        id,
        e.label?.text || '',
        e.content?.required === true,
        e.component?.type || '',
        e.content?.readonly === true || e.content?.read_only === true || e.readOnly === true,
        e.hidden === true,
        typeof e.component?.depends_on === 'string' ? e.component.depends_on : '',
      ]
    }),
  ])
  return fnv1a(JSON.stringify({ name: screenName || '', zones }))
}

/**
 * O roteiro "pode estar desatualizado"? Sem assinatura guardada (roteiro de antes deste recurso) conta como sim: ele também ainda tem
 * a legenda copiada da ajuda, então vale regenerar uma vez.
 */
export function isLikelyStale(tour: Tour, layoutConfig: any, screenName?: string): boolean {
  if (!tour.sourceSig) return true
  return layoutSignature(layoutConfig, tour.action, screenName) !== tour.sourceSig
}

/** Algum roteiro deste caso de uso (inclusive os ocultos) pode estar desatualizado? Só vale se o caso de uso tem roteiros. */
export function hasLikelyStaleTours(layoutConfig: any, screenName?: string): boolean {
  const cfg = normalizeInteractiveHelp(layoutConfig?.interactive_help)
  return cfg.tours.some(t => isLikelyStale(t, layoutConfig, screenName))
}
