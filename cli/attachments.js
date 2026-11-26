'use strict'

/**
 * Anexos do e-mail das automações: transforma o resultado de uma "Consultar dados" em planilha (xlsx) ou CSV.
 * Função pura (sem rede), para poder ser testada. O envio em si é feito pelo servidor (POST /api/automations/email).
 */

const XLSX = require('xlsx')
const { formatCell } = require('./bpmCore')

const NUMERIC_TYPE = /numeric|decimal|double|real|float|money/i
const INTEGER_TYPE = /^(small|big)?int(eger)?\d*$|serial/i
const DATE_TYPE = /date|time/i

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const CSV_MIME = 'text/csv; charset=utf-8'
const PDF_MIME = 'application/pdf'

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
 * PDF do resultado: título, data da geração e uma tabela com cabeçalho repetido a cada página e numeração. Desenhado direto com o
 * jsPDF (fonte padrão, Latin-1: acentos do português saem certos; o que estiver fora disso vira "?").
 */
function buildPdf(dataset, title) {
  // carregado só aqui: quem não gera PDF não paga o custo de carregar a biblioteca
  const { jsPDF } = require('jspdf')
  const cols = (dataset && dataset.columns) || []
  const rows = (dataset && dataset.rows) || []
  const doc = new jsPDF({ orientation: cols.length > 5 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4', compress: true })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 36
  const clean = (v) => String(v == null ? '' : v).replace(/[^\x20-\xFF]/g, '?')
  const numeric = (c) => NUMERIC_TYPE.test(String(c.type || '')) || INTEGER_TYPE.test(String(c.type || ''))

  // larguras proporcionais ao maior texto de cada coluna (amostra das primeiras linhas), com mínimo e máximo
  const weights = cols.map((c) => Math.min(40, Math.max(6, String(c.label || c.key).length, ...rows.slice(0, 200).map((r) => clean(formatCell(r[c.key], c.type)).length))))
  const total = weights.reduce((a, b) => a + b, 0) || 1
  const colW = weights.map((w) => ((W - 2 * M) * w) / total)

  const now = new Date()
  const p2 = (n) => String(n).padStart(2, '0')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(30, 41, 59)
  doc.text(clean(title), M, M + 6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  doc.text(`Gerado em ${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear()} ${p2(now.getHours())}:${p2(now.getMinutes())}  -  ${rows.length} linha(s)`, M, M + 20)

  let y = M + 38
  const header = () => {
    doc.setFillColor(241, 245, 249); doc.rect(M, y - 10, W - 2 * M, 16, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(30, 41, 59)
    let x = M
    cols.forEach((c, i) => {
      const text = doc.splitTextToSize(clean(c.label || c.key), colW[i] - 6)[0] || ''
      if (numeric(c)) doc.text(text, x + colW[i] - 3, y, { align: 'right' }); else doc.text(text, x + 3, y)
      x += colW[i]
    })
    y += 14
    doc.setFont('helvetica', 'normal'); doc.setTextColor(51, 65, 85)
  }
  header()

  for (const r of rows) {
    // até 3 linhas de texto por célula; a altura da linha acompanha a célula mais alta
    const cells = cols.map((c, i) => doc.splitTextToSize(clean(formatCell(r[c.key], c.type)), colW[i] - 6).slice(0, 3))
    const lines = Math.max(1, ...cells.map((c) => c.length))
    const rowH = lines * 10 + 4
    if (y + rowH > H - M) { doc.addPage(); y = M + 10; header() }
    let x = M
    cols.forEach((c, i) => {
      cells[i].forEach((line, li) => {
        if (numeric(c)) doc.text(line, x + colW[i] - 3, y + li * 10, { align: 'right' }); else doc.text(line, x + 3, y + li * 10)
      })
      x += colW[i]
    })
    doc.setDrawColor(226, 232, 240); doc.line(M, y + rowH - 8, W - M, y + rowH - 8)
    y += rowH
  }

  const pages = doc.getNumberOfPages()
  doc.setFontSize(7); doc.setTextColor(148, 163, 184)
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.text(`Página ${i} de ${pages}`, W - M, H - 18, { align: 'right' }) }
  return Buffer.from(doc.output('arraybuffer'))
}

/**
 * Gera o arquivo do anexo. Devolve { filename, content (base64), contentType }.
 * `format`: 'xlsx' (padrão), 'csv' ou 'pdf'.
 */
function buildAttachment({ format, filename, dataset }) {
  if (format === 'pdf') {
    const title = (dataset && dataset.title) || `Relatório - ${(dataset && dataset.name) || 'consulta'}`
    return { filename, content: buildPdf(dataset, title).toString('base64'), contentType: PDF_MIME }
  }
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
      if (cell.t === 'd' && cell.v instanceof Date) {
        // número de série do Excel (hora local): o Google Planilhas não mostra célula de data do tipo "d"
        const d = cell.v
        const serial = (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) - Date.UTC(1899, 11, 30)) / 86400000
        cell.t = 'n'
        cell.v = serial
        cell.z = d.getHours() || d.getMinutes() || d.getSeconds() ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy'
      } else if (cell.t === 'd') cell.z = 'dd/mm/yyyy hh:mm'
      else if (cell.t === 'n') cell.z = NUMERIC_TYPE.test(t) ? '#,##0.00' : '#,##0'
    }
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: true })
  return { filename, content: Buffer.from(buffer).toString('base64'), contentType: XLSX_MIME }
}

module.exports = { buildAttachment, datasetToRows, cellValue }
