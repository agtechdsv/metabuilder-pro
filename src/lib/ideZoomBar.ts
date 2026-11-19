/**
 * Barra flutuante do zoom da IDE: regras puras (posição, tamanho fixo e estado guardado). Nada de navegador aqui, para testar fácil.
 *
 * O zoom é do webview inteiro, então tudo na página cresce e diminui junto, inclusive a barra. Para ela ficar parada e do mesmo tamanho
 * na tela (e o usuário poder clicar várias vezes no mesmo botão), ela é desenhada com o inverso do zoom e a posição é guardada como
 * FRAÇÃO do espaço livre da janela, não em pixels.
 */
export const ZOOM_BAR_STORAGE_KEY = 'mb_ide_zoom_bar'

/** Tamanho da barra na TELA, em pixels (não muda com o zoom). */
export const ZOOM_BAR_SIZE = { w: 196, h: 40 }

export interface ZoomBarState {
  /** barra aberta (ligada pelo ícone do cabeçalho) */
  open: boolean
  /** posição: fração do espaço livre da janela (0 = encostada à esquerda/no topo, 1 = à direita/embaixo) */
  fx: number
  fy: number
}

/** Começa fechada, no canto inferior direito. */
export const DEFAULT_ZOOM_BAR: ZoomBarState = { open: false, fx: 0.98, fy: 0.97 }

export const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

/** Lê o estado guardado; qualquer lixo volta ao padrão, e as frações ficam dentro de 0 a 1. */
export function parseZoomBarState(raw: string | null | undefined): ZoomBarState {
  if (!raw) return { ...DEFAULT_ZOOM_BAR }
  try {
    const o = JSON.parse(raw) as Partial<ZoomBarState> | null
    if (!o || typeof o !== 'object') return { ...DEFAULT_ZOOM_BAR }
    return {
      open: o.open === true,
      fx: typeof o.fx === 'number' && Number.isFinite(o.fx) ? clamp01(o.fx) : DEFAULT_ZOOM_BAR.fx,
      fy: typeof o.fy === 'number' && Number.isFinite(o.fy) ? clamp01(o.fy) : DEFAULT_ZOOM_BAR.fy,
    }
  } catch {
    return { ...DEFAULT_ZOOM_BAR }
  }
}

const safeZoom = (z: number) => (Number.isFinite(z) && z > 0 ? z : 1)

/**
 * Onde pôr a barra, em pixels CSS da página (que já está com zoom), para ela ocupar o mesmo lugar na tela em qualquer zoom.
 * `vw` e `vh` são o tamanho da janela em pixels CSS (window.innerWidth/innerHeight).
 */
export function barCssPosition(s: Pick<ZoomBarState, 'fx' | 'fy'>, vw: number, vh: number, zoom: number) {
  const z = safeZoom(zoom)
  const freeW = Math.max(0, vw - ZOOM_BAR_SIZE.w / z)
  const freeH = Math.max(0, vh - ZOOM_BAR_SIZE.h / z)
  return { left: clamp01(s.fx) * freeW, top: clamp01(s.fy) * freeH, scale: 1 / z }
}

/** O caminho inverso, usado ao arrastar: de um ponto em pixels CSS para a fração guardada (sempre dentro da janela). */
export function fractionsFromCssPosition(left: number, top: number, vw: number, vh: number, zoom: number) {
  const z = safeZoom(zoom)
  const freeW = Math.max(0, vw - ZOOM_BAR_SIZE.w / z)
  const freeH = Math.max(0, vh - ZOOM_BAR_SIZE.h / z)
  return { fx: freeW > 0 ? clamp01(left / freeW) : 0, fy: freeH > 0 ? clamp01(top / freeH) : 0 }
}
