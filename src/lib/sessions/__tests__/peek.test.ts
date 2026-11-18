import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { decidePeek } from '../slotCore'
import { hasAuthCookie } from '../../auth/staleCookies'

const root = resolve(__dirname, '../../../..')
const read = (f: string) => readFileSync(resolve(root, f), 'utf8')

describe('consulta somente leitura da vaga (página inicial pública)', () => {
  const ativa = { revoked_at: null, revoked_reason: null }
  const encerrada = { revoked_at: '2026-11-18T00:13:13Z', revoked_reason: 'idle' }

  it('só fala em "revoked" no modo Valer e com a vaga desta sessão encerrada', () => {
    expect(decidePeek('enforce', encerrada, null)).toEqual({ status: 'revoked', reason: 'idle', by: null })
    const by = { city: 'Belo Horizonte', since: '2026-11-18T00:13:13Z' }
    expect(decidePeek('enforce', { revoked_at: 'x', revoked_reason: 'replaced' }, by)).toEqual({ status: 'revoked', reason: 'replaced', by })
  })

  it('vaga ativa, sem registro ou modo que não vale: nada a mostrar', () => {
    expect(decidePeek('enforce', ativa, null)).toEqual({ status: 'ok' })
    expect(decidePeek('enforce', null, null)).toEqual({ status: 'none' })
    expect(decidePeek('off', encerrada, null)).toEqual({ status: 'off' })
    expect(decidePeek('observe', encerrada, null)).toEqual({ status: 'off' })
  })

  it('hasAuthCookie olha só os nomes dos cookies de login', () => {
    expect(hasAuthCookie({ cookie: 'app-language=pt; sb-abc-auth-token.0=x; sb-abc-auth-token.1=y' })).toBe(true)
    expect(hasAuthCookie({ cookie: 'sb-abc-auth-token=x' })).toBe(true)
    expect(hasAuthCookie({ cookie: 'app-language=pt; mb_device=1' })).toBe(false)
    expect(hasAuthCookie({ cookie: '' })).toBe(false)
  })

  it('a rota só lê com ?peek=1 (sem claimSlot nem cookie) e o serviço não chama função que grava', () => {
    const route = read('src/app/api/session/heartbeat/route.ts')
    const peekBranch = route.slice(route.indexOf("get('peek')"), route.indexOf('const result = await claimSlot'))
    expect(peekBranch).toContain('peekSlot(')
    expect(peekBranch).not.toContain('claimSlot')
    expect(peekBranch).not.toContain('writeSlotCookies')

    const svc = read('src/lib/sessions/slotService.ts')
    const peekFn = svc.slice(svc.indexOf('export async function peekSlot'), svc.indexOf('export type TakeOverOutcome'))
    expect(peekFn).not.toMatch(/\.rpc\(|\.insert\(|\.update\(|\.delete\(|\.upsert\(/) // só select
  })

  it('SessionGuard: a consulta só roda na página inicial com cookie de login e fica antes do return condicional (hooks)', () => {
    const src = read('src/components/auth/SessionGuard.tsx')
    expect(src).toContain("pathname !== '/' || revoked !== false || !hasAuthCookie()")
    expect(src).toContain('/api/session/heartbeat?peek=1')
    expect(src.indexOf('?peek=1')).toBeLessThan(src.indexOf('if (revoked === false) return null'))
  })
})
