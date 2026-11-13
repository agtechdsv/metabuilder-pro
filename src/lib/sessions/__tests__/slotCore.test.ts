import { describe, it, expect } from 'vitest'
import {
  chooseUrl, clientIp, codeMatches, decideGate, describeClient, generateCode, geoFromHeaders, hashCode, hashIp, isProtectedApiPath, isProtectedPath, isUuid,
  parseKind, parseMode, placeText, revokedUrl, safeNext, sessionIdFromJwt, signSlotCookie, slotSecret, verifySlotCookie,
  type SlotResult,
} from '../slotCore'

const SECRET = 'segredo-de-teste'
const SID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'
const DEV = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

const jwt = (payload: object) => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.assinatura`
}

describe('vagas de sessão: áreas protegidas', () => {
  it('protege as áreas da plataforma e deixa o resto de fora', () => {
    for (const p of ['/admin', '/admin/platform', '/admin/ws/proj/studio', '/client/dashboard', '/workspace', '/ide-local', '/bpm', '/tunnel-logs', '/parceiro', '/client/dashboard/']) {
      expect(isProtectedPath(p), p).toBe(true)
    }
    for (const p of ['/', '/login', '/auth/callback', '/auth/sessao-ativa', '/parceiros', '/features/tour', '/privacy', '/terms', '/checkout', '/kika-projetos/vendas-pg/clientes', '/adminx', '/clients']) {
      expect(isProtectedPath(p), p).toBe(false)
    }
  })

  it('protege as rotas de API sensíveis e deixa de fora o batimento, o login, o túnel, o cron e o runtime', () => {
    for (const p of ['/api/admin/release', '/api/ai-builder/chat', '/api/build-desktop', '/api/export-workspace', '/api/export-native', '/api/byoc/compile', '/api/domains', '/api/metadata/reconcile', '/api/workspace-source', '/api/project-source']) {
      expect(isProtectedPath(p), p).toBe(true)
      expect(isProtectedApiPath(p), p).toBe(true)
    }
    for (const p of ['/api/session/heartbeat', '/api/auth/passkeys/authenticate/verify', '/api/tunnel/process', '/api/tunnel/config', '/api/cron/empty-trash', '/api/runtime/analytics-config', '/api/crypto/hash', '/api/administrator']) {
      expect(isProtectedPath(p), p).toBe(false)
    }
  })
})

describe('vagas de sessão: leitura do cliente', () => {
  it('tipo e modo desconhecidos caem no valor seguro', () => {
    expect(parseKind('ide')).toBe('ide')
    expect(parseKind('web')).toBe('web')
    expect(parseKind('qualquer')).toBe('web')
    expect(parseKind(undefined)).toBe('web')
    expect(parseMode('enforce')).toBe('enforce')
    expect(parseMode('observe')).toBe('observe')
    expect(parseMode('x')).toBe('off')
    expect(parseMode(undefined)).toBe('off')
  })

  it('extrai o session_id do JWT e recusa o que não for um UUID', () => {
    expect(sessionIdFromJwt(jwt({ session_id: SID, sub: 'u' }))).toBe(SID)
    expect(sessionIdFromJwt(jwt({ session_id: 'nao-uuid' }))).toBeNull()
    expect(sessionIdFromJwt(jwt({ sub: 'u' }))).toBeNull()
    expect(sessionIdFromJwt('lixo')).toBeNull()
    expect(sessionIdFromJwt(null)).toBeNull()
    expect(isUuid(SID)).toBe(true)
    expect(isUuid('abc')).toBe(false)
  })

  it('descreve navegador e sistema com o mesmo texto em qualquer idioma', () => {
    const chromeWin = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
    const edgeWin = chromeWin + ' Edg/130.0'
    const firefoxMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0'
    const safariIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
    expect(describeClient(chromeWin, 'web')).toBe('Chrome · Windows')
    expect(describeClient(edgeWin, 'web')).toBe('Edge · Windows')
    expect(describeClient(firefoxMac, 'web')).toBe('Firefox · macOS')
    expect(describeClient(safariIos, 'web')).toBe('Safari · iOS')
    expect(describeClient(chromeWin, 'ide')).toBe('IDE · Windows')
    expect(describeClient('', 'ide')).toBe('IDE')
    expect(describeClient(null, 'web')).toBe('Navegador')
  })

  it('cidade e região vêm dos cabeçalhos da Vercel (com acento codificado) e o IP vem do primeiro da lista', () => {
    const h: Record<string, string> = { 'x-vercel-ip-city': 'Belo%20Horizonte', 'x-vercel-ip-country-region': 'MG', 'x-vercel-ip-country': 'BR', 'x-forwarded-for': '200.1.2.3, 10.0.0.1' }
    const get = (n: string) => h[n]
    expect(geoFromHeaders(get)).toEqual({ city: 'Belo Horizonte', region: 'MG', country: 'BR' })
    expect(geoFromHeaders(() => null)).toEqual({ city: null, region: null, country: null })
    expect(clientIp(get)).toBe('200.1.2.3')
    expect(clientIp(() => null)).toBeNull()
    expect(placeText({ city: 'Belo Horizonte', region: 'MG' })).toBe('Belo Horizonte, MG')
    expect(placeText({ country: 'BR' })).toBe('BR')
    expect(placeText(null, '?')).toBe('?')
  })
})

describe('vagas de sessão: cookie assinado', () => {
  const claims = { sessionId: SID, kind: 'ide' as const, deviceId: DEV }

  it('aceita o cookie válido e recusa adulteração, vencimento e troca de sessão, tipo ou dispositivo', async () => {
    const now = 1_700_000_000_000
    const c = await signSlotCookie(claims, 60, SECRET, now)
    expect(await verifySlotCookie(c, claims, SECRET, now + 30_000)).toBe(true)
    expect(await verifySlotCookie(c, claims, SECRET, now + 61_000)).toBe(false)
    expect(await verifySlotCookie(c, { ...claims, sessionId: '11111111-1111-4111-8111-111111111111' }, SECRET, now)).toBe(false)
    expect(await verifySlotCookie(c, { ...claims, kind: 'web' }, SECRET, now)).toBe(false)
    expect(await verifySlotCookie(c, { ...claims, deviceId: '22222222-2222-4222-8222-222222222222' }, SECRET, now)).toBe(false)
    expect(await verifySlotCookie(c, claims, 'outro-segredo', now)).toBe(false)
    expect(await verifySlotCookie(c.slice(0, -2) + 'xx', claims, SECRET, now)).toBe(false)
    expect(await verifySlotCookie(c.replace(/\.\d+\./, '.9999999999.'), claims, SECRET, now)).toBe(false)
    expect(await verifySlotCookie(undefined, claims, SECRET, now)).toBe(false)
    expect(await verifySlotCookie('a.b.c', claims, SECRET, now)).toBe(false)
  })

  it('sem segredo configurado, nada é aceito', async () => {
    const c = await signSlotCookie(claims, 60, SECRET)
    expect(await verifySlotCookie(c, claims, '')).toBe(false)
    expect(slotSecret({})).toBe('')
    expect(slotSecret({ SUPABASE_SERVICE_ROLE_KEY: 'k' })).toBe('k')
    expect(slotSecret({ SUPABASE_SERVICE_ROLE_KEY: 'k', DEVICE_SLOT_SECRET: 's' })).toBe('s')
  })

  it('o IP é guardado só como hash estável e o código por e-mail confere pelo hash', async () => {
    const a = await hashIp('200.1.2.3', SECRET)
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(await hashIp('200.1.2.3', SECRET)).toBe(a)
    expect(await hashIp('200.1.2.4', SECRET)).not.toBe(a)
    expect(await hashIp(null, SECRET)).toBeNull()
    expect(await hashIp('1.1.1.1', '')).toBeNull()

    const code = generateCode()
    expect(code).toMatch(/^\d{6}$/)
    const h = await hashCode(code, SID, SECRET)
    expect(await codeMatches(code, SID, SECRET, h)).toBe(true)
    expect(await codeMatches(' ' + code + ' ', SID, SECRET, h)).toBe(true)
    expect(await codeMatches(code === '123456' ? '654321' : '123456', SID, SECRET, h)).toBe(false)
    expect(await codeMatches(code, '11111111-1111-4111-8111-111111111111', SECRET, h)).toBe(false)
    expect(await codeMatches('12345', SID, SECRET, h)).toBe(false)
    expect(await codeMatches('abcdef', SID, SECRET, h)).toBe(false)
  })
})

describe('vagas de sessão: decisão do portão', () => {
  const base = { mode: 'enforce', ttl: 60 } as const
  it('só pede escolha quando a vaga está ocupada e só derruba quando esta sessão foi encerrada', () => {
    for (const status of ['off', 'exempt', 'ok', 'claimed'] as const) expect(decideGate({ ...base, status } as SlotResult), status).toBe('pass')
    expect(decideGate({ ...base, status: 'occupied' })).toBe('choose')
    expect(decideGate({ ...base, status: 'revoked' })).toBe('revoked')
  })

  it('falha do banco nunca trava o usuário', () => {
    expect(decideGate(null)).toBe('pass')
  })

  it('o modo observar nunca bloqueia (o banco devolve ok com would_block)', () => {
    expect(decideGate({ status: 'ok', mode: 'observe', ttl: 60, would_block: true })).toBe('pass')
  })
})

describe('vagas de sessão: destinos', () => {
  it('só aceita caminho interno como destino depois da escolha', () => {
    expect(safeNext('/admin/platform?x=1')).toBe('/admin/platform?x=1')
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', '', null, undefined, 'client/dashboard', '/auth/sessao-ativa?next=/x']) {
      expect(safeNext(bad as string), String(bad)).toBe('/client/dashboard')
    }
  })

  it('monta os endereços da tela de escolha e do aviso de sessão encerrada', () => {
    expect(chooseUrl('/client/dashboard?a=1&b=2')).toBe('/auth/sessao-ativa?next=%2Fclient%2Fdashboard%3Fa%3D1%26b%3D2')
    expect(chooseUrl('https://evil.com')).toBe('/auth/sessao-ativa?next=%2Fclient%2Fdashboard')
    expect(revokedUrl()).toBe('/login?motivo=encerrada')
    const u = revokedUrl({ city: 'Belo Horizonte', region: 'MG', since: '2026-11-13T01:00:00.000Z' })
    const q = new URL('http://x' + u).searchParams
    expect(q.get('motivo')).toBe('encerrada')
    expect(q.get('cidade')).toBe('Belo Horizonte, MG')
    expect(q.get('hora')).toBe('2026-11-13T01:00:00.000Z')
  })
})
