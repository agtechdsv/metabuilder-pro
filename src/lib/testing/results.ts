/**
 * Resultado dos testes, como o relator do e2e (e2e/dynamic/ide-reporter.ts) o envia: uma linha por evento, começando com MB_PREFIX e seguida de JSON.
 * O painel da IDE lê a saída do Playwright, separa estas linhas e atualiza a tela a cada teste que começa e termina.
 */
export const MB_PREFIX = '@@MB@@'

export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped'

export interface TestEvent {
  /** begin = começou · end = terminou · done = a rodada acabou */
  t: 'begin' | 'end' | 'done'
  /** nome do grupo (caso de uso) e do teste, como em describeName/planView */
  group?: string
  title?: string
  status?: TestStatus
  ms?: number
  /** primeiras linhas do erro, quando falhou */
  error?: string
  /** arquivos de evidência da falha (captura da tela e vídeo), quando o motor os gravou */
  shot?: string
  video?: string
  /** só em done */
  total?: number
  passed?: number
  failed?: number
  skipped?: number
}

/** Uma linha da saída do Playwright → evento, ou null se não for uma linha do relator. */
export function parseTestEvent(line: string): TestEvent | null {
  const i = line.indexOf(MB_PREFIX)
  if (i < 0) return null
  try {
    const ev = JSON.parse(line.slice(i + MB_PREFIX.length)) as TestEvent
    return ev && (ev.t === 'begin' || ev.t === 'end' || ev.t === 'done') ? ev : null
  } catch {
    return null
  }
}

/** Playwright: passed/failed/timedOut/skipped/interrupted → status do painel. */
export function statusFromPlaywright(s: string): TestStatus {
  if (s === 'passed') return 'passed'
  if (s === 'skipped') return 'skipped'
  return 'failed' // failed, timedOut, interrupted
}

export const eventLine = (ev: TestEvent): string => MB_PREFIX + JSON.stringify(ev)
