// src/lib/formatters.ts

/**
 * Helper to get nested value from object using dot notation
 */
export const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined
  if (obj[path] !== undefined) return obj[path]
  return path.split('.').reduce((acc, part) => acc && acc[part], obj)
}

/**
 * Funcao para aplicar mascara a uma string
 */
export const applyMask = (value: string | number, mask: string): string => {
  if (!value) return ''
  let normalizedMask = mask
  
  // Se for mscara de moeda
  if (normalizedMask === 'currency' || normalizedMask === 'moeda' || normalizedMask.includes('R$')) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
  }
  
  // Se for mscara numrica
  if (normalizedMask === 'number' || normalizedMask === 'numero') {
    return new Intl.NumberFormat('pt-BR').format(Number(value))
  }
  
  if (mask.includes('0.000,00')) normalizedMask = '0.000,00'
  else if (mask.includes('0.000')) normalizedMask = '0.000'

  if (normalizedMask === '0.000') {
    const num = Number(value)
    if (!isNaN(num)) return num.toLocaleString('pt-BR')
    return String(value)
  }

  if (normalizedMask === '0.000,00') {
    const num = Number(value)
    if (!isNaN(num)) return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return String(value)
  }
  
  const strVal = String(value)
  const numbers = strVal.replace(/\D/g, '')
  let maskedValue = ''
  let numberIndex = 0
  
  for (let i = 0; i < mask.length; i++) {
    if (numberIndex >= numbers.length) break
    
    // Se o caracter da mscara for zero ou # (placeholder de nmero)
    if (mask[i] === '0' || mask[i] === '#') {
      maskedValue += numbers[numberIndex]
      numberIndex++
    } else {
      // Se for caracter fixo (., -, /, etc)
      maskedValue += mask[i]
      // Avancar o indice da string original se o caracter fixo j estiver presente
      if (strVal[numberIndex] === mask[i]) {
        // Correcao de bug: nao deve incrementar numberIndex aqui pois numberIndex eh para 'numbers'
        // Se a intencao era pular a pontuacao na string de entrada, isso j foi resolvido pelo replace(/\D/g, '')
      }
    }
  }
  
  return maskedValue
}

/**
 * Universal formatter for resolving relational IDs and formatting data types natively.
 */
export const formatFieldValue = (
  rawVal: any,
  field: any,
  relationalOptions?: Record<string, any[]>,
  zoneConfig?: any
): string => {
  let displayVal = typeof rawVal === 'object' && rawVal !== null ? JSON.stringify(rawVal) : String(rawVal ?? '')

  if (!field) return displayVal;

  const comp = zoneConfig?.component || field?.config?.grid_config?.component || field?.config?.form_config?.component || field?.config?.component || {}
  
  // 1. Resolve Relational Labels (Enumerations, Relational)
  const isRelComp = ['select', 'radio', 'checkbox', 'Combo (Select)'].includes(comp.type) || comp.options_type === 'relational' || comp.options_type === 'enumeration'
    
  if (isRelComp && relationalOptions && field.id) {
    const options = relationalOptions[field.id] || []
    if (options.length > 0) {
      if (comp.options_type === 'enumeration') {
        const option = options.find((opt: any) => String(opt.value || opt.id) === String(rawVal))
        if (option) {
          displayVal = option.label || option.name
        }
      } else {
        const option = options.find((opt: any) => String(opt.value || opt.id || opt.ID || opt._key) === String(rawVal))
        if (option) {
          if (option.label) {
            displayVal = option.label
          } else {
            // Busca o campo principal de exibio
            const displayField = Object.keys(option).find(k => k.toLowerCase().includes('nome') || k.toLowerCase().includes('titulo') || k.toLowerCase().includes('name') || k.toLowerCase().includes('title'))
            displayVal = displayField ? option[displayField] : (option.nome || option.titulo || option.name || option.title || String(rawVal))
          }
        }
      }
    }
  }

  // Se houver opes fixas
  if (['select', 'radio', 'checkbox'].includes(comp.type) && comp.options_type === 'fixed' && comp.fixed_options) {
    const opts = comp.fixed_options.split(',').map((o: string) => o.split(':'))
    const found = opts.find((o: string[]) => o[1]?.trim() === String(rawVal) || o[0]?.trim() === String(rawVal))
    if (found) {
      displayVal = found[0]?.trim()
    }
  }

  // 2. Format Dates and Datetimes based on Data Type
  const fieldDataType = (field.data_type || '').toLowerCase();
  const isDateType = comp.type === 'date' || (fieldDataType.includes('date') && !fieldDataType.includes('time') && !fieldDataType.includes('timestamp'));
  const isDateTimeType = comp.type === 'datetime-local' || comp.type === 'datetime' || fieldDataType.includes('time') || fieldDataType.includes('timestamp');

  if (displayVal && isDateType) {
    const d = new Date(String(rawVal))
    if (!isNaN(d.getTime())) {
      if (String(rawVal).length <= 10) {
        displayVal = d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
      } else {
        displayVal = d.toLocaleDateString('pt-BR')
      }
    }
  } else if (displayVal && isDateTimeType) {
    const d = new Date(String(rawVal))
    if (!isNaN(d.getTime())) {
      displayVal = d.toLocaleString('pt-BR')
    }
  }

  // 3. Apply Custom String Masks (only for non-date fields to prevent corruption)
  const maskStr = zoneConfig?.content?.mask || comp?.mask || ''
  if (maskStr && !isDateType && !isDateTimeType) {
    displayVal = applyMask(displayVal, maskStr)
  }

  return displayVal;
}
