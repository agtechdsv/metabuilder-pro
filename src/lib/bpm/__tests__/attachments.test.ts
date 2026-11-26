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

  it('pdf: arquivo válido, várias páginas, cabeçalho e valores formatados em pt-BR; caractere fora do Latin-1 vira ?', () => {
    const zlib = require('node:zlib')
    const big = {
      name: 'consulta',
      columns: [{ key: 'nome', label: 'Nome', type: 'text' }, { key: 'total', label: 'Total', type: 'numeric' }, { key: 'dia', label: 'Data', type: 'timestamp with time zone' }],
      rows: Array.from({ length: 120 }, (_, i) => ({ nome: 'Cliente São João ' + i + (i === 0 ? ' ✓' : ''), total: String(1000 + i * 3.5), dia: new Date(2026, 10, 1 + (i % 25)) })),
    }
    const att = buildAttachment({ format: 'pdf', filename: 'consulta.pdf', dataset: big })
    expect(att.contentType).toBe('application/pdf')
    const buf = Buffer.from(att.content, 'base64')
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    const raw = buf.toString('latin1')
    expect((raw.match(/\/Type \/Page\b(?!s)/g) || []).length).toBeGreaterThanOrEqual(2)
    // junta o conteúdo descomprimido das páginas para conferir o texto desenhado
    let text = ''
    for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      try { text += zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1') } catch { /* fluxo que não é de página */ }
    }
    expect(text).toContain('(Nome)')
    expect(text).toContain('1.000,00')
    expect(text).toContain('Gerado em')
    expect(text).toContain('120 linha\\(s\\)') // no PDF os parênteses do texto são escapados
    expect(text).toMatch(/P.gina 1 de \d/)
    expect(text).toContain('Cliente S')
    expect(text).toContain('0 ?')
  })

  it('pdf sem linhas também é gerado (só o cabeçalho)', () => {
    const att = buildAttachment({ format: 'pdf', filename: 'v.pdf', dataset: { name: 'x', columns: [{ key: 'a', label: 'A', type: 'text' }], rows: [] } })
    expect(Buffer.from(att.content, 'base64').subarray(0, 5).toString()).toBe('%PDF-')
  })
})
