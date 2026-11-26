/** Formatação de valores e datas do painel de cobranças conforme o idioma da tela (a moeda é sempre o real). */

export type UiLanguage = 'pt' | 'en' | 'es' | string

export const localeOf = (language: UiLanguage): string => (language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR')

export function moneyLocale(v: number | string, language: UiLanguage): string {
  const n = Number(v)
  return Number.isFinite(n) ? new Intl.NumberFormat(localeOf(language), { style: 'currency', currency: 'BRL' }).format(n) : ''
}

/** Dia no formato AAAA-MM-DD (ou ISO) escrito como o idioma manda; vazio se não for uma data. */
export function dayLocale(day: string | null | undefined, language: UiLanguage): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day || '')
  if (!m) return ''
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return new Intl.DateTimeFormat(localeOf(language), { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}
