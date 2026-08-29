import { AppAST, ModelNode, FieldNode } from '../ast'

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
    const actionContent = ast.dbStack === 'supabase'
      ? generateSupabaseActions(model)
      : ast.dbStack === 'oracle'
        ? generateOracleActions(model)
        : ast.dbStack === 'mysql'
          ? generateMysqlActions(model)
          : ast.dbStack === 'sqlserver'
            ? generateSqlServerActions(model)
            : generatePgActions(model)

    files.set(`app/actions/${model.name.toLowerCase()}.ts`, actionContent)
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

  return `'use server'
import { createClient } from './db'
import { revalidatePath } from 'next/cache'

export async function get${model.name}List() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('${model.dbTable}').select('*').order('${pk}', { ascending: false })
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

export async function create${model.name}(formData: FormData) {
  const supabase = await createClient()
  const rawData = Object.fromEntries(formData.entries())
  const { error } = await supabase.from('${model.dbTable}').insert([rawData])
  if (error) throw new Error(error.message)
  revalidatePath('/${model.name.toLowerCase()}')
}

export async function update${model.name}(id: string, formData: FormData) {
  const supabase = await createClient()
  const rawData = Object.fromEntries(formData.entries())
  const { error } = await supabase.from('${model.dbTable}').update(rawData).eq('${pk}', id)
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
  const allColumns = model.fields.map((f: FieldNode) => f.dbColumn).join(', ')
  const tableRef = model.dbTable.includes('.')
    ? model.dbTable.split('.').map((p: string) => `"${p}"`).join('.')
    : `"${model.dbTable}"`

  return `'use server'
import { query } from './db'
import { revalidatePath } from 'next/cache'

export async function get${model.name}List() {
  const res = await query('SELECT ${allColumns} FROM ${tableRef} ORDER BY "${pk}" DESC')
  return res.rows
}

export async function get${model.name}ById(id: string) {
  const res = await query('SELECT ${allColumns} FROM ${tableRef} WHERE "${pk}" = $1', [id])
  return res.rows[0] || null
}

export async function get${model.name}ByField(field: string, value: any) {
  const res = await query(\`SELECT ${allColumns} FROM ${tableRef} WHERE "\${field}" = $1 ORDER BY "${pk}" DESC\`, [value])
  return res.rows
}

export async function create${model.name}(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries())
  const keys = Object.keys(rawData)
  const values = Object.values(rawData)
  const placeholders = keys.map((_, i) => \`$\${i + 1}\`).join(', ')
  const columns = keys.map(k => \`"\${k}"\`).join(', ')
  
  await query(\`INSERT INTO ${tableRef} (\${columns}) VALUES (\${placeholders})\`, values)
  revalidatePath('/${model.name.toLowerCase()}')
}

export async function update${model.name}(id: string, formData: FormData) {
  const rawData = Object.fromEntries(formData.entries())
  const keys = Object.keys(rawData)
  const values = Object.values(rawData)
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

  return `'use server'
import { query } from './db'
import { revalidatePath } from 'next/cache'

export async function get${model.name}List() {
  const rows = await query('SELECT ${allColumns} FROM "${model.dbTable}" ORDER BY "${pk}" DESC')
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

export async function create${model.name}(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries())
  const keys = Object.keys(rawData)
  const placeholders = keys.map(k => \`:\${k}\`).join(', ')
  const columns = keys.map(k => \`"\${k}"\`).join(', ')
  
  await query(\`INSERT INTO "${model.dbTable}" (\${columns}) VALUES (\${placeholders})\`, rawData)
  revalidatePath('/${model.name.toLowerCase()}')
}

export async function update${model.name}(id: string, formData: FormData) {
  const rawData = Object.fromEntries(formData.entries())
  const keys = Object.keys(rawData)
  const setString = keys.map(k => \`"\${k}" = :\${k}\`).join(', ')
  
  await query(\`UPDATE "${model.dbTable}" SET \${setString} WHERE "${pk}" = :id\`, { ...rawData, id })
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

  return `'use server'
import { query } from './db'
import { revalidatePath } from 'next/cache'

export async function get${model.name}List() {
  const rows = await query('SELECT ${allColumns} FROM \`${model.dbTable}\` ORDER BY \`${pk}\` DESC')
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

export async function create${model.name}(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries())
  const keys = Object.keys(rawData)
  const values = Object.values(rawData)
  const placeholders = keys.map(() => '?').join(', ')
  const columns = keys.map(k => \`\\\`\${k}\\\`\`).join(', ')
  
  await query(\`INSERT INTO \`${model.dbTable}\` (\${columns}) VALUES (\${placeholders})\`, values)
  revalidatePath('/${model.name.toLowerCase()}')
}

export async function update${model.name}(id: string, formData: FormData) {
  const rawData = Object.fromEntries(formData.entries())
  const keys = Object.keys(rawData)
  const values = Object.values(rawData)
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

  return `'use server'
import { getPool } from './db'
import { revalidatePath } from 'next/cache'

export async function get${model.name}List() {
  const pool = await getPool()
  const result = await pool.request().query('SELECT ${allColumns} FROM [${model.dbTable}] ORDER BY [${pk}] DESC')
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

export async function create${model.name}(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries())
  const keys = Object.keys(rawData)
  const placeholders = keys.map(k => \`@\${k}\`).join(', ')
  const columns = keys.map(k => \`[\${k}]\`).join(', ')
  
  const pool = await getPool()
  const request = pool.request()
  keys.forEach(k => { request.input(k, rawData[k] as string) })
  
  await request.query(\`INSERT INTO [${model.dbTable}] (\${columns}) VALUES (\${placeholders})\`)
  revalidatePath('/${model.name.toLowerCase()}')
}

export async function update${model.name}(id: string, formData: FormData) {
  const rawData = Object.fromEntries(formData.entries())
  const keys = Object.keys(rawData)
  const setString = keys.map(k => \`[\${k}] = @\${k}\`).join(', ')
  
  const pool = await getPool()
  const request = pool.request()
  request.input('pk_id', id)
  keys.forEach(k => { request.input(k, rawData[k] as string) })
  
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
