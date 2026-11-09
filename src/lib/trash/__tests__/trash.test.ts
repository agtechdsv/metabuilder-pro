import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  clampTrashHours, DEFAULT_TRASH_HOURS, describeDuration, removeMenuEntries, restoreMenuEntries, splitRemaining, trashErrorCode, trashExpiresAt, trashRemainingMs, type MenuNode,
} from '../trash'
import { formatDuration, formatSpan } from '../format'

const MENU: MenuNode[] = [
  { id: 'a', type: 'view', target: 'clientes' },
  { id: 'f1', type: 'folder', children: [{ id: 'b', type: 'view', target: 'pedidos' }, { id: 'c', type: 'view', target: 'bi---laboratorio' }, { id: 'd', type: 'link', target: 'https://x' }] },
  { id: 'e', type: 'view', target: 'bi---laboratorio' },
]

describe('prazo da lixeira', () => {
  it('só aceita inteiros de 1 a 720; o resto vira 48', () => {
    expect(clampTrashHours(24)).toBe(24)
    expect(clampTrashHours('72')).toBe(72)
    expect(clampTrashHours(0)).toBe(1)
    expect(clampTrashHours(99999)).toBe(720)
    expect(clampTrashHours(undefined)).toBe(DEFAULT_TRASH_HOURS)
    expect(clampTrashHours('abc')).toBe(DEFAULT_TRASH_HOURS)
  })

  it('o vencimento acompanha o prazo atual (mudar a configuração muda todos os itens)', () => {
    const deleted = '2026-11-09T10:00:00.000Z'
    expect(trashExpiresAt(deleted, 48).toISOString()).toBe('2026-11-11T10:00:00.000Z')
    expect(trashExpiresAt(deleted, 24).toISOString()).toBe('2026-11-10T10:00:00.000Z')
    const now = Date.parse('2026-11-10T12:00:00.000Z')
    expect(trashRemainingMs(deleted, 48, now)).toBeGreaterThan(0)
    expect(trashRemainingMs(deleted, 24, now)).toBeLessThan(0)
  })

  it('descreve em dias a partir de 48 h e em horas no resto', () => {
    expect(describeDuration(48)).toEqual({ n: 2, unit: 'day' })
    expect(describeDuration(72)).toEqual({ n: 3, unit: 'day' })
    expect(describeDuration(24)).toEqual({ n: 24, unit: 'hour' })
    expect(describeDuration(50)).toEqual({ n: 50, unit: 'hour' })
    expect(describeDuration(1)).toEqual({ n: 1, unit: 'hour' })
  })

  it('divide o que falta em dias, horas e minutos', () => {
    expect(splitRemaining(((1 * 24 + 5) * 60 + 20) * 60_000)).toEqual({ days: 1, hours: 5, minutes: 20 })
    expect(splitRemaining(-5)).toEqual({ days: 0, hours: 0, minutes: 0 })
  })

  it('formata com o texto do idioma', () => {
    const t = (k: string) => ({ u_day_one: 'dia', u_day_other: 'dias', u_hour_one: 'hora', u_hour_other: 'horas', u_d: 'd', u_h: 'h', u_min: 'min' } as Record<string, string>)[k.split('.').pop()!] ?? k
    expect(formatDuration(48, t)).toBe('2 dias')
    expect(formatDuration(1, t)).toBe('1 hora')
    expect(formatDuration(12, t)).toBe('12 horas')
    expect(formatSpan(((24 + 12) * 60) * 60_000, t)).toBe('1 d 12 h')
    expect(formatSpan((5 * 60 + 20) * 60_000, t)).toBe('5 h 20 min')
    expect(formatSpan(0, t)).toBe('1 min')
  })
})

describe('itens de menu da lixeira', () => {
  it('tira os itens do caso de uso (também dentro de pastas) e anota onde estavam', () => {
    const { menu, entries } = removeMenuEntries(MENU, 'bi---laboratorio', 'v1')
    expect(JSON.stringify(menu)).not.toContain('bi---laboratorio')
    expect(menu.length).toBe(2)
    expect(entries.map(e => [e.parent_id, e.index, e.item.id])).toEqual([['f1', 1, 'c'], [null, 2, 'e']])
  })

  it('não mexe no menu original nem em outros itens', () => {
    const before = JSON.stringify(MENU)
    const { menu } = removeMenuEntries(MENU, 'bi---laboratorio', 'v1')
    expect(JSON.stringify(MENU)).toBe(before)
    expect(menu[0]).toEqual(MENU[0])
    expect((menu[1].children || []).map(c => c.id)).toEqual(['b', 'd'])
  })

  it('também reconhece o item pelo view_id', () => {
    const { entries } = removeMenuEntries([{ id: 'z', type: 'view', target: 'nome-antigo', view_id: 'v9' }], 'outro', 'v9')
    expect(entries.length).toBe(1)
  })

  it('restaurar devolve o menu como era', () => {
    const { menu, entries } = removeMenuEntries(MENU, 'bi---laboratorio', 'v1')
    expect(restoreMenuEntries(menu, entries)).toEqual(MENU)
  })

  it('se a pasta sumiu, o item volta para a raiz; e nunca duplica', () => {
    const { menu, entries } = removeMenuEntries(MENU, 'bi---laboratorio', 'v1')
    const semPasta = menu.filter(i => i.id !== 'f1')
    const volta = restoreMenuEntries(semPasta, entries)
    expect(volta.map(i => i.id)).toContain('c')
    expect(restoreMenuEntries(volta, entries).filter(i => i.id === 'c').length).toBe(1)
  })

  it('menu vazio ou inválido não quebra', () => {
    expect(removeMenuEntries(null, 'x', 'y')).toEqual({ menu: [], entries: [] })
    expect(restoreMenuEntries(undefined, undefined)).toEqual([])
  })
})

describe('erros das funções SQL', () => {
  it('reconhece os códigos', () => {
    expect(trashErrorCode({ message: 'slug_in_use' })).toBe('slug_in_use')
    expect(trashErrorCode({ message: 'trash_expired' })).toBe('trash_expired')
    expect(trashErrorCode({ code: '42501', message: 'x' })).toBe('limit')
    expect(trashErrorCode({ message: 'new row violates row-level security policy' })).toBe('limit')
    expect(trashErrorCode(new Error('outra coisa'))).toBe('unknown')
  })
})

describe('SQL da lixeira (scripts/lixeira-casos-de-uso.sql)', () => {
  const sql = readFileSync('scripts/lixeira-casos-de-uso.sql', 'utf8')
  it('tem tabela, ajuste global, funções e RLS', () => {
    for (const s of ['create table if not exists public.mb_trash', 'create table if not exists public.platform_settings', 'mb_trash_retention_hours', 'mb_trash_use_case', 'mb_restore_use_case', 'mb_purge_expired_trash', 'enable row level security']) expect(sql, s).toContain(s)
  })
  it('só o servidor grava os ajustes globais (nenhuma policy de escrita em platform_settings)', () => {
    const policies = [...sql.matchAll(/create policy "[^"]+" on public\.platform_settings\s+for (\w+)/g)].map(m => m[1])
    expect(policies).toEqual(['select'])
  })
  it('restaurar confere o prazo, o slug e as chaves estrangeiras', () => {
    for (const s of ['trash_expired', 'slug_in_use', 'already_exists', 'exists (select 1 from public.fields', 'exists (select 1 from public.project_roles']) expect(sql, s).toContain(s)
  })
})

describe('cron da lixeira', () => {
  it('está no vercel.json e lê o prazo configurado', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
    expect(vercel.crons.some((c: any) => c.path === '/api/cron/empty-trash')).toBe(true)
    const route = readFileSync('src/app/api/cron/empty-trash/route.ts', 'utf8')
    expect(route).toContain("'trash_retention_hours'")
    expect(route).toContain('CRON_SECRET')
  })
  it('só o SuperAdmin grava o prazo (a ação confere o perfil)', () => {
    const src = readFileSync('src/app/actions/admin.ts', 'utf8').replace(/\r\n/g, '\n')
    const i = src.indexOf('export async function saveTrashRetention')
    expect(i).toBeGreaterThan(0)
    expect(src.slice(i, i + 200)).toContain('checkSuperAdmin()')
  })
})
