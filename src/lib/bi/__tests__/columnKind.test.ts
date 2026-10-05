import { describe, it, expect } from 'vitest'
import { biColumnKind, biFieldKind } from '../columnKind'

describe('biColumnKind', () => {
  it.each([
    ['integer', 'number'], ['bigint', 'number'], ['smallint', 'number'], ['numeric', 'number'], ['numeric(12,2)', 'number'],
    ['double precision', 'number'], ['real', 'number'], ['serial', 'number'], ['money', 'number'],
    ['NUMBER', 'number'], ['NUMBER(10,2)', 'number'], ['BINARY_DOUBLE', 'number'], ['FLOAT', 'number'],
    ['timestamp with time zone', 'date'], ['timestamp without time zone', 'date'], ['date', 'date'], ['DATE', 'date'],
    ['TIMESTAMP(6)', 'date'], ['time', 'date'],
    ['text', 'text'], ['character varying', 'text'], ['VARCHAR2', 'text'], ['uuid', 'text'], ['boolean', 'text'],
    ['interval', 'text'], ['point', 'text'], ['jsonb', 'text'], ['', 'text'],
  ])('%s → %s', (t, k) => expect(biColumnKind(t)).toBe(k))

  it('biFieldKind lê data_type ou db_data_type', () => {
    expect(biFieldKind({ data_type: 'integer' })).toBe('number')
    expect(biFieldKind({ db_data_type: 'date' })).toBe('date')
    expect(biFieldKind(undefined)).toBe('text')
  })
})
