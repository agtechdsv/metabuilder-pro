import { describe, it, expect } from 'vitest'
import { resolvePeriod, formatPeriodDay } from '../period'

const today = new Date(2026, 9, 5) // 05/10/2026

describe('resolvePeriod', () => {
  it('tudo e desconhecido não filtram', () => {
    expect(resolvePeriod('all', undefined, today)).toBeNull()
    expect(resolvePeriod('xyz', undefined, today)).toBeNull()
    expect(resolvePeriod(undefined, undefined, today)).toBeNull()
  })
  it('últimos N dias incluem hoje', () => {
    expect(resolvePeriod('7d', undefined, today)).toEqual({ from: '2026-09-29', to: '2026-10-05' })
    expect(resolvePeriod('30d', undefined, today)).toEqual({ from: '2026-09-06', to: '2026-10-05' })
    expect(resolvePeriod('90d', undefined, today)).toEqual({ from: '2026-07-08', to: '2026-10-05' })
  })
  it('mês atual, mês anterior, 12 meses', () => {
    expect(resolvePeriod('month', undefined, today)).toEqual({ from: '2026-10-01', to: '2026-10-05' })
    expect(resolvePeriod('prev_month', undefined, today)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(resolvePeriod('12m', undefined, today)).toEqual({ from: '2025-11-01', to: '2026-10-05' })
  })
  it('mês anterior em janeiro cai em dezembro do ano anterior', () => {
    expect(resolvePeriod('prev_month', undefined, new Date(2026, 0, 15))).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })
  it('ano atual e ano anterior', () => {
    expect(resolvePeriod('year', undefined, today)).toEqual({ from: '2026-01-01', to: '2026-10-05' })
    expect(resolvePeriod('prev_year', undefined, today)).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })
  it('personalizado exige duas datas válidas em ordem', () => {
    expect(resolvePeriod('custom', { from: '2026-03-01', to: '2026-03-31' }, today)).toEqual({ from: '2026-03-01', to: '2026-03-31' })
    expect(resolvePeriod('custom', { from: '2026-03-31', to: '2026-03-01' }, today)).toBeNull()
    expect(resolvePeriod('custom', { from: '2026-03-01', to: '' }, today)).toBeNull()
    expect(resolvePeriod('custom', { from: "2026-03-01' OR 1=1", to: '2026-03-31' }, today)).toBeNull()
  })
  it('formata o dia', () => expect(formatPeriodDay('2026-03-31')).toBe('31/03/2026'))
})
