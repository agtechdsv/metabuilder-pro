/**
 * Valores de exemplo para o gerador automático da Ajuda Interativa.
 * Regra (da mais forte para a mais fraca): tipo/formato configurado no campo → nome da coluna → "<Rótulo> 01".
 * Os valores são FIXOS (nunca aleatórios), para o tutorial ser igual a cada execução.
 */

export interface SampleField {
  /** nome da coluna no banco */
  column: string
  /** rótulo mostrado na tela */
  label: string
  /** tipo de dado do banco (text, integer, numeric, date, timestamp..., uuid) */
  dataType?: string
  /** tipo do componente no Studio (text, number, date, select, textarea, checkbox...) */
  component?: string
  /** formato configurado (currency, percent, date_pt...) */
  format?: string
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// CNPJ e CPF de exemplo com dígito verificador válido (passam em validação de formato)
const CNPJ = '11.222.333/0001-81'
const CPF = '111.444.777-35'

interface Rule { test: RegExp; value: string; kind?: 'number' | 'date' }

// Ordem importa: a primeira que casar vence. As expressões olham o nome da coluna e o rótulo, sem acento.
const RULES: Rule[] = [
  { test: /e-?mail/, value: 'exemplo@empresa.com.br' },
  { test: /cnpj/, value: CNPJ },
  { test: /\bcpf\b/, value: CPF },
  { test: /(telefone|celular|fone|phone|whatsapp)/, value: '(11) 91234-5678' },
  { test: /\bcep\b|zip|postal/, value: '01310-100' },
  { test: /(site|url|link|website)/, value: 'https://www.exemplo.com.br' },
  { test: /(latitude|\blat\b|lat_)/, value: '-23.5505', kind: 'number' },
  { test: /(longitude|\blng\b|\blon\b|lng_|lon_)/, value: '-46.6333', kind: 'number' },
  { test: /(percent|conclusao|progresso)/, value: '50', kind: 'number' },
  { test: /(preco|valor|price|amount|custo|total)/, value: '99.90', kind: 'number' },
  { test: /(quantidade|qtd|qty|estoque|unidades)/, value: '10', kind: 'number' },
  { test: /(endereco|address|logradouro|\brua\b)/, value: 'Rua das Flores, 123 - Centro' },
  { test: /(cidade|city|municipio)/, value: 'São Paulo' },
  { test: /\b(uf|estado)\b/, value: 'SP' },
  { test: /(descricao|description|observ|obs\b|detalhe)/, value: 'Texto de exemplo para a descrição.' },
]

const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

/** Hoje (data) ou hoje + 7 dias para campos de prazo (vencimento, entrega, previsão...) */
function sampleDate(field: SampleField, today: Date): string {
  const key = norm(`${field.column} ${field.label}`)
  return isoDate(/(vencimento|entrega|previs|estimad|prazo|\bfim\b|termino|validade)/.test(key) ? addDays(today, 7) : today)
}

/**
 * Valor de exemplo para digitar no campo. `today` é injetável para os testes.
 * Devolve `null` quando o campo não deve ser digitado (ex.: lista, que o gerador trata como "escolher a primeira opção").
 */
export function sampleValue(field: SampleField, today: Date = new Date()): string | null {
  const comp = norm(field.component || '')
  const type = norm(field.dataType || '')

  if (/select|combo|dropdown|autocomplete|radio/.test(comp)) return null
  if (/checkbox|boolean|switch/.test(comp) || type === 'boolean') return 'true'

  const key = norm(`${field.column} ${field.label}`)
  if (/^(date|datetime|data)$/.test(comp) || /^(date|timestamp)/.test(type)) return sampleDate(field, today)

  for (const rule of RULES) if (rule.test.test(key)) return rule.value

  if (field.format === 'currency') return '99.90'
  if (field.format === 'percent') return '50'
  if (/(int|numeric|decimal|float|double|real|number|serial)/.test(type) || /number/.test(comp)) return /int|serial/.test(type) ? '1' : '10'

  return `${field.label} 01`
}

/** Valor para EDITAR: o de exemplo com um sufixo/ajuste visível, para o usuário perceber que mudou. */
export function editedValue(field: SampleField, today: Date = new Date()): string | null {
  const base = sampleValue(field, today)
  if (base === null) return null
  if (base === 'true') return 'false'
  if (/^-?\d+([.,]\d+)?$/.test(base)) return String(Number(base.replace(',', '.')) + 1)
  if (/^\d{4}-\d{2}-\d{2}$/.test(base)) return isoDate(addDays(new Date(base + 'T00:00:00Z'), 1))
  if (/@/.test(base)) return base.replace('@', '.novo@')
  if (/^https?:\/\//.test(base)) return base
  if (/^[\d./()\- ]+$/.test(base)) return base // CNPJ, CPF, telefone, CEP: mantém um formato válido
  return `${base} (editado)`
}
