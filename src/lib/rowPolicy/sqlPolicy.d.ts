// Tipos do módulo cli/sqlPolicy.js (JavaScript puro, sem dependências). Este arquivo só é copiado, junto com o .js, para dentro do
// app exportado (lib/rowPolicy/): lá o TypeScript precisa de tipos para importar o módulo. Veja scripts/gen-bi-runtime.mjs.

export class PolicyError extends Error {}

export interface SqlAccess {
  policies: Array<{ table: string; deny?: boolean; conds: Array<{ column: string; op: string; values: string[]; related?: { table: string; key: string; column: string } }> }>
  flags: Record<string, { create?: boolean; update?: boolean; delete?: boolean }>
  audit?: Record<string, { createdAt?: string; createdBy?: string; updatedAt?: string; updatedBy?: string; actor?: string | null }>
}

export function applyToSelect(sql: string, access: SqlAccess, opts?: { dbType?: string }): string
export function guardCustom(sql: string, access: SqlAccess, opts?: { dbType?: string }): string
export function enforceWrite(args: {
  access: SqlAccess
  action: 'insert' | 'update' | 'delete'
  table: string
  data?: Record<string, any>
  idColumn?: string
  idValue?: any
  dbType?: string
  query: (sql: string) => Promise<any[]>
  /** false = não confere as linhas atingidas (quem chama garante pelo WHERE) */
  checkRows?: boolean
}): Promise<Record<string, any> | undefined>
export function applyAudit(access: SqlAccess, table: string, action: 'insert' | 'update', data?: Record<string, any>): Record<string, any> | undefined
export function flagAllowed(access: SqlAccess, table: string, kind: 'create' | 'update' | 'delete'): boolean
export function policySql(policy: any, qualifier: string | null, dbType?: string): string
export function condSql(cond: any, qualifier: string | null, dbType?: string): string
export function literal(value: unknown, dbType?: string): string
export function tokenize(sql: string): any[]
