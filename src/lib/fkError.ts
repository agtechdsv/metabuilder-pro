/**
 * Descobre, na mensagem de erro de uma exclusão barrada por chave estrangeira, QUAL tabela impede (a que tem registros
 * ligados). Funciona com o texto do PostgreSQL em inglês e em português (`table "pedidos"`, `em "pedidos"`) e com o do Oracle,
 * que só traz o nome da restrição (`ORA-02292: ... (CRM.FK_PEDIDOS_CLIENTE) violated - child record found`).
 */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const isForeignKeyError = (msg: string): boolean =>
  /foreign key|chave estrangeira|ORA-02292|23503/i.test(msg || '')

/** Nome (db_table_name) da tabela que impede a exclusão, ou null quando a mensagem não permite saber. */
export function findBlockingTable(errorMsg: string, tables: string[], current?: string): string | null {
  const msg = String(errorMsg || '')
  const cur = (current || '').toLowerCase()
  const candidates = tables.filter(t => t && t.toLowerCase() !== cur)

  // 1) nome citado entre aspas (o último é o da tabela filha): "pedidos" ou "crm"."pedidos"
  const quoted = [...msg.matchAll(/"([^"]+)"/g)].map(m => m[1].split('.').pop()!.toLowerCase())
  for (let i = quoted.length - 1; i >= 0; i--) {
    const hit = candidates.find(t => t.toLowerCase() === quoted[i])
    if (hit) return hit
  }

  // 2) nome da restrição, entre parênteses (Oracle) ou entre aspas (PostgreSQL): procura o nome de uma tabela dentro dele
  const constraints = [
    ...[...msg.matchAll(/\(([A-Za-z0-9_$.]+)\)/g)].map(m => m[1]),
    ...[...msg.matchAll(/constraint\s+"([^"]+)"/gi)].map(m => m[1]),
    ...[...msg.matchAll(/restri[cç][aã]o\s+"([^"]+)"/gi)].map(m => m[1]),
  ].map(c => c.split('.').pop()!.toLowerCase())
  const byLength = [...candidates].sort((a, b) => b.length - a.length)
  for (const c of constraints) {
    const hit = byLength.find(t => new RegExp(`(^|[^a-z0-9])${esc(t.toLowerCase())}([^a-z0-9]|$)`).test(c))
    if (hit) return hit
  }
  return null
}
