/**
 * Utilitários para descobrir QUAL coluna do detalhe aponta para o registro pai (FK) em casos de uso
 * Mestre-Detalhe-SubDetalhe (ex.: Clientes → Pedidos → Itens do Pedido).
 *
 * Formato de join usado no runtime: { from: <tabela pai>, localKey: <coluna no pai>, to: <tabela filha>, foreignKey: <coluna na filha> }
 * (também aceita a variante { table, toTable, on, toOn }).
 */

export interface ParentJoin {
  from: string
  localKey: string
  to: string
  foreignKey: string
}

const eq = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

/** Lê uma chave do registro ignorando maiúsculas/minúsculas (Oracle devolve colunas em CAIXA ALTA). */
export function readKey(record: any, key?: string | null): any {
  if (!record || !key) return undefined
  if (record[key] !== undefined) return record[key]
  const lower = key.toLowerCase()
  const found = Object.keys(record).find((k) => k.toLowerCase() === lower)
  return found !== undefined ? record[found] : undefined
}

/**
 * Encontra o join que liga `parentTable` → `childTable`.
 * Sem `parentTable`, devolve o primeiro join que tem `childTable` como destino.
 */
export function findParentJoin(joins: any[] | undefined | null, childTable?: string | null, parentTable?: string | null): ParentJoin | null {
  if (!childTable) return null
  const candidates = (joins || []).filter((j) => eq(j?.to ?? j?.toTable, childTable))
  const pick = parentTable ? candidates.find((j) => eq(j?.from ?? j?.table, parentTable)) : candidates[0]
  if (!pick) return null
  const localKey = pick.localKey ?? pick.on
  const foreignKey = pick.foreignKey ?? pick.toOn
  if (!localKey || !foreignKey) return null
  return { from: pick.from ?? pick.table, localKey, to: pick.to ?? pick.toTable, foreignKey }
}

/**
 * Nome da coluna de chave primária de uma tabela, lido do metadado dos modelos (campo marcado como is_primary_key).
 * Retorna null se a tabela/PK não estiver nos metadados.
 */
export function getPrimaryKeyColumn(models: any[] | undefined | null, table?: string | null): string | null {
  if (!table) return null
  const model = (models || []).find((m: any) => eq(m?.db_table_name ?? m?.table_name, table))
  const pk = model?.fields?.find((f: any) => f?.is_primary_key)
  const col: string | undefined = pk?.db_column_name
  return col ? col.split('.').pop() || null : null
}

/**
 * Valor da chave do registro pai que a FK do filho deve receber (ex.: ID do pedido).
 * Ordem: coluna do join (localKey) → chave primária do metadado → "id"/"ID" (último recurso, para metadado ausente).
 */
export function getParentKeyValue(join: ParentJoin | null, parentRecord: any, primaryKeyColumn?: string | null): any {
  if (!parentRecord) return undefined
  const byJoin = join ? readKey(parentRecord, join.localKey) : undefined
  if (byJoin !== undefined && byJoin !== null) return byJoin
  const byPk = primaryKeyColumn ? readKey(parentRecord, primaryKeyColumn) : undefined
  if (byPk !== undefined && byPk !== null) return byPk
  return parentRecord.id ?? parentRecord.ID
}

/** O registro ainda não existe no banco (id temporário ou marcado como novo)? */
export function isUnsavedRecord(record: any): boolean {
  if (!record) return true
  if (record._isNew) return true
  const id = record.id ?? record.ID
  return typeof id === 'string' && id.startsWith('temp-')
}
