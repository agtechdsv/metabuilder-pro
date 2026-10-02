/**
 * Conversão de valores de formulário para o tipo da coluna antes de enviar ao banco.
 * Texto numérico (ex.: "0.01") enviado a uma coluna NUMBER no Oracle falha com ORA-01722 quando a sessão usa
 * vírgula como separador decimal; por isso colunas numéricas devem receber número, não texto.
 */

/** O tipo de dado da coluna (db_data_type) é numérico? */
export function isNumericDbType(dbDataType?: string | null): boolean {
  const t = (dbDataType || '').toLowerCase()
  return (
    t.startsWith('number') || t.startsWith('numeric') || t.startsWith('int') || t.startsWith('float') ||
    t.startsWith('decimal') || t.startsWith('double') || t.startsWith('real') || t.startsWith('bigint') ||
    t.startsWith('smallint')
  )
}

/**
 * Converte número ou texto numérico em number. Retorna null se não for um número válido.
 * - "0.01" / "12" / "-3.5"  → ponto como decimal (como o formulário guarda internamente)
 * - "8.500,50" / "0,01"     → formato pt-BR (ponto = milhar, vírgula = decimal)
 */
export function parseNumericLoose(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (s === '') return null
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  if (s.includes(',')) {
    const n = Number(s.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}
