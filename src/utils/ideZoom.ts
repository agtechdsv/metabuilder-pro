import { isTauri } from '@/utils/tauriUtils'
import { IDE_ZOOM_DEFAULT, IDE_ZOOM_STORAGE_KEY, clampZoom, parseStoredZoom, stepZoom } from '@/lib/ideZoom'

/** Evento que avisa o controle do menu que o zoom mudou (por botão, atalho ou roda do mouse). */
export const IDE_ZOOM_EVENT = 'ide-zoom-changed'

let current = IDE_ZOOM_DEFAULT

export const getIdeZoom = () => current

function save(z: number) {
  try { window.localStorage.setItem(IDE_ZOOM_STORAGE_KEY, String(z)) } catch { /* sem armazenamento: o zoom vale só nesta abertura */ }
}

/** Aplica o fator no webview da IDE (zoom de verdade, não CSS), guarda e avisa a tela. Só faz algo dentro do Tauri. */
export async function setIdeZoom(factor: number): Promise<number> {
  const z = clampZoom(factor)
  if (!isTauri()) return z
  try {
    const { getCurrentWebview } = await import('@tauri-apps/api/webview')
    await getCurrentWebview().setZoom(z)
    current = z
    save(z)
    window.dispatchEvent(new CustomEvent(IDE_ZOOM_EVENT, { detail: z }))
  } catch (e) {
    console.warn('[zoom] não foi possível aplicar o zoom:', (e as Error)?.message)
  }
  return current
}

export const stepIdeZoom = (dir: 1 | -1 | 0) => setIdeZoom(stepZoom(current, dir))

/** Volta ao zoom que o usuário deixou da última vez (chamado ao abrir a IDE). */
export async function restoreIdeZoom(): Promise<number> {
  let stored = IDE_ZOOM_DEFAULT
  try { stored = parseStoredZoom(window.localStorage.getItem(IDE_ZOOM_STORAGE_KEY)) } catch { /* ignora */ }
  current = stored
  if (stored !== IDE_ZOOM_DEFAULT) return setIdeZoom(stored)
  window.dispatchEvent(new CustomEvent(IDE_ZOOM_EVENT, { detail: stored }))
  return stored
}
