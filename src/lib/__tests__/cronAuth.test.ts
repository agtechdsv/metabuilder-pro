import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { isCronAuthorized } from '../cronAuth'

const call = (authorization?: string) => new Request('https://x.test/api/cron/x', { headers: authorization ? { authorization } : {} })

describe('autenticação das rotinas agendadas (/api/cron/*)', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('em produção sem CRON_SECRET recusa tudo, inclusive "Bearer undefined" (antes isso passava)', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', '')
    expect(isCronAuthorized(call('Bearer undefined'))).toBe(false)
    expect(isCronAuthorized(call('Bearer '))).toBe(false)
    expect(isCronAuthorized(call())).toBe(false)
    vi.stubEnv('CRON_SECRET', '   ')
    expect(isCronAuthorized(call('Bearer    '))).toBe(false)
  })

  it('em produção com o segredo aceita só o cabeçalho exato', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'um-segredo-longo-e-aleatorio')
    expect(isCronAuthorized(call('Bearer um-segredo-longo-e-aleatorio'))).toBe(true)
    expect(isCronAuthorized(call('Bearer um-segredo-longo-e-aleatori'))).toBe(false)
    expect(isCronAuthorized(call('Bearer um-segredo-longo-e-aleatorio-mais'))).toBe(false)
    expect(isCronAuthorized(call('um-segredo-longo-e-aleatorio'))).toBe(false)
    expect(isCronAuthorized(call('Bearer outro'))).toBe(false)
    expect(isCronAuthorized(call())).toBe(false)
  })

  it('fora da produção (desenvolvimento) continua livre, como era', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('CRON_SECRET', '')
    expect(isCronAuthorized(call())).toBe(true)
  })

  it('toda rota de /api/cron usa a conferência central e nenhuma compara com Bearer ${CRON_SECRET} à mão', () => {
    const dir = 'src/app/api/cron'
    const routes = readdirSync(dir).map(n => `${dir}/${n}/route.ts`)
    expect(routes.length).toBeGreaterThanOrEqual(5)
    for (const f of routes) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).toContain('isCronAuthorized(req)')
      expect(src, f).not.toContain('process.env.CRON_SECRET')
    }
  })
})
