/**
 * Para onde o Agente responde.
 *
 * Antes toda resposta ia ao canal público `tunnel:<projeto>`: quem estivesse ouvindo lia os dados de todo mundo.
 * Agora o comando traz `replyTo` = um tópico com nome imprevisível (`tunnel:<projeto>:<segredo da aba>`), e o Agente
 * responde SÓ ali. Sem `replyTo` válido a resposta não é enviada (nunca mais vai ao canal público).
 *
 * O Agente não precisa assinar esses tópicos: usa a API HTTP do Realtime para publicar, sem abrir uma conexão por aba.
 */
const crypto = require('crypto');

const CHUNK_SIZE = 100 * 1024;

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

class ReplyRouter {
  /**
   * @param {object} o
   * @param {string} o.projectId
   * @param {string} o.supabaseUrl
   * @param {string} o.apiKey         chave usada nas chamadas HTTP do Realtime
   * @param {{ send: Function }} o.baseChannel  canal público de sempre (clientes antigos)
   */
  constructor(o) {
    this.projectId = o.projectId;
    this.supabaseUrl = String(o.supabaseUrl || '').replace(/\/+$/, '');
    this.apiKey = o.apiKey;
    this.baseChannel = o.baseChannel;
    this.fetch = o.fetchImpl || ((...a) => fetch(...a));
    this.now = o.now || (() => Date.now());
    this.ttlMs = o.ttlMs ?? 30 * 60 * 1000;
    this.maxTopics = o.maxTopics ?? 200;
    this.chunkDelayMs = o.chunkDelayMs ?? 120;
    this.sleep = o.sleep || (ms => new Promise(r => setTimeout(r, ms)));
    this.log = o.log || (() => {});
    this.active = new Map(); // tópico -> quando expira
    this.pattern = new RegExp(`^tunnel:${escapeRe(this.projectId)}:[A-Za-z0-9_-]{16,64}$`);
  }

  /** Valida o `replyTo` de um comando; se for bom, passa a contar como "aba ativa". Devolve o tópico ou null. */
  accept(replyTo) {
    if (typeof replyTo !== 'string' || !this.pattern.test(replyTo)) return null;
    const t = this.now();
    this.active.set(replyTo, t + this.ttlMs);
    if (this.active.size > this.maxTopics) {
      for (const [k, exp] of this.active) if (exp <= t) this.active.delete(k);
      while (this.active.size > this.maxTopics) this.active.delete(this.active.keys().next().value);
    }
    return replyTo;
  }

  activeTopics() {
    const t = this.now();
    return [...this.active].filter(([, exp]) => exp > t).map(([k]) => k);
  }

  /** Publica no tópico via HTTP; mensagens grandes vão em pedaços (o mesmo `chunked_message` das telas). */
  async publish(topic, event, payload) {
    const text = JSON.stringify(payload);
    const messages = [];
    if (text.length <= CHUNK_SIZE) {
      messages.push({ topic, event, payload, private: false });
    } else {
      const total = Math.ceil(text.length / CHUNK_SIZE);
      const chunkId = crypto.randomUUID();
      for (let index = 0; index < total; index++) {
        messages.push({ topic, event: 'chunked_message', private: false, payload: { chunkId, index, total, event, data: text.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE) } });
      }
    }
    for (let i = 0; i < messages.length; i++) {
      const res = await this.fetch(`${this.supabaseUrl}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: this.apiKey, Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ messages: [messages[i]] }),
      });
      if (!res.ok) throw new Error(`Falha ao responder no tópico privado (HTTP ${res.status}).`);
      if (messages.length > 1 && i < messages.length - 1) await this.sleep(this.chunkDelayMs);
    }
  }

  /**
   * Responde a um comando SOMENTE no tópico privado que ele trouxe. Sem tópico válido a resposta não é enviada: o canal
   * público é legível por qualquer um, e dados de consulta nunca vão para lá.
   */
  async reply(replyTo, event, payload) {
    if (replyTo) return this.publish(replyTo, event, payload);
    this.log(`Comando sem tópico de resposta válido: a resposta '${event}' não foi enviada.`);
  }

  /**
   * Aviso que não responde a um comando (ex.: fluxo BPM concluído): vai a todas as abas ativas. O canal público só
   * recebe se `includeBase` (padrão: não).
   */
  async broadcast(event, payload, includeBase = false) {
    const jobs = this.activeTopics().map(t => this.publish(t, event, payload).catch(e => this.log(e.message)));
    if (includeBase) jobs.push(Promise.resolve(this.baseChannel.send({ type: 'broadcast', event, payload })).catch(e => this.log(e.message)));
    await Promise.all(jobs);
  }
}

module.exports = { ReplyRouter, CHUNK_SIZE };
