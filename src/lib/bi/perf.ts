/**
 * Desempenho do painel de BI: cache de resultados, atualização automática e tempo limite.
 * Código puro e sem dependências: roda no painel, no servidor do app exportado e no navegador do app exportado.
 */

export const CACHE_OPTIONS = [0, 30, 60, 300, 900, 3600] as const
export const REFRESH_OPTIONS = [0, 30, 60, 300, 900, 3600] as const
export const TIMEOUT_OPTIONS = [10, 15, 30, 60, 120] as const

export const DEFAULT_TIMEOUT_SECONDS = 30

export interface BiPerfSettings {
  /** guarda o resultado de cada consulta por este tempo (0 = sem cache) */
  cacheSeconds: number
  /** refaz as consultas sozinho a cada tanto tempo enquanto a tela está aberta (0 = desligado) */
  refreshSeconds: number
  /** passado este tempo o indicador mostra "tempo esgotado" em vez de ficar carregando */
  timeoutSeconds: number
}

const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)

/** Lê os campos gravados em analytics_config (cache_seconds, refresh_seconds, timeout_seconds) com limites seguros. */
export function perfSettings(raw: { cache_seconds?: unknown; refresh_seconds?: unknown; timeout_seconds?: unknown } | null | undefined): BiPerfSettings {
  const cache = num(raw?.cache_seconds)
  const refresh = num(raw?.refresh_seconds)
  const timeout = num(raw?.timeout_seconds)
  return {
    cacheSeconds: Number.isFinite(cache) ? Math.min(3600, Math.max(0, Math.round(cache))) : 0,
    // abaixo de 15 s a atualização só sobrecarregaria o banco do cliente
    refreshSeconds: Number.isFinite(refresh) && refresh >= 15 ? Math.min(86400, Math.round(refresh)) : 0,
    timeoutSeconds: Number.isFinite(timeout) && timeout > 0 ? Math.min(300, Math.max(5, Math.round(timeout))) : DEFAULT_TIMEOUT_SECONDS,
  }
}

export class BiTimeoutError extends Error {
  constructor(public readonly ms: number) {
    super(`tempo esgotado (${Math.round(ms / 1000)}s)`)
    this.name = 'BiTimeoutError'
  }
}

/** Rejeita com BiTimeoutError se a promessa demorar mais que `ms`. (A consulta em si não é cancelada.) */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new BiTimeoutError(ms)), ms)
    promise.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) },
    )
  })
}

interface Entry<T> { value: T; expires: number }

/**
 * Cache de resultados por chave (a consulta SQL já inclui período, filtros e regras de acesso, então a chave é o
 * próprio SQL). Consultas iguais feitas ao mesmo tempo compartilham uma só ida ao banco.
 */
export class QueryCache<T = unknown> {
  private store = new Map<string, Entry<T>>()
  private inflight = new Map<string, Promise<T>>()

  constructor(private readonly max = 300, private readonly now: () => number = () => Date.now()) {}

  get size() { return this.store.size }

  get(key: string): T | undefined {
    const e = this.store.get(key)
    if (!e) return undefined
    if (e.expires <= this.now()) { this.store.delete(key); return undefined }
    // acessado agora: vai para o fim da fila de remoção
    this.store.delete(key)
    this.store.set(key, e)
    return e.value
  }

  set(key: string, value: T, ttlMs: number) {
    if (ttlMs <= 0) return
    this.store.delete(key)
    this.store.set(key, { value, expires: this.now() + ttlMs })
    while (this.store.size > this.max) {
      const oldest = this.store.keys().next().value
      if (oldest === undefined) break
      this.store.delete(oldest)
    }
  }

  clear() { this.store.clear() }

  /**
   * Devolve o resultado em cache ou executa `fn`. Com ttl 0 não guarda nada (mas ainda junta chamadas simultâneas
   * iguais). `fresh` ignora o cache e o substitui pelo resultado novo. Erros nunca ficam em cache.
   */
  async run(key: string, ttlMs: number, fn: () => Promise<T>, fresh = false): Promise<{ value: T; cached: boolean }> {
    if (!fresh && ttlMs > 0) {
      const hit = this.get(key)
      if (hit !== undefined) return { value: hit, cached: true }
    }
    let pending = fresh ? undefined : this.inflight.get(key)
    if (!pending) {
      pending = fn().then(
        v => { this.inflight.delete(key); this.set(key, v, ttlMs); return v },
        e => { this.inflight.delete(key); throw e },
      )
      this.inflight.set(key, pending)
    }
    return { value: await pending, cached: false }
  }
}
