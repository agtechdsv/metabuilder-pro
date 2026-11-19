/**
 * Zoom da IDE (janela Tauri). Regras puras: faixa de 70% a 150%, passos de 10%, valor guardado no aparelho.
 * Quem aplica no webview é src/utils/ideZoom.ts; aqui não há nada de navegador, para testar fácil.
 */
export const IDE_ZOOM_MIN = 0.7
export const IDE_ZOOM_MAX = 1.5
export const IDE_ZOOM_STEP = 0.1
export const IDE_ZOOM_DEFAULT = 1
export const IDE_ZOOM_STORAGE_KEY = 'mb_ide_zoom'

const round1 = (n: number) => Math.round(n * 10) / 10

/** Mantém o fator dentro da faixa, em passos de 0,1 (1.2999999 vira 1.3). Valor inválido volta a 100%. */
export function clampZoom(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return IDE_ZOOM_DEFAULT
  return round1(Math.min(IDE_ZOOM_MAX, Math.max(IDE_ZOOM_MIN, v)))
}

/** Um passo para cima (1), para baixo (-1) ou volta a 100% (0). */
export function stepZoom(current: number, dir: 1 | -1 | 0): number {
  if (dir === 0) return IDE_ZOOM_DEFAULT
  return clampZoom(round1(clampZoom(current) + dir * IDE_ZOOM_STEP))
}

/** Lê o valor guardado; lixo ou fora da faixa não passa. */
export function parseStoredZoom(raw: string | null | undefined): number {
  if (raw == null || raw === '') return IDE_ZOOM_DEFAULT
  return clampZoom(raw)
}

export const zoomPercent = (z: number) => `${Math.round(clampZoom(z) * 100)}%`

/** Qual passo um atalho de teclado pede (Ctrl ou Cmd com +, -, 0 ou as teclas do teclado numérico). Null se não for de zoom. */
export function zoomDirFromKey(e: { key?: string; code?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): 1 | -1 | 0 | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null
  if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') return 1
  if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') return -1
  if (e.key === '0' || e.code === 'Numpad0') return 0
  return null
}

/** Ctrl + roda do mouse: para cima aumenta, para baixo diminui. */
export function zoomDirFromWheel(e: { deltaY: number; ctrlKey?: boolean }): 1 | -1 | null {
  if (!e.ctrlKey || !e.deltaY) return null
  return e.deltaY < 0 ? 1 : -1
}
