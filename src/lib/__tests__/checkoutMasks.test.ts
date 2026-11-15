import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { maskCpfCnpj, maskPhone, onlyDigits } from '../checkout/masks'

describe('máscaras do checkout', () => {
  it('CPF e CNPJ, digitando aos poucos', () => {
    expect(maskCpfCnpj('123')).toBe('123')
    expect(maskCpfCnpj('1234')).toBe('123.4')
    expect(maskCpfCnpj('12345678901')).toBe('123.456.789-01')
    expect(maskCpfCnpj('19287384000101')).toBe('19.287.384/0001-01')
    expect(maskCpfCnpj('19.287.384/0001-01999')).toBe('19.287.384/0001-01')
    expect(maskCpfCnpj('')).toBe('')
  })
  it('telefone fixo e celular', () => {
    expect(maskPhone('3')).toBe('(3')
    expect(maskPhone('31984')).toBe('(31) 984')
    expect(maskPhone('3133334444')).toBe('(31) 3333-4444')
    expect(maskPhone('31984838184')).toBe('(31) 98483-8184')
    expect(maskPhone('')).toBe('')
  })
  it('onlyDigits e o checkout aplica as máscaras e envia só dígitos', () => {
    expect(onlyDigits('(31) 98483-8184')).toBe('31984838184')
    const ui = readFileSync('src/components/checkout/CheckoutClient.tsx', 'utf8')
    expect(ui).toContain('setBillingCpfCnpj(maskCpfCnpj(e.target.value))')
    expect(ui).toContain('setBillingPhone(maskPhone(e.target.value))')
    const st = readFileSync('src/components/checkout/hooks/useCheckoutState.ts', 'utf8')
    expect(st).toContain('billingCpfCnpj: onlyDigits(billingCpfCnpj)')
    expect(st).toContain('phone: onlyDigits(billingPhone)')
  })
})
