/**
 * Segurança dos comandos que chegam ao Agente pelo canal em tempo real.
 *
 * O canal `tunnel:<projeto>` é público: qualquer pessoa que conheça o id do projeto pode ouvir e publicar nele. Os comandos
 * agora vão por um tópico PRIVADO (`commandTopic`, derivado do token) e o público fica só para servidores ainda não
 * atualizados; a assinatura abaixo vale nos dois, e protege contra quem publicar no que for.
 * O Agente não aceita mais "o token do projeto dentro do comando" (quem ouvisse o canal o copiaria):
 * o servidor ASSINA cada comando com o token (HMAC-SHA256) e o Agente confere a assinatura com o token que ele já
 * tem. O token nunca trafega. Cada comando leva hora e número de uso único, então uma cópia do comando é inútil.
 *
 * Este arquivo não depende de nada do Agente (só `crypto`), para poder ser testado sozinho. O mesmo formato
 * é implementado em src/lib/tunnel/commandSigning.ts (um teste confere que os dois produzem a mesma assinatura).
 */
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const VERSION = 'v1';
/**
 * Comandos de USUÁRIO FINAL levam `access` (permissões e regras de acesso por linha resolvidas pelo servidor) e são
 * assinados com a versão v2. Um Agente anterior (que só conhece v1) recusa o comando por assinatura inválida em vez de
 * executá-lo ignorando `access`: sem a versão nova ninguém lê dado de usuário final.
 */
const VERSION_ACCESS = 'v2';
const versionOf = (body) => (body && body.access !== undefined ? VERSION_ACCESS : VERSION);
/** Quanto o relógio do servidor e o da máquina do Agente podem diferir (segundos). */
const DEFAULT_TOLERANCE_SECONDS = 300;

/** JSON com chaves ordenadas: a mesma entrada gera o mesmo texto no servidor e no Agente. */
function stableStringify(value) {
  if (value === undefined || value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).filter(k => value[k] !== undefined && typeof value[k] !== 'function').sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

/**
 * Tópico PRIVADO de comandos do projeto: o nome é derivado do token (HMAC), então só quem tem o token (o servidor e o
 * Agente) sabe qual é. O canal público `tunnel:<projeto>` deixa de carregar comandos. Mesma conta em
 * src/lib/tunnel/commandSigning.ts (um teste confere).
 */
function commandTopic(projectId, secretToken) {
  const tag = crypto.createHmac('sha256', secretToken).update('mb-cmd-topic\n' + projectId).digest('base64url').slice(0, 32);
  return `tunnel-cmd:${projectId}:${tag}`;
}

/** Campos de segurança: ficam fora do corpo assinado. */
const SECURITY_FIELDS = ['sig', 'ts', 'nonce', 'token', 'replyTo'];

function bodyOf(payload) {
  const body = {};
  for (const k of Object.keys(payload || {})) if (!SECURITY_FIELDS.includes(k)) body[k] = payload[k];
  return body;
}

function signingInput(event, projectId, ts, nonce, replyTo, payload) {
  const bodyHash = crypto.createHash('sha256').update(stableStringify(bodyOf(payload))).digest('hex');
  return [versionOf(payload), event, projectId, String(ts), nonce, replyTo || '', bodyHash].join('\n');
}

function computeSignature(secretToken, event, projectId, ts, nonce, replyTo, payload) {
  return crypto.createHmac('sha256', secretToken).update(signingInput(event, projectId, ts, nonce, replyTo, payload)).digest('base64url');
}

/** Acrescenta ts, nonce e sig ao comando (e tira o token). Usado por quem ENVIA (os testes, e o servidor em TypeScript). */
function signCommand(secretToken, event, projectId, payload, opts = {}) {
  const ts = opts.ts ?? Date.now();
  const nonce = opts.nonce ?? crypto.randomBytes(16).toString('base64url');
  const replyTo = opts.replyTo || undefined;
  const body = bodyOf(payload);
  const sig = computeSignature(secretToken, event, projectId, ts, nonce, replyTo, body);
  return { ...body, ts, nonce, sig, ...(replyTo ? { replyTo } : {}) };
}

/** Números de uso único já vistos (para recusar o mesmo comando duas vezes). */
class NonceCache {
  constructor(ttlMs = DEFAULT_TOLERANCE_SECONDS * 2000, max = 20000, now = () => Date.now()) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.now = now;
    this.seen = new Map();
  }

  /** true se é novo (e passa a constar); false se já foi usado. */
  add(nonce) {
    const t = this.now();
    if (this.seen.size >= this.max) {
      for (const [k, exp] of this.seen) { if (exp <= t) this.seen.delete(k); }
      // ainda cheio: descarta os mais antigos
      while (this.seen.size >= this.max) this.seen.delete(this.seen.keys().next().value);
    }
    const exp = this.seen.get(nonce);
    if (exp !== undefined && exp > t) return false;
    this.seen.set(nonce, t + this.ttlMs);
    return true;
  }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Decide se um comando recebido pode ser executado.
 * @returns {{ ok: true, mode: 'signed' } | { ok: false, reason: string }}
 *  - assinado: confere assinatura, hora e número de uso único;
 *  - token no corpo (formato antigo): RECUSADO sempre (o token nunca trafega no canal).
 */
function authorizeCommand(event, payload, ctx) {
  const { projectId, secretToken, toleranceSeconds = DEFAULT_TOLERANCE_SECONDS, nonces, now = Date.now } = ctx;
  if (!payload || typeof payload !== 'object' || !secretToken) return { ok: false, reason: 'sem_autenticacao' };

  if (typeof payload.sig === 'string') {
    const { ts, nonce, sig, replyTo } = payload;
    if (typeof ts !== 'number' || !Number.isFinite(ts) || typeof nonce !== 'string' || nonce.length < 8 || nonce.length > 64) {
      return { ok: false, reason: 'assinatura_malformada' };
    }
    if (Math.abs(now() - ts) > toleranceSeconds * 1000) return { ok: false, reason: 'comando_expirado' };
    const expected = computeSignature(secretToken, event, projectId, ts, nonce, typeof replyTo === 'string' ? replyTo : '', payload);
    if (!safeEqual(sig, expected)) return { ok: false, reason: 'assinatura_invalida' };
    // só um comando COM assinatura válida entra no cache (lixo enviado por terceiros não o enche)
    if (nonces && !nonces.add(nonce)) return { ok: false, reason: 'comando_repetido' };
    return { ok: true, mode: 'signed' };
  }

  // formato antigo (token dentro do comando): quem tem o token certo ou errado, o comando é recusado do mesmo jeito
  if (typeof payload.token === 'string' && payload.token !== '') return { ok: false, reason: 'formato_antigo_nao_permitido' };
  return { ok: false, reason: 'sem_autenticacao' };
}

/** O caminho está DENTRO da pasta base (depois de resolver .., atalhos e links)? */
function isPathInside(baseDir, target) {
  if (typeof target !== 'string' || target === '' || target.includes('\0')) return false;
  try {
    const base = path.resolve(baseDir);
    const resolved = path.resolve(target);
    // resolve atalhos/links quando o arquivo existe; se não existe, vale o caminho lógico
    const real = fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
    const realBase = fs.existsSync(base) ? fs.realpathSync(base) : base;
    const rel = path.relative(realBase, real);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  } catch {
    return false;
  }
}

module.exports = { VERSION, VERSION_ACCESS, DEFAULT_TOLERANCE_SECONDS, commandTopic, stableStringify, signCommand, computeSignature, authorizeCommand, NonceCache, isPathInside };
