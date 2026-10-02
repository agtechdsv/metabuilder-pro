/**
 * Resolução de chave primária, chave estrangeira e título de registro a partir dos METADADOS do projeto
 * (modelos, campos, relações). Nenhum nome de tabela/coluna de negócio é assumido.
 *
 * Ordem de decisão: metadado declarado (relação / join do caso de uso / foreign_key_table) → só então, como ÚLTIMO
 * recurso, um palpite por nome (`tabela_id`), sempre sinalizado com console.warn para o desenvolvedor declarar a relação.
 */

const eq = (a?: string | null, b?: string | null) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase()
const colOf = (c?: string | null) => (c || '').split('.').pop() || ''
const tableOf = (m: any): string => m?.db_table_name ?? m?.table_name ?? ''

export function findModelByTable(models: any[] | undefined | null, table?: string | null): any | null {
  if (!table) return null
  return (models || []).find((m: any) => eq(tableOf(m), table)) || null
}

/** Campo de chave primária de um modelo: marcado como PK > coluna chamada "id" (convenção) > primeira coluna. */
export function pickPkField(model: any): any | null {
  const fields: any[] = model?.fields || []
  return fields.find((f) => f?.is_primary_key) || fields.find((f) => eq(colOf(f?.db_column_name), 'id')) || fields[0] || null
}

/** Nome da coluna de chave primária da tabela (metadado), ou null se a tabela não for conhecida. */
export function getPkColumn(models: any[] | undefined | null, table?: string | null): string | null {
  const field = pickPkField(findModelByTable(models, table))
  const col = colOf(field?.db_column_name)
  return col || null
}

/** Lê uma chave do registro ignorando maiúsculas/minúsculas (Oracle devolve colunas em CAIXA ALTA). */
export function readCol(record: any, column?: string | null): any {
  if (!record || !column) return undefined
  if (record[column] !== undefined) return record[column]
  const lower = column.toLowerCase()
  const found = Object.keys(record).find((k) => k.toLowerCase() === lower)
  return found !== undefined ? record[found] : undefined
}

/**
 * Valor da chave primária de um registro. Usa a coluna informada (do metadado); só sem ela cai na convenção id/ID.
 * Quando a coluna é informada e o registro não a tem, devolve undefined (não "inventa" outro campo).
 */
export function getRecordPk(record: any, pkColumn?: string | null): any {
  if (!record) return undefined
  if (pkColumn) {
    const v = readCol(record, pkColumn)
    if (v !== undefined && v !== null) return v
    // linhas novas criadas na tela usam "id" temporário (convenção do botão "+")
    if (record._isNew) return record.id ?? record.ID
    return undefined
  }
  return record.id ?? record.ID
}

export type FkSource = 'relation' | 'join' | 'metadata' | 'name-guess' | 'none'

export interface FkResolution {
  column: string | null
  source: FkSource
  /** Mais de uma coluna candidata no mesmo nível de decisão (ex.: duas FKs entre as mesmas tabelas). */
  ambiguous: boolean
  candidates: string[]
}

interface ResolveFkArgs {
  models?: any[] | null
  relations?: any[] | null
  joins?: any[] | null
  childTable?: string | null
  parentTable?: string | null
}

const uniq = (list: string[]) => Array.from(new Set(list.filter(Boolean)))

/**
 * Coluna da tabela FILHA que aponta para a tabela PAI.
 * 1) relação declarada no projeto  2) join configurado no caso de uso  3) campo da filha com foreign_key_table = pai
 * 4) (último recurso) palpite por nome — sinalizado como 'name-guess'.
 */
export function resolveFkColumn({ models, relations, joins, childTable, parentTable }: ResolveFkArgs): FkResolution {
  const child = findModelByTable(models, childTable)
  const parent = findModelByTable(models, parentTable)

  // 1) Relações declaradas
  if (child && parent && relations && relations.length > 0) {
    const cols: string[] = []
    for (const r of relations) {
      const fromId = r.from_model_id ?? r.detail_model_id
      const toId = r.to_model_id ?? r.master_model_id
      if (String(fromId) === String(child.id) && String(toId) === String(parent.id)) {
        const f = child.fields?.find((x: any) => String(x.id) === String(r.from_field_id ?? r.foreign_column_id))
        if (f) cols.push(colOf(f.db_column_name))
      } else if (String(toId) === String(child.id) && String(fromId) === String(parent.id)) {
        // relação gravada no sentido inverso (pai → filho): a FK está no campo "to" da filha
        const f = child.fields?.find((x: any) => String(x.id) === String(r.to_field_id ?? r.referenced_column_id))
        if (f) cols.push(colOf(f.db_column_name))
      }
    }
    const list = uniq(cols)
    if (list.length > 0) return { column: list[0], source: 'relation', ambiguous: list.length > 1, candidates: list }
  }

  // 2) Join configurado no caso de uso
  if (joins && joins.length > 0) {
    const matches = joins.filter((j: any) => eq(j.to ?? j.toTable ?? j.table, childTable) && eq(j.from ?? j.table, parentTable))
    const list = uniq(matches.map((j: any) => colOf(j.foreignKey ?? j.foreign_field ?? j.toOn ?? j.on)))
    if (list.length > 0) return { column: list[0], source: 'join', ambiguous: list.length > 1, candidates: list }
  }

  // 3) Metadado do campo (foreign_key_table)
  if (child && parentTable) {
    const list = uniq(
      (child.fields || [])
        .filter((f: any) => eq(f.foreign_key_table, parentTable))
        .map((f: any) => colOf(f.db_column_name))
    )
    if (list.length > 0) return { column: list[0], source: 'metadata', ambiguous: list.length > 1, candidates: list }
  }

  // 4) Último recurso: palpite por nome
  if (child && parentTable) {
    const p = parentTable.toLowerCase()
    const singular = p.endsWith('es') ? p.slice(0, -2) : p.endsWith('s') ? p.slice(0, -1) : p
    const list = uniq(
      (child.fields || [])
        .map((f: any) => colOf(f.db_column_name))
        .filter((c: string) => {
          const lc = c.toLowerCase()
          return lc === `${p}_id` || lc === `${singular}_id` || (lc.includes(singular) && lc.endsWith('_id'))
        })
    )
    if (list.length > 0) return { column: list[0], source: 'name-guess', ambiguous: list.length > 1, candidates: list }
  }

  return { column: null, source: 'none', ambiguous: false, candidates: [] }
}

const warned = new Set<string>()

/** Avisa (uma vez por par) quando a relação foi inferida pelo nome ou é ambígua, para o dev declará-la no Studio. */
export function warnFkResolution(res: FkResolution, childTable?: string | null, parentTable?: string | null): void {
  if (res.source !== 'name-guess' && !res.ambiguous) return
  const key = `${childTable}|${parentTable}|${res.source}|${res.candidates.join(',')}`
  if (warned.has(key)) return
  warned.add(key)
  if (res.source === 'name-guess') {
    console.warn(
      `[MetaBuilder] A relação entre "${parentTable}" e "${childTable}" foi INFERIDA pelo nome da coluna ("${res.column}"). ` +
      `Declare a relação no Studio para não depender de convenção de nomes.`
    )
  } else {
    console.warn(
      `[MetaBuilder] Mais de uma relação entre "${parentTable}" e "${childTable}" (${res.candidates.join(', ')}). ` +
      `Usando "${res.column}". Configure o caso de uso com a relação desejada.`
    )
  }
}

/** Mensagem de erro padrão quando nenhuma relação pôde ser determinada. */
export function missingRelationMessage(childTable?: string | null, parentTable?: string | null): string {
  return `Relação entre "${parentTable}" e "${childTable}" não configurada. Declare a relação no Studio (Relacionamentos) ou configure o vínculo do caso de uso.`
}

const TEXT_TYPE = /(char|text|string|citext)/i

/**
 * Título de exibição de um registro quando o caso de uso não configurou um campo de título.
 * Usa os METADADOS: primeiro campo textual visível que não seja chave primária nem chave estrangeira; senão a própria PK.
 * (Antes era um palpite por nomes de coluna em português: nome/titulo/descricao.)
 */
export function pickRecordTitle(record: any, model: any): string | undefined {
  if (!record) return undefined
  const fields: any[] = model?.fields || []
  const isFk = (f: any) => !!f.foreign_key_table || !!f.foreign_key_column
  const candidates = fields.filter(
    (f) => !f.is_primary_key && !isFk(f) && f.is_visible_in_list !== false && TEXT_TYPE.test(String(f.db_data_type || f.data_type || ''))
  )
  for (const f of candidates) {
    const v = readCol(record, colOf(f.db_column_name))
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v)
  }
  const pk = getRecordPk(record, getPkColumn([model], tableOf(model)))
  return pk !== undefined && pk !== null ? String(pk) : undefined
}

export interface InferredJoin { from: string; localKey: string; to: string; foreignKey: string }

/**
 * Joins pai→filho deduzidas do esquema, quando o caso de uso e as relações do projeto não trazem nenhuma.
 * Por par de tabelas: 1) campo da filha com foreign_key_table = pai (metadado)  2) último recurso, palpite por nome (avisado).
 * A chave do pai é a PK do metadado (e não uma coluna chamada "id").
 */
export function inferJoins(models: any[] | undefined | null, onlyParentTable?: string | null): InferredJoin[] {
  const out: InferredJoin[] = []
  const all = models || []
  for (const parent of all) {
    if (onlyParentTable && !eq(tableOf(parent), onlyParentTable)) continue
    const pk = pickPkField(parent)
    if (!pk) continue
    for (const child of all) {
      if (child.id === parent.id) continue
      const res = resolveFkColumn({ models: all, childTable: tableOf(child), parentTable: tableOf(parent) })
      if (!res.column || (res.source !== 'metadata' && res.source !== 'name-guess')) continue
      warnFkResolution(res, tableOf(child), tableOf(parent))
      const fkField = (child.fields || []).find((f: any) => eq(colOf(f.db_column_name), res.column))
      out.push({
        from: tableOf(parent),
        localKey: pk.db_column_name,
        to: tableOf(child),
        foreignKey: fkField?.db_column_name ?? res.column,
      })
    }
  }
  return out
}

const warnedRefs = new Set<string>()
/** Avisa (uma vez) que a tabela referenciada por uma coluna foi deduzida pelo NOME da coluna (sem metadado). */
export function warnInferredReference(column?: string | null, table?: string | null): void {
  const key = `${column}|${table}`
  if (warnedRefs.has(key)) return
  warnedRefs.add(key)
  console.warn(`[MetaBuilder] A coluna "${column}" foi associada à tabela "${table}" apenas pelo NOME. Declare a relação/chave estrangeira no Studio para não depender de convenção de nomes.`)
}
