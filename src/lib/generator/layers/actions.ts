import { AppAST, ModelNode, FieldNode } from '../ast'
import { toPascalCase } from './routes/helpers'

export function generateActions(ast: AppAST, files: Map<string, string>) {
  // Configuração global de banco baseada na stack escolhida
  const dbConfigContent = ast.dbStack === 'supabase' 
    ? generateSupabaseClient()
    : ast.dbStack === 'oracle'
      ? generateOracleClient()
      : ast.dbStack === 'mysql'
        ? generateMysqlClient()
        : ast.dbStack === 'sqlserver'
          ? generateSqlServerClient()
          : generatePgClient()

  files.set('app/actions/db.ts', dbConfigContent)

  // Gerar ações de CRUD para cada modelo
  for (const model of ast.models) {
    let actionContent = ast.dbStack === 'supabase'
      ? generateSupabaseActions(model, ast.models)
      : ast.dbStack === 'oracle'
        ? generateOracleActions(model, ast.models)
        : ast.dbStack === 'mysql'
          ? generateMysqlActions(model, ast.models)
          : ast.dbStack === 'sqlserver'
            ? generateSqlServerActions(model, ast.models)
            : generatePgActions(model, ast.models)

    // Exportar aliases de funções para variações de nomenclatura (ex: ItensPedido vs Itens_pedido)
    const aliases = new Set<string>()
    if (model.dbTable) {
      const directCap = model.dbTable.charAt(0).toUpperCase() + model.dbTable.slice(1)
      if (directCap !== model.name && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(directCap)) {
        aliases.add(directCap)
      }
      const pascal = toPascalCase(model.dbTable)
      if (pascal !== model.name && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(pascal)) {
        aliases.add(pascal)
      }
    }

    if (aliases.size > 0) {
      let aliasCode = '\n// Compatibility aliases\n'
      for (const alias of aliases) {
        aliasCode += `export async function get${alias}List(opts?: any) { return get${model.name}List(opts) }\n`
        aliasCode += `export async function get${alias}ById(id: string) { return get${model.name}ById(id) }\n`
        aliasCode += `export async function get${alias}ByField(field: string, value: any) { return get${model.name}ByField(field, value) }\n`
        aliasCode += `export async function create${alias}(formData: any) { return create${model.name}(formData) }\n`
        aliasCode += `export async function update${alias}(id: string, formData: any) { return update${model.name}(id, formData) }\n`
        aliasCode += `export async function delete${alias}(id: string) { return delete${model.name}(id) }\n`
      }
      actionContent += aliasCode
    }

    // Salvar o arquivo de action sob todas as convenções possíveis de caminho/nome de arquivo
    const fileKeys = new Set<string>()
    if (model.name) {
      fileKeys.add(model.name.toLowerCase().trim())
      fileKeys.add(model.name.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))
    }
    if (model.dbTable) {
      fileKeys.add(model.dbTable.toLowerCase().trim())
      fileKeys.add(model.dbTable.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))
    }
    if (model.id) {
      fileKeys.add(model.id.toLowerCase().trim())
    }

    for (const key of fileKeys) {
      if (key) {
        files.set(`app/actions/${key}.ts`, actionContent)
      }
    }
  }

  // Varredura de segurança: garante que qualquer módulo de action importado em qualquer página exista
  const actionImportRegex = /from\s+['"]@\/app\/actions\/([^'"]+)['"]/g
  const neededActions = new Set<string>()

  for (const [filePath, content] of files.entries()) {
    if (filePath.startsWith('app/')) {
      let match: RegExpExecArray | null
      actionImportRegex.lastIndex = 0
      while ((match = actionImportRegex.exec(content)) !== null) {
        const actionModuleName = match[1]
        if (actionModuleName && actionModuleName !== 'db') {
          neededActions.add(actionModuleName)
        }
      }
    }
  }

  for (const actionName of neededActions) {
    const actionPath = `app/actions/${actionName}.ts`
    if (!files.has(actionPath)) {
      // Tenta associar com modelo do AST
      const clean = actionName.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '')
      const foundModel = ast.models.find(m =>
        (m.dbTable && m.dbTable.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '') === clean) ||
        (m.name && m.name.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '') === clean) ||
        (m.id && m.id.toLowerCase() === actionName.toLowerCase())
      )

      if (foundModel) {
        const existingContent =
          files.get(`app/actions/${(foundModel.dbTable || '').toLowerCase()}.ts`) ||
          files.get(`app/actions/${(foundModel.name || '').toLowerCase()}.ts`)
        if (existingContent) {
          files.set(actionPath, existingContent)
          continue
        }
      }

      // Fallback seguro caso seja tabela/relação externa não modelada no AST
      const pascalName = toPascalCase(actionName) || 'Record'
      files.set(actionPath, `'use server'

export async function get${pascalName}List(opts?: any) {
  return []
}

export async function get${pascalName}ById(id: string) {
  return null
}

export async function get${pascalName}ByField(field: string, value: any) {
  return []
}

export async function create${pascalName}(formData: any) {
  return null
}

export async function update${pascalName}(id: string, formData: any) {
  return
}

export async function delete${pascalName}(id: string) {
  return
}
`)
    }
  }
}

function generateSupabaseClient() {
  return `import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // ignored
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // ignored
          }
        },
      },
    }
  )
}
`
}

function generatePgClient() {
  return `import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function query(text: string, params?: any[]) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  console.log('Executed query', { text, duration, rows: res.rowCount })
  return res
}
`
}

function generateOracleClient() {
  return `import oracledb from 'oracledb'

export async function query(text: string, params: any = {}) {
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectionString: process.env.DB_CONNECTION_STRING
    });

    const result = await connection.execute(text, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows || [];
  } catch (err) {
    console.error('Database query error', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection', err);
      }
    }
  }
}
`
}

function generateMysqlClient() {
  return `import mysql from 'mysql2/promise'

const pool = mysql.createPool(process.env.DATABASE_URL as string)

export async function query(text: string, params?: any[]) {
  const [rows] = await pool.query(text, params)
  return rows as any[]
}
`
}

function generateSqlServerClient() {
  return `import sql from 'mssql'

const poolPromise = new sql.ConnectionPool(process.env.DATABASE_URL as string)
  .connect()
  .then(pool => {
    console.log('Connected to SQL Server')
    return pool
  })
  .catch(err => {
    console.error('Database Connection Failed! Bad Config: ', err)
    throw err
  })

export async function getPool() {
  return poolPromise
}
`
}

// -----------------------------------------------------------------------------
// CHILD RELATION CASCADE HELPERS
// -----------------------------------------------------------------------------

function getReferencingFields(model: ModelNode, allModels: ModelNode[] = []): Array<{ table: string; column: string }> {
  const refs: Array<{ table: string; column: string }> = []
  const modelTable = (model.dbTable || model.name).toLowerCase()
  const modelName = model.name.toLowerCase()
  const singularTable = modelTable.endsWith('s') ? modelTable.slice(0, -1) : modelTable

  for (const other of allModels) {
    if (other === model) continue
    const otherTable = other.dbTable || other.name
    for (const f of other.fields) {
      const targetTable = (
        (f.relation as any)?.targetTable ||
        f.config?.relation?.targetTable ||
        (f.config as any)?.component?.rel_table ||
        (f.config as any)?.rel_table ||
        ''
      ).toLowerCase()

      const targetModel = (
        f.relation?.targetModel ||
        f.config?.relation?.targetModel ||
        ''
      ).toLowerCase()

      const colLower = f.dbColumn.toLowerCase()
      const isRefByTarget = targetTable === modelTable || (targetModel && targetModel === modelName)
      const isRefByColName = colLower === `${modelTable}_id` || colLower === `${singularTable}_id`

      if (isRefByTarget || isRefByColName) {
        if (!refs.some(r => r.table.toLowerCase() === otherTable.toLowerCase() && r.column.toLowerCase() === f.dbColumn.toLowerCase())) {
          refs.push({ table: otherTable, column: f.dbColumn })
        }
      }
    }
  }

  return refs
}

interface SchemaRelationEdge {
  fromTable: string
  fromCol: string
  toTable: string
  toCol: string
}

function buildSchemaRelations(allModels: ModelNode[]): SchemaRelationEdge[] {
  const edges: SchemaRelationEdge[] = []
  const edgeKey = (e: SchemaRelationEdge) => `${e.fromTable}.${e.fromCol}->${e.toTable}.${e.toCol}`
  const seen = new Set<string>()

  for (const m of allModels) {
    const fromTable = (m.dbTable || m.name).toLowerCase()
    for (const f of m.fields) {
      let toTable = ''
      let toCol = 'id'

      const rel = f.relation as any
      const cfgRel = f.config?.relation
      const compRel = (f.config as any)?.component

      if (rel?.targetTable) {
        toTable = String(rel.targetTable).toLowerCase()
        toCol = rel.targetCol || 'id'
      } else if (cfgRel?.targetTable) {
        toTable = String(cfgRel.targetTable).toLowerCase()
        toCol = cfgRel.valueColumn || 'id'
      } else if (compRel?.rel_table) {
        toTable = String(compRel.rel_table).toLowerCase()
        toCol = compRel.rel_value || 'id'
      } else if ((f.config as any)?.rel_table) {
        toTable = String((f.config as any).rel_table).toLowerCase()
        toCol = (f.config as any).rel_value || 'id'
      } else if (rel?.targetModel || cfgRel?.targetModel) {
        const targetModelName = String(rel?.targetModel || cfgRel?.targetModel).toLowerCase()
        const targetModel = allModels.find(om => om.name.toLowerCase() === targetModelName || (om.dbTable && om.dbTable.toLowerCase() === targetModelName))
        if (targetModel) {
          toTable = (targetModel.dbTable || targetModel.name).toLowerCase()
          toCol = targetModel.fields.find(x => x.isPrimary)?.dbColumn || 'id'
        }
      } else if (f.dbColumn.endsWith('_id') && !f.isPrimary) {
        const base = f.dbColumn.slice(0, -3).toLowerCase()
        const targetModel = allModels.find(om => {
          const t = (om.dbTable || om.name).toLowerCase()
          return t === base || t === base + 's' || t.replace(/s$/, '') === base
        })
        if (targetModel) {
          toTable = (targetModel.dbTable || targetModel.name).toLowerCase()
          toCol = targetModel.fields.find(x => x.isPrimary)?.dbColumn || 'id'
        }
      }

      if (toTable && toTable !== fromTable && !toTable.includes('-')) {
        const edge: SchemaRelationEdge = {
          fromTable,
          fromCol: f.dbColumn,
          toTable,
          toCol,
        }
        const k = edgeKey(edge)
        if (!seen.has(k)) {
          seen.add(k)
          edges.push(edge)
        }
      }
    }
  }

  return edges
}

// -----------------------------------------------------------------------------
// ACTIONS GENERATORS
// -----------------------------------------------------------------------------

function generateParsePayloadCode(model: ModelNode): string {
  const allowedColsCode = JSON.stringify(model.fields.map(f => f.dbColumn))
  const colTypesCode = JSON.stringify(
    Object.fromEntries(model.fields.map(f => [f.dbColumn, (f.dataType || f.type || '').toLowerCase()]))
  )

  return `const allowedColumns = new Set(${allowedColsCode})
const columnTypes: Record<string, string> = ${colTypesCode}

function parsePayload(formData: FormData | Record<string, any>): Record<string, any> {
  const rawData: Record<string, any> = (formData && typeof (formData as any).entries === 'function')
    ? Object.fromEntries((formData as FormData).entries())
    : (formData && typeof formData === 'object' ? { ...formData } : {})

  const clean: Record<string, any> = {}
  for (const [k, v] of Object.entries(rawData)) {
    if (k.startsWith('$') || k.startsWith('__rsc') || k.startsWith('_next')) continue
    if (!allowedColumns.has(k)) continue
    if (v === '' || v === undefined) {
      clean[k] = null
    } else if (typeof v === 'string') {
      const trimmed = v.trim()
      const colType = (columnTypes[k] || '').toLowerCase()
      const isInteger = colType === 'integer' || colType === 'int' || colType === 'int4' || colType === 'int8' || colType === 'bigint' || colType === 'smallint'
      const isNumeric = isInteger || colType === 'number' || colType === 'numeric' || colType === 'decimal' || colType === 'float' || colType === 'real' || colType === 'double precision'

      if (isInteger) {
        // Inteiro: remove pontos de milhar, trata vírgulas caso tenha sido digitado decimal
        const cleanInt = trimmed.replace(/\\./g, '').replace(/,/g, '.')
        const parsed = parseInt(cleanInt, 10)
        clean[k] = isNaN(parsed) ? null : parsed
      } else if (isNumeric || trimmed.includes(',')) {
        // Numérico/decimal ou valor monetário formatado pt-BR
        const cleanNum = trimmed.includes(',')
          ? trimmed.replace(/\\./g, '').replace(',', '.')
          : trimmed
        const parsed = Number(cleanNum)
        clean[k] = isNaN(parsed) ? trimmed : parsed
      } else if (/^\\d{1,3}(\\.\\d{3})+$/.test(trimmed)) {
        // Valor numérico inteiro formatado com pontos de milhar (ex: "1.000", "1.000.000")
        const parsed = Number(trimmed.replace(/\\./g, ''))
        clean[k] = isNaN(parsed) ? trimmed : parsed
      } else {
        clean[k] = trimmed
      }
    } else {
      clean[k] = v
    }
  }
  return clean
}`
}

function generateSupabaseActions(model: ModelNode, allModels: ModelNode[] = []) {
  const pk = model.fields.find((f: FieldNode) => f.isPrimary)?.dbColumn || 'id'
  const childRefs = getReferencingFields(model, allModels)
  const childCleanups = childRefs.map(ref => {
    return `    await supabase.from('${ref.table}').delete().eq('${ref.column}', id).catch(() => {})`
  }).join('\n')

  return `'use server'
import { createClient } from './db'
import { revalidatePath } from 'next/cache'

${generateParsePayloadCode(model)}

export async function get${model.name}List(opts?: { dateField?: string; startDate?: string; endDate?: string; limit?: number; filters?: Record<string, any> }) {
  const supabase = await createClient()
  let q = supabase.from('${model.dbTable}').select('*').order('${pk}', { ascending: false })
  if (opts?.dateField && opts.startDate) q = q.gte(opts.dateField, opts.startDate)
  if (opts?.dateField && opts.endDate) q = q.lte(opts.dateField, opts.endDate + 'T23:59:59')
  if (opts?.filters && typeof opts.filters === 'object') {
    const ignoredKeys = new Set(['sort_by', 'sort_order', 'page', 'limit', 'embedded', 'view_mode', 'layout', 'search'])
    for (const [rawKey, rawVal] of Object.entries(opts.filters)) {
      if (rawVal === undefined || rawVal === null || rawVal === '') continue
      const key = rawKey.trim()
      if (ignoredKeys.has(key.toLowerCase())) continue
      if (key.includes('.')) {
        const [targetTable, targetCol] = key.split('.')
        const tTable = targetTable.toLowerCase()
        if ((tTable === '${model.dbTable.toLowerCase()}' || tTable.replace(/s$/, '') === '${model.dbTable.toLowerCase()}'.replace(/s$/, '')) && allowedColumns.has(targetCol)) {
          q = q.eq(targetCol, rawVal)
        }
      } else if (allowedColumns.has(key)) {
        q = q.eq(key, rawVal)
      } else if (key.endsWith('_filter')) {
        const col = key.slice(0, -7)
        if (allowedColumns.has(col)) q = q.ilike(col, '%' + rawVal + '%')
      }
    }
  }
  if (opts?.limit) q = q.limit(opts.limit)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data
}

export async function get${model.name}ById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('${model.dbTable}').select('*').eq('${pk}', id).single()
  if (error) throw new Error(error.message)
  return data
}

export async function get${model.name}ByField(field: string, value: any) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('${model.dbTable}').select('*').eq(field, value)
  if (error) throw new Error(error.message)
  return data
}

export async function create${model.name}(formData: FormData | Record<string, any>) {
  const supabase = await createClient()
  const clean = parsePayload(formData)
  const { data, error } = await supabase.from('${model.dbTable}').insert([clean]).select('${pk}').single()
  if (error) throw new Error(error.message)
  revalidatePath('/${model.name.toLowerCase()}')
  return data
}

export async function update${model.name}(id: string, formData: FormData | Record<string, any>) {
  const supabase = await createClient()
  const clean = parsePayload(formData)
  if (Object.keys(clean).length === 0) {
    revalidatePath('/${model.name.toLowerCase()}')
    return
  }
  const { error } = await supabase.from('${model.dbTable}').update(clean).eq('${pk}', id)
  if (error) throw new Error(error.message)
  revalidatePath('/${model.name.toLowerCase()}')
}

export async function delete${model.name}(id: string) {
  try {
    const supabase = await createClient()
${childCleanups ? `${childCleanups}\n` : ''}    const { error } = await supabase.from('${model.dbTable}').delete().eq('${pk}', id)
    if (error) throw new Error(error.message)
    revalidatePath('/${model.name.toLowerCase()}')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao excluir em ${model.name}:', err)
    return { success: false, error: err?.message || 'Erro ao excluir registro.' }
  }
}
`
}

function generatePgActions(model: ModelNode, allModels: ModelNode[] = []) {
  const pk = model.fields.find((f: FieldNode) => f.isPrimary)?.dbColumn || 'id'
  const tableRef = model.dbTable.includes('.')
    ? model.dbTable.split('.').map((p: string) => `"${p}"`).join('.')
    : `"${model.dbTable}"`
  const modelTableLower = (model.dbTable || model.name).toLowerCase()
  const allowedColsCode = JSON.stringify(model.fields.map(f => f.dbColumn))

  const childRefs = getReferencingFields(model, allModels)
  const childCleanups = childRefs.map(ref => {
    const childTableRef = ref.table.includes('.')
      ? ref.table.split('.').map((p: string) => `"${p}"`).join('.')
      : `"${ref.table}"`
    return `    await query('DELETE FROM ${childTableRef} WHERE "${ref.column}" = $1', [id]).catch((e) => console.warn('Aviso ao limpar dependências em ${ref.table}:', e?.message))`
  }).join('\n')

  const schemaRelations = buildSchemaRelations(allModels)

  return `'use server'
import { query } from './db'
import { revalidatePath } from 'next/cache'

${generateParsePayloadCode(model)}

const schemaRelations = ${JSON.stringify(schemaRelations)}

function findRelationPath(startTable: string, targetTable: string): Array<{ table: string; on: string }> | null {
  if (startTable === targetTable || startTable.replace(/s$/, '') === targetTable.replace(/s$/, '')) return []
  const queue: Array<{ current: string; path: Array<{ table: string; on: string }> }> = [
    { current: startTable, path: [] }
  ]
  const visited = new Set<string>([startTable])

  while (queue.length > 0) {
    const item = queue.shift()
    if (!item) break
    const { current, path } = item
    if (current === targetTable || current.replace(/s$/, '') === targetTable.replace(/s$/, '')) return path

    for (const edge of schemaRelations) {
      if (edge.fromTable === current && !visited.has(edge.toTable)) {
        visited.add(edge.toTable)
        queue.push({
          current: edge.toTable,
          path: [...path, { table: edge.toTable, on: \`"\${edge.toTable}"."\${edge.toCol}" = "\${edge.fromTable}"."\${edge.fromCol}"\` }]
        })
      } else if (edge.toTable === current && !visited.has(edge.fromTable)) {
        visited.add(edge.fromTable)
        queue.push({
          current: edge.fromTable,
          path: [...path, { table: edge.fromTable, on: \`"\${edge.fromTable}"."\${edge.fromCol}" = "\${edge.toTable}"."\${edge.toCol}"\` }]
        })
      }
    }
  }
  return null
}

export async function get${model.name}List(opts?: { dateField?: string; startDate?: string; endDate?: string; limit?: number; filters?: Record<string, any> }) {
  const conditions: string[] = []
  const params: any[] = []
  if (opts?.dateField && opts.startDate) {
    params.push(opts.startDate)
    conditions.push(\`"\${opts.dateField}" >= $\${params.length}\`)
  }
  if (opts?.dateField && opts.endDate) {
    params.push(opts.endDate + 'T23:59:59')
    conditions.push(\`"\${opts.dateField}" <= $\${params.length}\`)
  }
  if (opts?.filters && typeof opts.filters === 'object') {
    const ignoredKeys = new Set(['sort_by', 'sort_order', 'page', 'limit', 'embedded', 'view_mode', 'layout', 'search'])
    for (const [rawKey, rawVal] of Object.entries(opts.filters)) {
      if (rawVal === undefined || rawVal === null || rawVal === '') continue
      const key = rawKey.trim()
      if (ignoredKeys.has(key.toLowerCase())) continue

      if (key.includes('.')) {
        const [targetTable, targetCol] = key.split('.')
        const tTable = targetTable.toLowerCase()
        const tCol = targetCol.toLowerCase()
        if (tTable === '${modelTableLower}' || tTable.replace(/s$/, '') === '${modelTableLower}'.replace(/s$/, '')) {
          params.push(rawVal)
          conditions.push(\`"\${tCol}"::text = $\${params.length}::text\`)
        } else {
          const path = findRelationPath('${modelTableLower}', tTable)
          if (path && path.length > 0) {
            params.push(rawVal)
            const fromClause = \`"\${path[0].table}"\`
            const joinClauses = path.slice(1).map(p => \`JOIN "\${p.table}" ON \${p.on}\`).join(' ')
            const whereOn = path[0].on
            const actualTargetTable = path[path.length - 1].table
            const whereTarget = \`"\${actualTargetTable}"."\${tCol}"::text = $\${params.length}::text\`
            conditions.push(\`EXISTS (SELECT 1 FROM \${fromClause}\${joinClauses ? ' ' + joinClauses : ''} WHERE \${whereOn} AND \${whereTarget})\`)
          }
        }
      } else if (key.endsWith('_filter')) {
        const col = key.slice(0, -7)
        params.push('%' + rawVal + '%')
        conditions.push(\`"\${col}"::text ILIKE $\${params.length}\`)
      } else if (allowedColumns.has(key)) {
        params.push(rawVal)
        conditions.push(\`"\${key}"::text = $\${params.length}::text\`)
      }
    }
  }
  const where = conditions.length > 0 ? \` WHERE \${conditions.join(' AND ')}\` : ''
  const limitClause = opts?.limit ? \` LIMIT \${opts.limit}\` : ''
  const res = await query(\`SELECT * FROM ${tableRef}\${where} ORDER BY \"${pk}\" DESC\${limitClause}\`, params)
  return res.rows
}

export async function get${model.name}ById(id: string) {
  const res = await query('SELECT * FROM ${tableRef} WHERE "${pk}" = $1', [id])
  return res.rows[0] || null
}

export async function get${model.name}ByField(field: string, value: any) {
  const res = await query(\`SELECT * FROM ${tableRef} WHERE "\${field}" = $1 ORDER BY "${pk}" DESC\`, [value])
  return res.rows
}

export async function create${model.name}(formData: FormData | Record<string, any>) {
  const clean = parsePayload(formData)
  const keys = Object.keys(clean)
  if (keys.length === 0) return null
  const values = Object.values(clean)
  const placeholders = keys.map((_, i) => \`$\${i + 1}\`).join(', ')
  const columns = keys.map(k => \`"\${k}"\`).join(', ')
  
  const res = await query(\`INSERT INTO ${tableRef} (\${columns}) VALUES (\${placeholders}) RETURNING "${pk}"\`, values)
  revalidatePath('/${model.name.toLowerCase()}')
  return res.rows[0] || null
}

export async function update${model.name}(id: string, formData: FormData | Record<string, any>) {
  const clean = parsePayload(formData)
  const keys = Object.keys(clean)
  if (keys.length === 0) {
    revalidatePath('/${model.name.toLowerCase()}')
    return
  }
  const values = Object.values(clean)
  const setString = keys.map((k, i) => \`"\${k}" = $\${i + 1}\`).join(', ')
  
  await query(\`UPDATE ${tableRef} SET \${setString} WHERE "${pk}" = $\${keys.length + 1}\`, [...values, id])
  revalidatePath('/${model.name.toLowerCase()}')
}

export async function delete${model.name}(id: string) {
  try {
${childCleanups ? `${childCleanups}\n` : ''}    await query('DELETE FROM ${tableRef} WHERE "${pk}" = $1', [id])
    revalidatePath('/${model.name.toLowerCase()}')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao excluir em ${model.name}:', err)
    const msg = err?.detail || err?.message || 'Erro ao excluir registro devido a restrições de chave estrangeira.'
    return { success: false, error: msg }
  }
}
`
}

function generateOracleActions(model: ModelNode, allModels: ModelNode[] = []) {
  const pk = model.fields.find(f => f.isPrimary)?.dbColumn || 'id'
  const allColumns = model.fields.map(f => f.dbColumn).join(', ')
  const allowedColsCode = JSON.stringify(model.fields.map(f => f.dbColumn))
  const childRefs = getReferencingFields(model, allModels)
  const childCleanups = childRefs.map(ref => {
    return `    await query('DELETE FROM "${ref.table}" WHERE "${ref.column}" = :id', { id }).catch((e) => console.warn('Aviso ao limpar dependências em ${ref.table}:', e?.message))`
  }).join('\n')

  return `'use server'
import { query } from './db'
import { revalidatePath } from 'next/cache'

${generateParsePayloadCode(model)}

export async function get${model.name}List(opts?: { dateField?: string; startDate?: string; endDate?: string; limit?: number; filters?: Record<string, any> }) {
  const conditions: string[] = []
  const params: Record<string, any> = {}
  if (opts?.dateField && opts.startDate) {
    params['p_startDate'] = opts.startDate
    conditions.push(\`"\${opts.dateField}" >= :p_startDate\`)
  }
  if (opts?.dateField && opts.endDate) {
    params['p_endDate'] = opts.endDate + 'T23:59:59'
    conditions.push(\`"\${opts.dateField}" <= :p_endDate\`)
  }
  const where = conditions.length > 0 ? \` WHERE \${conditions.join(' AND ')}\` : ''
  const fetchFirst = opts?.limit ? \` FETCH FIRST \${opts.limit} ROWS ONLY\` : ''
  const rows = await query(\`SELECT ${allColumns} FROM \"${model.dbTable}\"\${where} ORDER BY \"${pk}\" DESC\${fetchFirst}\`, params)
  return rows
}

export async function get${model.name}ById(id: string) {
  const rows = await query('SELECT ${allColumns} FROM "${model.dbTable}" WHERE "${pk}" = :id', { id })
  return rows[0] || null
}

export async function get${model.name}ByField(field: string, value: any) {
  const rows = await query(\`SELECT ${allColumns} FROM "${model.dbTable}" WHERE "\${field}" = :val ORDER BY "${pk}" DESC\`, { val: value })
  return rows
}

export async function create${model.name}(formData: FormData | Record<string, any>) {
  const clean = parsePayload(formData)
  const keys = Object.keys(clean)
  if (keys.length === 0) return
  const placeholders = keys.map(k => \`:\${k}\`).join(', ')
  const columns = keys.map(k => \`"\${k}"\`).join(', ')
  
  await query(\`INSERT INTO "${model.dbTable}" (\${columns}) VALUES (\${placeholders})\`, clean)
  revalidatePath('/${model.name.toLowerCase()}')
}

export async function update${model.name}(id: string, formData: FormData | Record<string, any>) {
  const clean = parsePayload(formData)
  const keys = Object.keys(clean)
  if (keys.length === 0) {
    revalidatePath('/${model.name.toLowerCase()}')
    return
  }
  const setString = keys.map(k => \`"\${k}" = :\${k}\`).join(', ')
  
  await query(\`UPDATE "${model.dbTable}" SET \${setString} WHERE "${pk}" = :id\`, { ...clean, id })
  revalidatePath('/${model.name.toLowerCase()}')
}

export async function delete${model.name}(id: string) {
  try {
${childCleanups ? `${childCleanups}\n` : ''}    await query('DELETE FROM "${model.dbTable}" WHERE "${pk}" = :id', { id })
    revalidatePath('/${model.name.toLowerCase()}')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao excluir em ${model.name}:', err)
    return { success: false, error: err?.message || 'Erro ao excluir registro.' }
  }
}
`
}

function generateMysqlActions(model: ModelNode, allModels: ModelNode[] = []) {
  const pk = model.fields.find(f => f.isPrimary)?.dbColumn || 'id'
  const allColumns = model.fields.map(f => f.dbColumn).join(', ')
  const allowedColsCode = JSON.stringify(model.fields.map(f => f.dbColumn))
  const childRefs = getReferencingFields(model, allModels)
  const childCleanups = childRefs.map(ref => {
    return `    await query('DELETE FROM \\\`${ref.table}\\\` WHERE \\\`${ref.column}\\\` = ?', [id]).catch((e) => console.warn('Aviso ao limpar dependências em ${ref.table}:', e?.message))`
  }).join('\n')

  return `'use server'
import { query } from './db'
import { revalidatePath } from 'next/cache'

${generateParsePayloadCode(model)}

export async function get${model.name}List(opts?: { dateField?: string; startDate?: string; endDate?: string; limit?: number; filters?: Record<string, any> }) {
  const conditions: string[] = []
  const params: any[] = []
  if (opts?.dateField && opts.startDate) {
    conditions.push('\`' + opts.dateField + '\` >= ?')
    params.push(opts.startDate)
  }
  if (opts?.dateField && opts.endDate) {
    conditions.push('\`' + opts.dateField + '\` <= ?')
    params.push(opts.endDate + 'T23:59:59')
  }
  const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''
  const limitClause = opts?.limit ? ' LIMIT ' + opts.limit : ''
  const rows = await query('SELECT ${allColumns} FROM \`${model.dbTable}\`' + where + ' ORDER BY \`${pk}\` DESC' + limitClause, params)
  return rows
}

export async function get${model.name}ById(id: string) {
  const rows = await query('SELECT ${allColumns} FROM \`${model.dbTable}\` WHERE \`${pk}\` = ?', [id])
  return rows[0] || null
}

export async function get${model.name}ByField(field: string, value: any) {
  const rows = await query(\`SELECT ${allColumns} FROM \\\`${model.dbTable}\\\` WHERE \\\`\${field}\\\` = ? ORDER BY \\\`${pk}\\\` DESC\`, [value])
  return rows
}

export async function create${model.name}(formData: FormData | Record<string, any>) {
  const clean = parsePayload(formData)
  const keys = Object.keys(clean)
  if (keys.length === 0) return
  const values = Object.values(clean)
  const placeholders = keys.map(() => '?').join(', ')
  const columns = keys.map(k => \`\\\`\${k}\\\`\`).join(', ')
  
  await query(\`INSERT INTO \`${model.dbTable}\` (\${columns}) VALUES (\${placeholders})\`, values)
  revalidatePath('/${model.name.toLowerCase()}')
}

export async function update${model.name}(id: string, formData: FormData | Record<string, any>) {
  const clean = parsePayload(formData)
  const keys = Object.keys(clean)
  if (keys.length === 0) {
    revalidatePath('/${model.name.toLowerCase()}')
    return
  }
  const values = Object.values(clean)
  const setString = keys.map(k => \`\\\`\${k}\\\` = ?\`).join(', ')
  
  await query(\`UPDATE \`${model.dbTable}\` SET \${setString} WHERE \`${pk}\` = ?\`, [...values, id])
  revalidatePath('/${model.name.toLowerCase()}')
}

export async function delete${model.name}(id: string) {
  try {
${childCleanups ? `${childCleanups}\n` : ''}    await query('DELETE FROM \`${model.dbTable}\` WHERE \`${pk}\` = ?', [id])
    revalidatePath('/${model.name.toLowerCase()}')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao excluir em ${model.name}:', err)
    return { success: false, error: err?.message || 'Erro ao excluir registro.' }
  }
}
`
}

function generateSqlServerActions(model: ModelNode, allModels: ModelNode[] = []) {
  const pk = model.fields.find(f => f.isPrimary)?.dbColumn || 'id'
  const allColumns = model.fields.map(f => f.dbColumn).join(', ')
  const allowedColsCode = JSON.stringify(model.fields.map(f => f.dbColumn))
  const childRefs = getReferencingFields(model, allModels)
  const childCleanups = childRefs.map(ref => {
    return `    await pool.request().input('cascade_id', id).query('DELETE FROM [${ref.table}] WHERE [${ref.column}] = @cascade_id').catch((e) => console.warn('Aviso ao limpar dependências em ${ref.table}:', e?.message))`
  }).join('\n')

  return `'use server'
import { getPool } from './db'
import { revalidatePath } from 'next/cache'

${generateParsePayloadCode(model)}

export async function get${model.name}List(opts?: { dateField?: string; startDate?: string; endDate?: string; limit?: number; filters?: Record<string, any> }) {
  const pool = await getPool()
  const request = pool.request()
  const conditions: string[] = []
  if (opts?.dateField && opts.startDate) {
    request.input('startDate', opts.startDate)
    conditions.push(\`[\${opts.dateField}] >= @startDate\`)
  }
  if (opts?.dateField && opts.endDate) {
    request.input('endDate', opts.endDate + 'T23:59:59')
    conditions.push(\`[\${opts.dateField}] <= @endDate\`)
  }
  const where = conditions.length > 0 ? \` WHERE \${conditions.join(' AND ')}\` : ''
  const topClause = opts?.limit ? \`TOP (\${opts.limit}) \` : ''
  const result = await request.query(\`SELECT \${topClause}${allColumns} FROM [${model.dbTable}]\${where} ORDER BY [${pk}] DESC\`)
  return result.recordset
}

export async function get${model.name}ById(id: string) {
  const pool = await getPool()
  const result = await pool.request().input('id', id).query('SELECT ${allColumns} FROM [${model.dbTable}] WHERE [${pk}] = @id')
  return result.recordset[0] || null
}

export async function get${model.name}ByField(field: string, value: any) {
  const pool = await getPool()
  const result = await pool.request().input('val', value).query(\`SELECT ${allColumns} FROM [${model.dbTable}] WHERE [\${field}] = @val ORDER BY [${pk}] DESC\`)
  return result.recordset
}

export async function create${model.name}(formData: FormData | Record<string, any>) {
  const clean = parsePayload(formData)
  const keys = Object.keys(clean)
  if (keys.length === 0) return
  const placeholders = keys.map(k => \`@\${k}\`).join(', ')
  const columns = keys.map(k => \`[\${k}]\`).join(', ')
  
  const pool = await getPool()
  const request = pool.request()
  keys.forEach(k => { request.input(k, clean[k] as string) })
  
  await request.query(\`INSERT INTO [${model.dbTable}] (\${columns}) VALUES (\${placeholders})\`)
  revalidatePath('/${model.name.toLowerCase()}')
}

export async function update${model.name}(id: string, formData: FormData | Record<string, any>) {
  const clean = parsePayload(formData)
  const keys = Object.keys(clean)
  if (keys.length === 0) {
    revalidatePath('/${model.name.toLowerCase()}')
    return
  }
  const setString = keys.map(k => \`[\${k}] = @\${k}\`).join(', ')
  
  const pool = await getPool()
  const request = pool.request()
  request.input('pk_id', id)
  keys.forEach(k => { request.input(k, clean[k] as string) })
  
  await request.query(\`UPDATE [${model.dbTable}] SET \${setString} WHERE [${pk}] = @pk_id\`)
  revalidatePath('/${model.name.toLowerCase()}')
}

export async function delete${model.name}(id: string) {
  try {
    const pool = await getPool()
${childCleanups ? `${childCleanups}\n` : ''}    await pool.request().input('id', id).query('DELETE FROM [${model.dbTable}] WHERE [${pk}] = @id')
    revalidatePath('/${model.name.toLowerCase()}')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao excluir em ${model.name}:', err)
    return { success: false, error: err?.message || 'Erro ao excluir registro.' }
  }
}
`
}
