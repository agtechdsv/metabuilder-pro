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

describe('anexo JSON e OFX (os 5 formatos da exportação)', () => {
  const ds = {
    columns: [
      { key: 'id', label: 'id', type: 'integer' },
      { key: 'nome', label: 'Nome', type: 'text' },
      { key: 'valor', label: 'Valor', type: 'numeric' },
      { key: 'dia', label: 'Data', type: 'timestamp with time zone' },
      { key: 'ativo', label: 'Ativo', type: 'boolean' },
      { key: 'obs', label: 'Nome', type: 'text' },
    ],
    rows: [
      { id: 7, nome: 'Ana <b>', valor: '-10.5', dia: new Date(Date.UTC(2026, 10, 2, 15, 0)), ativo: true, obs: 'x' },
      { id: 8, nome: null, valor: '20', dia: null, ativo: false, obs: null },
    ],
  }

  it('json: lista de objetos com o rótulo como chave, tipos preservados e rótulo repetido numerado', () => {
    const att = buildAttachment({ format: 'json', filename: 'r.json', dataset: ds })
    expect(att.contentType).toBe('application/json; charset=utf-8')
    const rows = JSON.parse(Buffer.from(att.content, 'base64').toString('utf8'))
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ id: 7, Nome: 'Ana <b>', Valor: -10.5, Data: '2026-11-02T15:00:00.000Z', Ativo: true, 'Nome (2)': 'x' })
    expect(rows[1]).toEqual({ id: 8, Nome: null, Valor: 20, Data: null, Ativo: false, 'Nome (2)': null })
  })

  it('json sem linhas é uma lista vazia', () => {
    const att = buildAttachment({ format: 'json', filename: 'r.json', dataset: { columns: [{ key: 'a', label: 'A', type: 'text' }], rows: [] } })
    expect(JSON.parse(Buffer.from(att.content, 'base64').toString('utf8'))).toEqual([])
  })

  it('ofx: acha valor, data, descrição e id pelo nome; débito para negativo, crédito para positivo; texto sem < > &', () => {
    const att = buildAttachment({ format: 'ofx', filename: 'r.ofx', dataset: ds })
    expect(att.contentType).toBe('application/x-ofx')
    const text = Buffer.from(att.content, 'base64').toString('utf8')
    expect(text.startsWith('OFXHEADER:100')).toBe(true)
    expect(text).toContain('<TRNTYPE>DEBIT</TRNTYPE>')
    expect(text).toContain('<TRNTYPE>CREDIT</TRNTYPE>')
    expect(text).toContain('<TRNAMT>-10.50</TRNAMT>')
    expect(text).toContain('<TRNAMT>20.00</TRNAMT>')
    expect(text).toContain('<DTPOSTED>20261102150000</DTPOSTED>')
    expect(text).toContain('<FITID>7</FITID>')
    expect(text).toContain('<MEMO>Ana b</MEMO>')
    for (const m of text.matchAll(new RegExp('<MEMO>(.*?)</MEMO>', 'g'))) expect(m[1]).not.toMatch(/[<>&]/)
    expect((text.match(/<STMTTRN>/g) || []).length).toBe(2)
    expect(text.trim().endsWith('</OFX>')).toBe(true)
  })

  it('ofx sem coluna de valor sai com 0,00 (só serve para dados financeiros)', () => {
    const att = buildAttachment({ format: 'ofx', filename: 'r.ofx', dataset: { columns: [{ key: 'x', label: 'Produto', type: 'text' }], rows: [{ x: 'a' }] } })
    const text = Buffer.from(att.content, 'base64').toString('utf8')
    expect(text).toContain('<TRNAMT>0.00</TRNAMT>')
    expect(text).toContain('<MEMO>Transacao 1</MEMO>')
  })
})

describe('xlsx: datas como número de série (Google Planilhas não lê célula de data tipo "d")', () => {
  it('a data vira número com formato de data e volta igual ao ler a planilha', async () => {
    const XLSX = require('xlsx')
    const { buildAttachment } = require('../../../../cli/attachments.js')
    const r = await buildAttachment({ format: 'xlsx', filename: 'x.xlsx', dataset: { columns: [{ key: 'd', label: 'Data', type: 'date' }], rows: [{ d: new Date(2026, 10, 20) }, { d: new Date(2026, 10, 20, 14, 30) }] } })
    const wb = XLSX.read(Buffer.from(r.content, 'base64'), { cellDates: false, cellNF: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    expect(ws.A2.t).toBe('n')
    expect(ws.A2.v).toBe(46346)
    expect(ws.A3.v).toBeCloseTo(46346 + 14.5 / 24, 5)
  })
})
