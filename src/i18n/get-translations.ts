import pt from './translations/pt.json'
import en from './translations/en.json'
import es from './translations/es.json'

const translations = { pt, en, es }

export async function getTranslations(locale: 'pt' | 'en' | 'es') {
  const dict = translations[locale] || translations.pt

  return (key: string, variables?: Record<string, string | number>) => {
    const keys = key.split('.')
    let value: any = dict

    for (const k of keys) {
      value = value?.[k]
    }

    if (typeof value !== 'string') return key

    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, String(v))
      })
    }

    return value
  }
}
