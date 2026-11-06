/**
 * Cache da lista de cada tela (sessionStorage), só uma aceleração: sem armazenamento (janela anônima, cota cheia, bloqueado) a tela segue sem ele.
 *
 * No MODO DEMONSTRAÇÃO (iframe da Ajuda Interativa) o cache fica DESLIGADO, nos dois sentidos. O sessionStorage é compartilhado com a
 * página do app (mesma origem, mesma aba), então:
 *  - ler faria a demonstração começar com as linhas reais do cache, sem consultar o banco, e a linha de exemplo apareceria depois
 *    (e o tutorial poderia clicar numa linha real antes disso);
 *  - gravar poluiria o cache do app real com as linhas de exemplo.
 */

import { isDemoMode } from './demo/demoMode'

const PREFIX = 'metabuilder_cache_'

export function getCachedData(key: string): any[] | null {
  if (typeof window === 'undefined' || isDemoMode()) return null
  try {
    const cached = sessionStorage.getItem(`${PREFIX}${key}`)
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

export function setCachedData(key: string, data: any[]) {
  if (typeof window === 'undefined' || isDemoMode()) return
  try {
    sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify(data))
  } catch {
    // cota excedida: apaga o cache antigo (que só ocupa espaço) e não derruba a resposta que acabou de chegar
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i)
        if (k && k.startsWith(PREFIX)) sessionStorage.removeItem(k)
      }
    } catch { /* sem armazenamento */ }
  }
}
