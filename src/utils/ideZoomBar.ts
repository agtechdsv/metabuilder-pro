import { DEFAULT_ZOOM_BAR, ZOOM_BAR_STORAGE_KEY, parseZoomBarState, type ZoomBarState } from '@/lib/ideZoomBar'

/** Avisa o ícone do cabeçalho e a barra flutuante de que o estado (aberta ou fechada, posição) mudou. */
export const ZOOM_BAR_EVENT = 'ide-zoom-bar-changed'

let state: ZoomBarState = { ...DEFAULT_ZOOM_BAR }
let loaded = false

/** Estado atual; na primeira vez lê o que ficou guardado neste aparelho. */
export function getZoomBar(): ZoomBarState {
  if (!loaded && typeof window !== 'undefined') {
    loaded = true
    try { state = parseZoomBarState(window.localStorage.getItem(ZOOM_BAR_STORAGE_KEY)) } catch { /* sem armazenamento: começa fechada */ }
  }
  return state
}

/** Muda parte do estado, guarda e avisa as telas. */
export function setZoomBar(patch: Partial<ZoomBarState>): ZoomBarState {
  state = { ...getZoomBar(), ...patch }
  try { window.localStorage.setItem(ZOOM_BAR_STORAGE_KEY, JSON.stringify(state)) } catch { /* vale só nesta abertura */ }
  window.dispatchEvent(new CustomEvent(ZOOM_BAR_EVENT, { detail: state }))
  return state
}

export const toggleZoomBar = () => setZoomBar({ open: !getZoomBar().open })
