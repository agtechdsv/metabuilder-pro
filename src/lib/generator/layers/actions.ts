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
      ? generateSupabaseActions(model)
      : ast.dbStack === 'oracle'
        ? generateOracleActions(model)
        : ast.dbStack === 'mysql'
          ? generateMysqlActions(model)
          : ast.dbStack === 'sqlserver'
            ? generateSqlServerActions(model)
            : generatePgActions(model)

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
// ACTIONS GENERATORS
// -----------------------------------------------------------------------------

function generateSupabaseActions(model: ModelNode) {
  const pk = model.fields.find((f: FieldNode) => f.isPrimary)?.dbColumn || 'id'
  const allowedColsCode = JSON.stringify(model.fields.map(f => f.dbColumn))

  return `'use server'
import { createClient } from './db'
import { revalidatePath } from 'next/cache'

const allowedColumns = new Set(${allowedColsCode})

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
    } else if (typeof v === 'string' && v.includes(',')) {
      clean[k] = Number(v.replace(/\\./g, '').replace(',', '.'))
    } else {
      clean[k] = v
    }
  }
  return clean
}

export async function get${model.name}List(opts?: { dateField?: string; startDate?: string; endDate?: string; limit?: number }) {
  const supabase = await createClient()
  let q = supabase.from('${model.dbTable}').select('*').order('${pk}', { ascending: false })
  if (opts?.dateField && opts.startDate) q = q.gte(opts.dateField, opts.startDate)
  if (opts?.dateField && opts.endDate) q = q.lte(opts.dateField, opts.endDate + 'T23:59:59')
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
  const supabase = await createClient()
  const { error } = await supabase.from('${model.dbTable}').delete().eq('${pk}', id)
  if (error) throw new Error(error.message)
  revalidatePath('/${model.name.toLowerCase()}')
}
`
}

function generatePgActions(model: ModelNode) {
  const pk = model.fields.find((f: FieldNode) => f.isPrimary)?.dbColumn || 'id'
  const tableRef = model.dbTable.includes('.')
    ? model.dbTable.split('.').map((p: string) => `"${p}"`).join('.')
    : `"${model.dbTable}"`
  const allowedColsCode = JSON.stringify(model.fields.map(f => f.dbColumn))

  return `'use server'
import { query } from './db'
import { revalidatePath } from 'next/cache'

const allowedColumns = new Set(${allowedColsCode})

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
    } else if (typeof v === 'string' && v.includes(',')) {
      clean[k] = Number(v.replace(/\\./g, '').replace(',', '.'))
    } else {
      clean[k] = v
    }
  }
  return clean
}

export async function get${model.name}List(opts?: { dateField?: string; startDate?: string; endDate?: string; limit?: number }) {
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
  await query('DELETE FROM ${tableRef} WHERE "${pk}" = $1', [id])
  revalidatePath('/${model.name.toLowerCase()}')
}
`
}

function generateOracleActions(model: ModelNode) {
  const pk = model.fields.find(f => f.isPrimary)?.dbColumn || 'id'
  const allColumns = model.fields.map(f => f.dbColumn).join(', ')
  const allowedColsCode = JSON.stringify(model.fields.map(f => f.dbColumn))

  return `'use server'
import { query } from './db'
import { revalidatePath } from 'next/cache'

const allowedColumns = new Set(${allowedColsCode})

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
    } else if (typeof v === 'string' && v.includes(',')) {
      clean[k] = Number(v.replace(/\\./g, '').replace(',', '.'))
    } else {
      clean[k] = v
    }
  }
  return clean
}

export async function get${model.name}List(opts?: { dateField?: string; startDate?: string; endDate?: string; limit?: number }) {
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
  await query('DELETE FROM "${model.dbTable}" WHERE "${pk}" = :id', { id })
  revalidatePath('/${model.name.toLowerCase()}')
}
`
}

function generateMysqlActions(model: ModelNode) {
  const pk = model.fields.find(f => f.isPrimary)?.dbColumn || 'id'
  const allColumns = model.fields.map(f => f.dbColumn).join(', ')
  const allowedColsCode = JSON.stringify(model.fields.map(f => f.dbColumn))

  return `'use server'
import { query } from './db'
import { revalidatePath } from 'next/cache'

const allowedColumns = new Set(${allowedColsCode})

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
    } else if (typeof v === 'string' && v.includes(',')) {
      clean[k] = Number(v.replace(/\\./g, '').replace(',', '.'))
    } else {
      clean[k] = v
    }
  }
  return clean
}

export async function get${model.name}List(opts?: { dateField?: string; startDate?: string; endDate?: string; limit?: number }) {
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
  await query('DELETE FROM \`${model.dbTable}\` WHERE \`${pk}\` = ?', [id])
  revalidatePath('/${model.name.toLowerCase()}')
}
`
}

function generateSqlServerActions(model: ModelNode) {
  const pk = model.fields.find(f => f.isPrimary)?.dbColumn || 'id'
  const allColumns = model.fields.map(f => f.dbColumn).join(', ')
  const allowedColsCode = JSON.stringify(model.fields.map(f => f.dbColumn))

  return `'use server'
import { getPool } from './db'
import { revalidatePath } from 'next/cache'

const allowedColumns = new Set(${allowedColsCode})

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
    } else if (typeof v === 'string' && v.includes(',')) {
      clean[k] = Number(v.replace(/\\./g, '').replace(',', '.'))
    } else {
      clean[k] = v
    }
  }
  return clean
}

export async function get${model.name}List(opts?: { dateField?: string; startDate?: string; endDate?: string; limit?: number }) {
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
  const pool = await getPool()
  await pool.request().input('id', id).query('DELETE FROM [${model.dbTable}] WHERE [${pk}] = @id')
  revalidatePath('/${model.name.toLowerCase()}')
}
`
}
