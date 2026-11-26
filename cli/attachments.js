'use strict'

/**
 * Anexos do e-mail das automações: transforma o resultado de uma "Consultar dados" em planilha (xlsx) ou CSV.
 * Função pura (sem rede), para poder ser testada. O envio em si é feito pelo servidor (POST /api/automations/email).
 */

const XLSX = require('xlsx')

const NUMERIC_TYPE = /numeric|decimal|double|real|float|money/i
const INTEGER_TYPE = /^(small|big)?int(eger)?\d*$|serial/i
const DATE_TYPE = /date|time/i

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const CSV_MIME = 'text/csv; charset=utf-8'

/** Valor tipado para a planilha: número como número, data como data, o resto como texto. */
function cellValue(value, type) {
  if (value === null || value === undefined) return ''
  const t = String(type || '')
  if (NUMERIC_TYPE.test(t) || INTEGER_TYPE.test(t)) {
    const n = Number(value)
    return Number.isFinite(n) ? n : String(value)
  }
  if (value instanceof Date) return isNaN(value.getTime()) ? '' : value
  if (DATE_TYPE.test(t) && typeof value === 'string') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? value : d
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}

/** [cabeçalho, ...linhas] do resultado. */
function datasetToRows(dataset) {
  const cols = (dataset && dataset.columns) || []
  const rows = (dataset && dataset.rows) || []
  return [cols.map((c) => c.label || c.key), ...rows.map((r) => cols.map((c) => cellValue(r[c.key], c.type)))]
}

/** Texto de uma célula de CSV (separador ";", como o Excel em português espera). */
function csvCell(v) {
  let text = v instanceof Date ? v.toISOString().slice(0, 19).replace('T', ' ') : String(v)
  // quem abre o CSV no Excel não deve ter uma fórmula executada a partir de dado de tabela
  if (/^[=+\-@]/.test(text) && typeof v !== 'number') text = "'" + text
  return /[";\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
}

/**
 * Gera o arquivo do anexo. Devolve { filename, content (base64), contentType }.
 * `format`: 'xlsx' (padrão) ou 'csv'.
 */
function buildAttachment({ format, filename, dataset }) {
  const aoa = datasetToRows(dataset)
  if (format === 'csv') {
    const text = '﻿' + aoa.map((row) => row.map(csvCell).join(';')).join('\r\n')
    return { filename, content: Buffer.from(text, 'utf8').toString('base64'), contentType: CSV_MIME }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true })
  const cols = (dataset && dataset.columns) || []
  // formato das células por tipo da coluna e largura pelo maior texto
  ws['!cols'] = cols.map((c, i) => ({ wch: Math.min(60, Math.max(10, ...aoa.map((row) => String(row[i] instanceof Date ? 'dd/mm/aaaa hh:mm' : row[i]).length))) }))
  cols.forEach((c, ci) => {
    const t = String(c.type || '')
    for (let ri = 1; ri < aoa.length; ri++) {
      const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })]
      if (!cell) continue
      if (cell.t === 'd') cell.z = 'dd/mm/yyyy hh:mm'
      else if (cell.t === 'n') cell.z = NUMERIC_TYPE.test(t) ? '#,##0.00' : '#,##0'
    }
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: true })
  return { filename, content: Buffer.from(buffer).toString('base64'), contentType: XLSX_MIME }
}

module.exports = { buildAttachment, datasetToRows, cellValue }
