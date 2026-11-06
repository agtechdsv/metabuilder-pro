/**
 * Monta os `TourFieldInfo` (o que o gerador automático entende) a partir da configuração de um caso de uso e dos modelos.
 * `layoutConfig` é o `layout_config` do caso de uso; `models` são os modelos do projeto, com `fields`.
 */

import { visibleHelp, normalizeHelp, type HelpText } from '../helpText'
import type { TourFieldInfo } from './autoTour'

export type TourZone = 'form' | 'filter' | 'grid'

const idsOf = (list: unknown): string[] =>
  (Array.isArray(list) ? list : []).map((f: any) => (typeof f === 'string' ? f : f?.id)).filter((x: unknown): x is string => typeof x === 'string' && !!x)

function findModelField(models: any[], fieldId: string): any | undefined {
  for (const m of Array.isArray(models) ? models : []) {
    const f = (m?.fields || []).find((x: any) => x?.id === fieldId)
    if (f) return f
  }
  return undefined
}

export function buildFieldInfos(layoutConfig: any, models: any[], zone: TourZone): TourFieldInfo[] {
  const lc = layoutConfig || {}
  const meta: Record<string, any> = lc.fields_metadata || {}
  const ids = idsOf(lc[`${zone}_fields`])

  const infos = ids.map<TourFieldInfo>(id => {
    const entry = meta[`${zone}-${id}`] ?? meta[id] ?? {}
    const mf = findModelField(models, id)
    const isVirtual = id.startsWith('virt_')
    const label = entry.label?.text || mf?.display_name || mf?.db_column_name || id
    const help = normalizeHelp(visibleHelp(entry.label))
    const hasHelp: HelpText | undefined = Object.keys(help).length ? help : undefined
    return {
      id,
      column: mf?.db_column_name || (isVirtual ? id : label),
      label,
      dataType: mf?.data_type,
      component: entry.component?.type,
      format: entry.content?.format || entry.format,
      required: entry.content?.required === true,
      readOnly: entry.content?.readonly === true || entry.content?.read_only === true || entry.readOnly === true,
      isPrimaryKey: !!mf?.is_primary_key,
      isVirtual,
      hidden: entry.hidden === true || id.startsWith('byoc_'),
      help: hasHelp,
      // no Studio `depends_on` guarda o NOME DA COLUNA do campo pai; aqui vira o id dele
      dependsOn: typeof entry.component?.depends_on === 'string' ? entry.component.depends_on : undefined,
    }
  })

  // depends_on (nome de coluna) → id do campo pai, quando ele está na mesma zona
  const byColumn = new Map(infos.map(i => [i.column, i.id]))
  return infos.map(i => ({ ...i, dependsOn: i.dependsOn ? byColumn.get(i.dependsOn) : undefined }))
}
