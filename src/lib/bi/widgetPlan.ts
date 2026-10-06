/**
 * Planejador de consulta de um widget de BI.
 *
 * Recebe o widget, o modelo de dados (tabelas, campos, relações) e o contexto (filtros da tela, período, banco) e devolve
 * O QUE executar: o SQL agregado (e o do período anterior, no KPI com comparação), o SQL de linhas cruas da reserva, ou
 * a mensagem de erro para o usuário. Não executa nada: é função pura. O painel em execução envia o resultado pelo túnel;
 * o app exportado executa no servidor, diretamente no banco. Assim a lógica de tabelas, JOINs mínimos, filtros e
 * recursos do widget existe uma vez só.
 */
import { getPkColumn, warnInferredReference } from '../schemaResolver'
import { resolveRelations, resolveAllJoins, buildJoinSql, type JoinStep } from '../relationPathFinder'
import { findAlternativePaths, pathSignature } from '../relationPaths'
import { parseFormulaAst } from './safeFormula'
import { buildAggregateQuery, filterConditionSql, quoteFor, type SqlDialect, type BiCondition, type BiConditionOp, type BiColKind } from './queryBuilder'
import { resolveFkLabel } from './fkLabel'
import { biFieldKind } from './columnKind'
import { previousRange, nextDay, type PeriodRange } from './period'
import type { BiWidget } from './widget'
import type { GroupInfo } from './interaction'

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
const FILTER_KEY = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/

export interface PlanInput {
  widget: BiWidget
  /** tabelas do projeto, cada uma com `fields` (array ou objeto) */
  models: any[] | Record<string, any>
  /** relações do projeto como vêm do banco (com ids de model e campo) */
  relations: any[]
  /** dialeto do SQL agregado; null = o banco não suporta (cai nas linhas cruas) */
  dialect: SqlDialect | null
  /** JOINs configurados no caso de uso (legado) */
  layoutJoins?: any[]
  /** filtros da tela: "coluna" ou "tabela.coluna" → texto digitado (viram "contém") */
  screenFilters?: Record<string, string>
  /** período efetivo do widget (já resolvido pelo chamador) ou null */
  period?: PeriodRange | null
  /** pula o SQL agregado (usado depois que ele falhou no banco) */
  legacy?: boolean
  /** erro do banco quando o SQL agregado falhou */
  failureReason?: string
  /** schema usado quando a tabela não declara um */
  projectSlug?: string
  rawRowLimit: number
  maxGroups: number
}

export interface WidgetPlan {
  kind: 'agg' | 'raw' | 'error'
  tableName: string
  schemaName: string
  /** SQL a executar (kind agg ou raw) */
  sql?: string
  /** teto de linhas que o executor deve aceitar */
  limit?: number
  /** KPI com comparação: SQL do período anterior */
  prev?: { sql: string; limit: number }
  /** o widget pede comparação com o período anterior */
  compare: boolean
  /** como o gráfico está agrupado: o campo a filtrar quando alguém clica numa barra/fatia (Fase 4) */
  group?: GroupInfo
  /** mensagem para o usuário (kind error) */
  message?: string
  warnings: string[]
}

type Col = { table: string; column: string }

export function planWidgetQuery(input: PlanInput): WidgetPlan {
  const { widget, dialect, layoutJoins = [], screenFilters = {}, period = null, legacy = false } = input
  const allModels: any[] = Array.isArray(input.models) ? input.models : Object.values(input.models || {})
  const warnings: string[] = []

  const model = allModels.find(m => String(m.id) === String(widget.model_id))
  const tableName: string | null =
    model?.db_table_name || (typeof widget.model_id === 'string' && widget.model_id !== 'undefined' && !widget.model_id.includes('-') ? widget.model_id : null)
  const schemaName: string = model?.db_schema_name || input.projectSlug || 'public'

  const fail = (message: string): WidgetPlan => ({ kind: 'error', tableName: tableName || '', schemaName, compare: false, message, warnings })

  if (!tableName) return fail('Tabela não encontrada')
  const mainTable: string = tableName

  // Todo campo do widget é "TABELA.COLUNA": sem o nome da tabela, uma coluna repetida (STATUS, NOME...) poderia vir de qualquer tabela
  {
    const isF = !!widget.use_formula
    const unqualified: string[] = []
    const check = (label: string, v?: string) => { if (v && !String(v).includes('.')) unqualified.push(`${label} ("${v}")`) }
    check('Agrupar por', widget.group_by)
    if (!isF && widget.field && widget.field !== '*') check('Campo do valor', widget.field)
    check('Segmentar por', widget.series_by)
    check('Divisor', widget.divide_by?.field)
    check('Campo do período', widget.period_field)
    ;(widget.conditions || []).forEach((c, i) => check(`Filtro ${i + 1}`, c.field))
    if (isF && widget.field) {
      const ast = parseFormulaAst(String(widget.field))
      const walk = (n: any): boolean => !n ? false : n.t === 'field' ? !n.table : n.t === 'neg' ? walk(n.a) : n.t === 'bin' ? walk(n.a) || walk(n.b) : n.t === 'fn' ? n.args.some(walk) : false
      if (walk(ast)) unqualified.push('Fórmula')
    }
    if (unqualified.length > 0) {
      return fail(`Reabra o widget e selecione novamente (sem a tabela do campo): ${unqualified.join(', ')}`)
    }
  }

  const Q = quoteFor(dialect ?? 'postgres')
  const qCol = (table: string, column: string) => `${Q(table)}.${Q(column)}`

  const isFormula = widget.use_formula || (widget.field?.includes('*') || widget.field?.includes('+') || widget.field?.includes('/') || widget.field?.includes('-'))

  // Colunas que o caminho de linhas cruas precisa trazer
  let selectStr = '*'
  if (!isFormula && widget.field !== '*') {
    const fieldMeta = model?.fields?.find((f: any) => String(f.id) === String(widget.field))
    selectStr = fieldMeta?.db_column_name || widget.field || '*'
  } else if (isFormula && widget.field) {
    const formulaStr = String(widget.field)
    const matches = formulaStr.match(/[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?/g) || []
    const keywords = ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'TRUE', 'FALSE']
    const cols = matches.filter(m => !keywords.includes(m.toUpperCase()) && isNaN(Number(m)))
    if (cols.length > 0) selectStr = [...new Set(cols)].join(', ')
  }

  let groupCol = widget.group_by
  if (widget.group_by && !selectStr.includes(widget.group_by)) {
    const parts = widget.group_by.split('.')
    const targetTableName = parts.length > 1 ? parts[0] : null
    const targetFieldName = parts.length > 1 ? parts[1] : widget.group_by
    for (const m of allModels) {
      if (targetTableName && m.db_table_name !== targetTableName) continue
      const fields = Array.isArray(m.fields) ? m.fields : Object.values(m.fields || {})
      const found = (fields as any[]).find(f => String(f.id) === String(targetFieldName) || f.db_column_name === targetFieldName || f.name === targetFieldName)
      if (found) {
        groupCol = `${m.db_table_name}.${found.db_column_name}`
        break
      }
    }
    if (typeof groupCol === 'string' && !selectStr.includes(groupCol)) {
      selectStr = selectStr === '*' ? groupCol : `${selectStr}, ${groupCol}`
    }
  }

  // JOINs: caminho mais curto no grafo de relações (ou o que o desenvolvedor escolheu)
  const resolvedRelations = resolveRelations(input.relations || [], allModels)

  // Tabelas citadas pelo widget (agrupamento, valor e JOINs manuais)
  const referencedTables: string[] = []
  if (typeof groupCol === 'string' && groupCol.includes('.')) referencedTables.push(groupCol.split('.')[0])
  if (widget.field && typeof widget.field === 'string') {
    const matches = widget.field.match(/[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+/g)
    if (matches) matches.forEach(m => referencedTables.push(m.split('.')[0]))
    else if (widget.field.includes('.')) referencedTables.push(widget.field.split('.')[0])
  }
  const legacyJoins = [...(widget.joins || []), ...layoutJoins]
  legacyJoins.forEach((j: any) => {
    const fromModel = allModels.find(m => String(m.id) === String(j.from) || m.db_table_name === j.from)
    const toModel = allModels.find(m => String(m.id) === String(j.to) || m.db_table_name === j.to)
    if (fromModel?.db_table_name) referencedTables.push(fromModel.db_table_name)
    if (toModel?.db_table_name) referencedTables.push(toModel.db_table_name)
  })

  // caminhos de relação que o desenvolvedor escolheu no editor (tabela → caminho); a escolha só vale se ainda existir
  const preferredPaths: Record<string, JoinStep[]> = {}
  for (const [tbl, sig] of Object.entries(widget.relation_paths || {})) {
    const hit = findAlternativePaths(resolvedRelations, mainTable, tbl).find(p => pathSignature(p) === sig)
    if (hit) preferredPaths[tbl.toLowerCase()] = hit
  }

  // Monta os JOINs para um conjunto de tabelas. Chamada duas vezes: com tudo (linhas cruas, como antes) e só com as
  // tabelas que o widget usa (SQL agregado, para não multiplicar linhas).
  const resolveJoinSql = (referenced: string[], legacy: any[]) => {
    let joinSql = ''
    const joinedTables = new Set<string>([mainTable])

    if (resolvedRelations.length > 0 && referenced.length > 0) {
      const uniqueReferenced = [...new Set(referenced.filter(t => t !== mainTable))]
      const steps = resolveAllJoins(resolvedRelations, mainTable, uniqueReferenced, preferredPaths)
      joinSql += buildJoinSql(steps, undefined, Q)
      steps.forEach(s => { joinedTables.add(s.fromTable); joinedTables.add(s.toTable) })
    }

    // JOINs configurados à mão (legado)
    if (legacy.length > 0) {
      const processJoins = () => {
        let added = false
        legacy.forEach((j: any) => {
          const fromModel = allModels.find(m => String(m.id) === String(j.from) || m.db_table_name === j.from)
          const toModel = allModels.find(m => String(m.id) === String(j.to) || m.db_table_name === j.to)
          const fromTable = fromModel?.db_table_name || j.from || j.table
          const toTable = toModel?.db_table_name || j.to || j.toTable
          const fromField = fromModel?.fields?.find((f: any) => String(f.id) === String(j.local_field || j.local || j.localKey))?.db_column_name || j.local_field || j.local || j.localKey || getPkColumn(allModels, fromTable) || 'id'
          const toField = toModel?.fields?.find((f: any) => String(f.id) === String(j.foreign_field || j.foreignKey))?.db_column_name || j.foreign_field || j.foreignKey || getPkColumn(allModels, toTable) || 'id'
          if (!fromTable || !toTable) return
          if (![fromTable, toTable, fromField, toField].every(x => IDENT.test(String(x)))) return
          if (joinedTables.has(fromTable) && joinedTables.has(toTable)) return
          if (!joinedTables.has(fromTable) && !joinedTables.has(toTable)) return
          const newTable = joinedTables.has(fromTable) ? toTable : fromTable
          joinSql += ` LEFT JOIN ${Q(newTable)} ON ${qCol(fromTable, fromField)} = ${qCol(toTable, toField)}`
          joinedTables.add(newTable)
          added = true
        })
        return added
      }
      let iterations = 0
      while (processJoins() && iterations < 10) iterations++
    }

    // Auto-join heurístico: tabela ainda sem JOIN → procura uma chave estrangeira nos modelos
    const missingTables = referenced.filter(t => !joinedTables.has(t) && t !== mainTable)
    missingTables.forEach(refTable => {
      if (!IDENT.test(refTable)) return
      for (const jt of Array.from(joinedTables)) {
        const jtModel = allModels.find(m => m.db_table_name === jt)
        if (jtModel) {
          const fields = Array.isArray(jtModel.fields) ? jtModel.fields : Object.values(jtModel.fields || {})
          const isRel = (f: any) => (f.type === 'relation' && (f.relation?.table === refTable || f.relation_table === refTable)) || (!!f.foreign_key_table && String(f.foreign_key_table).toLowerCase() === String(refTable).toLowerCase())
          const isRelByName = (f: any) => f.db_column_name === `${refTable}_id` || f.db_column_name === `${refTable.replace(/s$/, '')}_id`
          const relField = (fields as any[]).find(isRel) || (() => { const g = (fields as any[]).find(isRelByName); if (g) warnInferredReference(g.db_column_name, refTable); return g })()
          if (relField) {
            const localCol = relField.db_column_name || 'id'
            const foreignCol = relField.relation?.foreign_field || relField.relation_key || relField.foreign_key_column || getPkColumn(allModels, refTable) || 'id'
            if (IDENT.test(jt) && IDENT.test(localCol) && IDENT.test(foreignCol)) {
              joinSql += ` LEFT JOIN ${Q(refTable)} ON ${qCol(jt, localCol)} = ${qCol(refTable, foreignCol)}`
              joinedTables.add(refTable)
              break
            }
          }
        }
        const refModel = allModels.find(m => m.db_table_name === refTable)
        if (refModel) {
          const fields = Array.isArray(refModel.fields) ? refModel.fields : Object.values(refModel.fields || {})
          const isRelReverse = (f: any) => (f.type === 'relation' && (f.relation?.table === jt || f.relation_table === jt)) || (!!f.foreign_key_table && String(f.foreign_key_table).toLowerCase() === String(jt).toLowerCase())
          const isRelReverseByName = (f: any) => f.db_column_name === `${jt}_id` || f.db_column_name === `${jt.replace(/s$/, '')}_id`
          const relField = (fields as any[]).find(isRelReverse) || (() => { const g = (fields as any[]).find(isRelReverseByName); if (g) warnInferredReference(g.db_column_name, jt); return g })()
          if (relField) {
            const localCol = relField.db_column_name || 'id'
            const foreignCol = relField.relation?.foreign_field || relField.relation_key || relField.foreign_key_column || getPkColumn(allModels, jt) || 'id'
            if (IDENT.test(jt) && IDENT.test(localCol) && IDENT.test(foreignCol)) {
              joinSql += ` LEFT JOIN ${Q(refTable)} ON ${qCol(refTable, localCol)} = ${qCol(jt, foreignCol)}`
              joinedTables.add(refTable)
              break
            }
          }
        }
      }
    })

    return { joinSql, joinedTables }
  }
  const { joinSql, joinedTables } = resolveJoinSql(referencedTables, legacyJoins)

  // Rede de segurança: tira de selectStr as colunas de tabelas sem JOIN (evita quebrar o SQL)
  if (selectStr !== '*') {
    selectStr = selectStr.split(',').filter(s => {
      const col = s.trim()
      if (col === '*') return true
      if (col.includes('.')) {
        const t = col.split('.')[0]
        return joinedTables.has(t) || t === mainTable
      }
      return true
    }).join(', ')
  }

  // Filtros da tela: só entram os que apontam para uma coluna do próprio widget (tabela principal ou com JOIN).
  const columnExists = (table: string, column: string) => {
    const m = allModels.find(x => x.db_table_name === table)
    const fs = Array.isArray(m?.fields) ? m.fields : Object.values(m?.fields || {})
    return (fs as any[]).some(f => String(f.db_column_name).toLowerCase() === column.toLowerCase())
  }
  const candidateFilters: { col: Col; value: string }[] = []
  Object.entries(screenFilters).forEach(([key, val]) => {
    if (!val) return
    // o nome da coluna entra no SQL entre aspas: só identificadores simples (tabela.coluna) são aceitos
    if (!FILTER_KEY.test(key)) return
    const filterTable = key.includes('.') ? key.split('.')[0] : mainTable
    const filterCol = key.includes('.') ? key.split('.')[1] : key
    if (!columnExists(filterTable, filterCol)) return
    candidateFilters.push({ col: { table: filterTable, column: filterCol }, value: String(val) })
  })
  const validFilters = candidateFilters.filter(f => joinedTables.has(f.col.table))

  // Tabelas que o widget realmente usa (grupo, valor, fórmula e filtros) → JOINs mínimos
  const resolveRef = (s: string): Col => s.includes('.') ? { table: s.split('.')[0], column: s.split('.')[1] } : { table: mainTable, column: s }
  const rawField = widget.field && widget.field !== '*' ? String(widget.field) : ''
  const aggFormula = rawField && (widget.use_formula || /[*+/()]/.test(rawField)) ? rawField : null
  let fieldRef: Col | null = null
  if (rawField && !aggFormula) {
    const fieldMeta = model?.fields?.find((f: any) => String(f.id) === rawField)
    fieldRef = resolveRef(fieldMeta?.db_column_name || rawField)
  }
  const groupRef = typeof groupCol === 'string' && groupCol ? resolveRef(groupCol) : null
  const usedTables = new Set<string>([fieldRef?.table, groupRef?.table].filter(Boolean) as string[])
  if (aggFormula) for (const m of aggFormula.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\.[A-Za-z_][A-Za-z0-9_]*/g)) usedTables.add(m[1])

  // Filtros do widget (com operador), período, série, métrica derivada
  const colKind = (table: string, column: string): BiColKind => {
    const m = allModels.find(x => x.db_table_name === table)
    const fs = Array.isArray(m?.fields) ? m.fields : Object.values(m?.fields || {})
    return biFieldKind((fs as any[]).find(x => String(x.db_column_name).toLowerCase() === column.toLowerCase()))
  }
  const conditions: BiCondition[] = []
  ;(widget.conditions || []).forEach(c => {
    if (!c?.field || !c.op) return
    const noValue = c.op === 'is_null' || c.op === 'not_null'
    if (!noValue && (c.value === undefined || c.value === '')) return
    if (c.op === 'between' && (c.value2 === undefined || c.value2 === '')) return
    const ref = resolveRef(String(c.field))
    conditions.push({ col: ref, op: c.op as BiConditionOp, kind: colKind(ref.table, ref.column), value: c.value, value2: c.value2 })
  })
  const baseConditions = [...conditions]
  const periodConditions = (range: PeriodRange): BiCondition[] => {
    const ref = resolveRef(widget.period_field as string)
    return [
      { col: ref, op: 'gte', kind: 'date', value: range.from },
      { col: ref, op: 'lt', kind: 'date', value: nextDay(range.to) },
    ]
  }
  if (widget.period_field && period) conditions.push(...periodConditions(period))
  const compare = widget.type === 'kpi' && !widget.group_by && !!widget.compare_previous && !!widget.period_field && !!period

  const seriesRef = widget.series_by && widget.group_by && ['bar', 'line', 'area'].includes(String(widget.type)) ? resolveRef(widget.series_by) : null
  const divideBy = widget.divide_by?.calc
    ? { calc: widget.divide_by.calc, field: widget.divide_by.field ? resolveRef(widget.divide_by.field) : null }
    : null
  // agrupar por chave estrangeira: mostra o nome do registro relacionado em vez do UUID
  const groupLabel = groupRef ? resolveFkLabel(allModels, resolvedRelations, groupRef) : null
  const seriesLabel = seriesRef ? resolveFkLabel(allModels, resolvedRelations, seriesRef) : null
  if (groupLabel) usedTables.add(groupLabel.label.table)
  if (seriesLabel) usedTables.add(seriesLabel.label.table)
  conditions.forEach(c => usedTables.add(c.col.table))
  if (seriesRef) usedTables.add(seriesRef.table)
  if (divideBy?.field) usedTables.add(divideBy.field.table)

  // recursos que só o SQL agregado entrega (o caminho de linhas cruas não os implementa)
  const needsAgg = conditions.length > 0 || !!seriesRef || !!divideBy || widget.calc === 'COUNT_DISTINCT' ||
    widget.date_granularity === 'week' || widget.date_granularity === 'quarter'
  let buildReason = ''

  // JOINs mínimos: só as tabelas que o widget usa (grupo, valor e filtros). Os JOINs do caso de uso inteiro
  // (entregas, projetos, tarefas...) repetiam cada pedido e inflavam SUM/AVG.
  const filterTables = candidateFilters.map(f => f.col.table)
  const minimal = resolveJoinSql([...usedTables, ...filterTables].filter(t => t !== mainTable), widget.joins || [])
  const aggFilters = candidateFilters.filter(f => minimal.joinedTables.has(f.col.table))
  const minimalOk = [...usedTables].every(t => minimal.joinedTables.has(t))

  // 1) Caminho novo: o banco agrega (GROUP BY / SUM / COUNT) e devolve só as linhas do gráfico
  if (dialect && !legacy) {
    if (minimalOk) {
      const mainPk = getPkColumn(allModels, mainTable) || 'id'
      const built = buildAggregateQuery({
        dialect,
        mainTable,
        mainPk,
        joinSql: minimal.joinSql,
        calc: String(widget.calc || 'COUNT'),
        formula: aggFormula,
        field: fieldRef,
        groupBy: groupRef,
        granularity: widget.date_granularity,
        sortBy: widget.sort_by,
        limitTopN: widget.limit_top_n,
        filters: aggFilters,
        conditions,
        series: seriesRef,
        divideBy,
        groupLabel,
        seriesLabel,
        maxGroups: input.maxGroups,
      })
      if (built.ok) {
        const limit = input.maxGroups + 100
        const plan: WidgetPlan = { kind: 'agg', tableName: mainTable, schemaName, sql: built.sql, limit, compare, warnings }
        if (groupRef) {
          // agrupado por chave estrangeira o gráfico mostra o nome do registro relacionado: é por ele que se filtra
          const gcol = groupLabel ? groupLabel.label : groupRef
          const kind = groupLabel ? 'text' : colKind(gcol.table, gcol.column)
          plan.group = { field: `${gcol.table}.${gcol.column}`, kind, granularity: kind === 'date' ? widget.date_granularity || undefined : undefined }
        }
        // KPI com comparação: segunda consulta, igual à primeira mas no período anterior
        if (compare && period) {
          const prevBuilt = buildAggregateQuery({
            dialect,
            mainTable,
            mainPk,
            joinSql: minimal.joinSql,
            calc: String(widget.calc || 'COUNT'),
            formula: aggFormula,
            field: fieldRef,
            groupBy: null,
            filters: aggFilters,
            conditions: [...baseConditions, ...periodConditions(previousRange(period))],
            divideBy,
            maxGroups: input.maxGroups,
          })
          if (prevBuilt.ok) plan.prev = { sql: prevBuilt.sql, limit }
        }
        return plan
      }
      buildReason = built.reason
      warnings.push(`[BI] consulta agregada não aplicável, usando linhas cruas: ${built.reason}`)
    } else {
      buildReason = 'tabela do indicador sem relação com as demais (verifique o caminho de relacionamento)'
    }
  }

  if (needsAgg) {
    const why = input.failureReason ? `consulta falhou no banco: ${input.failureReason}` : buildReason || 'este indicador exige banco PostgreSQL, Oracle, MySQL ou SQL Server'
    return { ...fail(`Não foi possível calcular: ${why}`), compare }
  }

  // 2) Caminho de reserva: busca linhas cruas (limitadas) e agrega no cliente
  // Mesmo aqui, só junta o necessário quando possível (senão JOINs 1:N repetem as linhas)
  const rawJoinSql = minimalOk ? minimal.joinSql : joinSql
  const rawJoined = minimalOk ? minimal.joinedTables : joinedTables
  const rawFilters = minimalOk ? aggFilters : validFilters
  const whereClause = ['1=1', ...rawFilters.map(f => filterConditionSql(dialect ?? 'other', f))].join(' AND ')
  let sqlSelect = '*'
  if (selectStr !== '*') {
    sqlSelect = selectStr.split(',').map(s => s.trim()).filter(col => {
      if (col === '*') return true
      const bare = col.includes('.') ? col.split('.') : [mainTable, col]
      if (!IDENT.test(bare[0]) || !IDENT.test(bare[1])) return false
      return !col.includes('.') || rawJoined.has(bare[0]) || bare[0] === mainTable
    }).map(col => {
      if (col === '*') return '*'
      const p = col.includes('.') ? col.split('.') : [mainTable, col]
      return qCol(p[0], p[1])
    }).join(', ') || '*'
  }

  // SQL Server não aceita OFFSET/FETCH sem ORDER BY: aqui usa TOP
  const top = dialect === 'sqlserver' ? `TOP ${input.rawRowLimit} ` : ''
  const rawLimit = dialect === 'oracle'
    ? ` OFFSET 0 ROWS FETCH NEXT ${input.rawRowLimit} ROWS ONLY`
    : dialect === 'sqlserver' ? '' : ` LIMIT ${input.rawRowLimit}`
  return {
    kind: 'raw',
    tableName: mainTable,
    schemaName,
    sql: `SELECT ${top}${sqlSelect} FROM ${Q(mainTable)}${rawJoinSql} WHERE ${whereClause}${rawLimit}`,
    limit: input.rawRowLimit,
    compare,
    warnings,
  }
}
