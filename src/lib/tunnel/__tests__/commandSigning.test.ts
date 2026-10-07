import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { authenticateCommand, isValidReplyTopic, newReplyTopic, signCommand, signingEnabled, stableStringify } from '../commandSigning'

// o Agente CLI (JavaScript puro) e o servidor (TypeScript) precisam concordar até o último byte
const cli = createRequire(import.meta.url)('../../../../cli/security.js') as typeof import('../../../../cli/security.js')

const PID = '123e4567-e89b-42d3-a456-426614174000'
const SECRET = 'segredo-do-projeto-0123456789abcdef'
const fixed = { ts: 1_700_000_000_000, nonce: 'nonce-fixo-1234567890' }

const payloads: Array<[string, Record<string, any>]> = [
  ['simples', { queryId: 'q1', action: 'select', query: 'SELECT 1' }],
  ['acentos e emoji', { queryId: 'q2', nome: 'João ação ✓ 😀', texto: 'linha\ncom "aspas" e \\ barra' }],
  ['aninhado e ordem de chaves', { z: 1, a: { y: [3, 2, { b: true, a: null }], x: 'k' }, m: 1.5, big: 12345678901234 }],
  ['vazios e nulos', { a: '', b: null, c: [], d: {}, e: 0, f: false }],
  ['com campos de segurança (ficam de fora)', { queryId: 'q3', token: 'velho', sig: 'x', ts: 1, nonce: 'n', replyTo: 'z', valor: 7 }],
]

describe('stableStringify: servidor e Agente produzem o mesmo texto', () => {
  for (const [name, p] of payloads) {
    it(name, () => {
      expect(stableStringify(p)).toBe(cli.stableStringify(p))
    })
  }
  it('ignora undefined e funções como o JSON faz, e ordena as chaves', () => {
    expect(stableStringify({ b: 1, a: undefined, c: () => 1, d: [undefined] })).toBe('{"b":1,"d":[null]}')
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }))
  })
})

describe('assinatura', () => {
  for (const [name, p] of payloads) {
    it(`a assinatura do servidor é idêntica à do Agente: ${name}`, () => {
      const replyTo = `tunnel:${PID}:abcdefghijklmnopqrstuv`
      const a = signCommand(SECRET, 'sql_query', PID, p, { ...fixed, replyTo })
      const b = cli.signCommand(SECRET, 'sql_query', PID, p, { ...fixed, replyTo })
      expect(a).toEqual(b)
      expect(a.token).toBeUndefined()
    })
  }

  it('o Agente aceita o que o servidor assinou, uma única vez', () => {
    const nonces = new cli.NonceCache()
    const ctx = { projectId: PID, secretToken: SECRET, nonces, now: () => fixed.ts + 1000 }
    const cmd = signCommand(SECRET, 'sql_query', PID, payloads[1][1], fixed)
    expect(cli.authorizeCommand('sql_query', cmd, ctx)).toEqual({ ok: true, mode: 'signed' })
    // o mesmo comando copiado do canal e reenviado
    expect(cli.authorizeCommand('sql_query', cmd, ctx)).toEqual({ ok: false, reason: 'comando_repetido' })
  })

  it('o Agente recusa comando adulterado, de outro evento, de outro projeto, vencido ou de outro segredo', () => {
    const mk = () => ({ projectId: PID, secretToken: SECRET, nonces: new cli.NonceCache(), now: () => fixed.ts + 1000 })
    const cmd = signCommand(SECRET, 'sql_query', PID, { queryId: 'q', action: 'select', query: 'SELECT 1' }, fixed)

    expect(cli.authorizeCommand('sql_query', { ...cmd, query: 'DROP TABLE x' }, mk())).toMatchObject({ ok: false, reason: 'assinatura_invalida' })
    expect(cli.authorizeCommand('sql_query', { ...cmd, replyTo: `tunnel:${PID}:outrotopicoqualquer123` }, mk())).toMatchObject({ ok: false })
    expect(cli.authorizeCommand('delete_export_file', cmd, mk())).toMatchObject({ ok: false, reason: 'assinatura_invalida' })
    expect(cli.authorizeCommand('sql_query', cmd, { ...mk(), projectId: 'outro-projeto' })).toMatchObject({ ok: false, reason: 'assinatura_invalida' })
    expect(cli.authorizeCommand('sql_query', cmd, { ...mk(), now: () => fixed.ts + 10 * 60_000 })).toMatchObject({ ok: false, reason: 'comando_expirado' })
    expect(cli.authorizeCommand('sql_query', cmd, { ...mk(), secretToken: 'outro-segredo-qualquer-123456' })).toMatchObject({ ok: false, reason: 'assinatura_invalida' })
    expect(cli.authorizeCommand('sql_query', { ...cmd, ts: 'x' }, mk())).toMatchObject({ ok: false, reason: 'assinatura_malformada' })
    expect(cli.authorizeCommand('sql_query', { ...cmd, nonce: 'a' }, mk())).toMatchObject({ ok: false, reason: 'assinatura_malformada' })
  })

  it('lixo com assinatura inválida não enche o cache de números de uso único', () => {
    const nonces = new cli.NonceCache()
    const ctx = { projectId: PID, secretToken: SECRET, nonces, now: () => fixed.ts }
    for (let i = 0; i < 50; i++) cli.authorizeCommand('sql_query', { sig: 'x', ts: fixed.ts, nonce: 'nonce-lixo-' + i + '-xxxx' }, ctx)
    expect(nonces.seen.size).toBe(0)
  })

  it('formato antigo (token dentro do comando): sempre recusado, com o token certo ou errado', () => {
    const ctx = { projectId: PID, secretToken: SECRET, nonces: new cli.NonceCache() }
    expect(cli.authorizeCommand('sql_query', { token: SECRET }, ctx)).toMatchObject({ ok: false, reason: 'formato_antigo_nao_permitido' })
    expect(cli.authorizeCommand('sql_query', { token: 'errado' }, ctx)).toMatchObject({ ok: false, reason: 'formato_antigo_nao_permitido' })
    expect(cli.authorizeCommand('sql_query', {}, ctx)).toMatchObject({ ok: false, reason: 'sem_autenticacao' })
    expect(cli.authorizeCommand('sql_query', null as any, ctx)).toMatchObject({ ok: false })
  })
})

describe('authenticateCommand', () => {
  it('sempre assinado: sem token no comando e com assinatura', () => {
    const cmd = authenticateCommand(SECRET, 'sql_query', PID, { queryId: 'q' })
    expect(cmd.token).toBeUndefined()
    expect(typeof cmd.sig).toBe('string')
  })
  it('replyTo inválido é descartado (nunca se responde em tópico de outro projeto)', () => {
    const evil = authenticateCommand(SECRET, 'sql_query', PID, { queryId: 'q' }, { replyTo: 'tunnel:outro-projeto:abcdefghijklmnopqrstuv' })
    expect(evil.replyTo).toBeUndefined()
    const good = authenticateCommand(SECRET, 'sql_query', PID, { queryId: 'q' }, { replyTo: `tunnel:${PID}:abcdefghijklmnopqrstuv` })
    expect(good.replyTo).toBe(`tunnel:${PID}:abcdefghijklmnopqrstuv`)
  })
})

describe('tópicos de resposta e chave', () => {
  it('só vale tópico do próprio projeto, com segredo de 16 a 64 caracteres seguros', () => {
    expect(isValidReplyTopic(PID, `tunnel:${PID}:abcdefghijklmnop`)).toBe(true)
    for (const bad of [`tunnel:${PID}`, `tunnel:${PID}:curto`, `tunnel:${PID}:${'a'.repeat(65)}`, `tunnel:${PID}:abc def ghijklmnopqr`, `tunnel:outro:abcdefghijklmnopqrst`, `room_1`, '', null, 5]) {
      expect(isValidReplyTopic(PID, bad)).toBe(false)
    }
  })
  it('tópico novo é imprevisível e válido', () => {
    const a = newReplyTopic(PID)
    expect(isValidReplyTopic(PID, a)).toBe(true)
    expect(newReplyTopic(PID)).not.toBe(a)
  })
  it('a assinatura não tem chave: está sempre ligada', () => {
    expect(signingEnabled()).toBe(true)
    expect(signingEnabled({ TUNNEL_SIGN: 'off' })).toBe(true)
  })
})
