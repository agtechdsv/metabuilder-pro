import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

// CommonJS do Agente CLI
const require = createRequire(import.meta.url)
const { buildAttachment } = require('../../../../cli/attachments.js') as { buildAttachment: (a: any) => { filename: string; content: string; contentType: string } }
const XLSX = require('xlsx')

const dataset = {
  columns: [
    { key: 'nome', label: 'Nome', type: 'text' },
    { key: 'total', label: 'Total', type: 'numeric' },
    { key: 'qtd', label: 'Quantidade', type: 'integer' },
    { key: 'dia', label: 'Data', type: 'timestamp with time zone' },
  ],
  rows: [
    { nome: 'Ana; "Silva"', total: '1500.5', qtd: '3', dia: new Date(2026, 10, 20, 14, 5) },
    { nome: '=SOMA(A1)', total: null, qtd: '0', dia: null },
  ],
}

describe('anexo de planilha das automações', () => {
  it('xlsx: cabeçalho com os rótulos, números como número e data como data', () => {
    const att = buildAttachment({ format: 'xlsx', filename: 'consulta.xlsx', dataset })
    expect(att.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    const wb = XLSX.read(Buffer.from(att.content, 'base64'), { type: 'buffer', cellDates: true })
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
    expect(rows[0]).toEqual(['Nome', 'Total', 'Quantidade', 'Data'])
    expect(rows[1][0]).toBe('Ana; "Silva"')
    expect(rows[1][1]).toBe(1500.5)
    expect(rows[1][2]).toBe(3)
    expect(rows[1][3]).toBeInstanceOf(Date)
    expect(rows[2][1]).toBe('')
  })

  it('csv: ponto e vírgula, BOM para o Excel, aspas escapadas e fórmula neutralizada', () => {
    const att = buildAttachment({ format: 'csv', filename: 'consulta.csv', dataset })
    expect(att.contentType).toContain('text/csv')
    const text = Buffer.from(att.content, 'base64').toString('utf8')
    expect(text.charCodeAt(0)).toBe(0xfeff)
    const lines = text.slice(1).split('\r\n')
    expect(lines[0]).toBe('Nome;Total;Quantidade;Data')
    expect(lines[1].startsWith('"Ana; ""Silva""";1500.5;3;')).toBe(true)
    // célula que começa com = vira texto (não executa fórmula ao abrir no Excel)
    expect(lines[2].startsWith("'=SOMA(A1);")).toBe(true)
  })
})
