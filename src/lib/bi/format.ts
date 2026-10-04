/**
 * Formatação de valores dos widgets de BI (KPI, gauge, eixos, tooltips, rótulos).
 * Mantida sem dependências para poder ser copiada também para o app exportado.
 */

export type BiFormat = 'number' | 'currency' | 'currency_compact' | 'compact' | 'percent'

export const BI_FORMAT_OPTIONS: { value: BiFormat; label: string }[] = [
  { value: 'number', label: 'Número (1.234,56)' },
  { value: 'currency', label: 'Moeda (R$ 1.234,56)' },
  { value: 'currency_compact', label: 'Moeda abreviada (R$ 1,2 mi)' },
  { value: 'compact', label: 'Abreviado (1,2 mi)' },
  { value: 'percent', label: 'Percentual (12,5%)' },
]

export interface BiFormatOptions {
  format?: string
  decimals?: number
  currency?: string
  /** 'pt-BR' | 'en-US' | 'es-ES' */
  locale: string
}

const DEFAULT_CURRENCY: Record<string, string> = { 'pt-BR': 'BRL', 'en-US': 'USD', 'es-ES': 'EUR' }

/** Paleta de cor principal por widget (barras, linhas e áreas). */
export const BI_PALETTES: Record<string, { label: string; color: string }> = {
  indigo: { label: 'Índigo', color: '#6366f1' },
  emerald: { label: 'Verde', color: '#10b981' },
  sky: { label: 'Azul', color: '#0ea5e9' },
  violet: { label: 'Violeta', color: '#8b5cf6' },
  amber: { label: 'Âmbar', color: '#f59e0b' },
  rose: { label: 'Rosa', color: '#f43f5e' },
  slate: { label: 'Grafite', color: '#64748b' },
}

export function biPrimaryColor(color?: string): string {
  return (color && BI_PALETTES[color]?.color) || BI_PALETTES.indigo.color
}

/**
 * @param axis true nos rótulos de eixo: sempre abreviado, para não ocupar a largura do gráfico
 *             (R$ 28.000.000,00 vira R$ 28 mi).
 */
export function formatBiValue(val: any, opts: BiFormatOptions, axis = false): string {
  if (val === null || val === undefined || val === '') return ''
  const num = Number(val)
  if (!Number.isFinite(num)) return String(val)

  const locale = opts.locale || 'pt-BR'
  const currency = opts.currency || DEFAULT_CURRENCY[locale] || 'BRL'
  const dec = Number.isFinite(opts.decimals) ? Math.max(0, Math.min(6, Math.trunc(opts.decimals as number))) : undefined
  let format = opts.format || 'number'

  if (axis) {
    if (format === 'currency') format = 'currency_compact'
    else if (format === 'number') format = 'compact'
  }

  try {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: dec ?? 2, maximumFractionDigits: dec ?? 2 }).format(num)
      case 'currency_compact':
        return new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', compactDisplay: 'short', maximumFractionDigits: axis ? Math.min(dec ?? 1, 1) : (dec ?? 1) }).format(num)
      case 'compact':
        return new Intl.NumberFormat(locale, { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: axis ? Math.min(dec ?? 1, 1) : (dec ?? 1) }).format(num)
      case 'percent':
        return `${new Intl.NumberFormat(locale, { maximumFractionDigits: dec ?? 1 }).format(num)}%`
      default:
        return new Intl.NumberFormat(locale, { maximumFractionDigits: dec ?? 2, minimumFractionDigits: dec ?? 0 }).format(num)
    }
  } catch {
    return String(num)
  }
}
