import { isTauri } from '@/utils/tauriUtils'

export interface IDELocalWindowTarget {
  type: 'project' | 'workspace'
  id: string
  name: string
  slug: string
}

export const IDE_LOCAL_WINDOW_LABEL = 'ide-local'
export const IDE_LOCAL_OPEN_EVENT = 'ide-local-open'

/**
 * Abre (ou traz para frente) a IDE Local em uma janela própria do desktop.
 * Se a janela já existe, só a traz para frente e pede para ela trocar de projeto quando for outro.
 * Retorna false quando não foi possível abrir a janela (o chamador abre a IDE dentro da página).
 */
export async function openIDELocalWindow(target: IDELocalWindowTarget): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const focus = async (w: any) => {
      await w.unminimize().catch(() => {})
      await w.show().catch(() => {})
      await w.setFocus().catch(() => {})
    }

    const existing = await WebviewWindow.getByLabel(IDE_LOCAL_WINDOW_LABEL)
    if (existing) {
      await focus(existing)
      await existing.emit(IDE_LOCAL_OPEN_EVENT, target).catch(() => {})
      return true
    }

    const qs = new URLSearchParams({ type: target.type, id: target.id, name: target.name, slug: target.slug })
    const win = new WebviewWindow(IDE_LOCAL_WINDOW_LABEL, {
      url: `/ide-local?${qs.toString()}`,
      title: `IDE Local - ${target.name} - MetaBuilder PRO`,
      width: 1440,
      height: 900,
      minWidth: 960,
      minHeight: 600,
      center: true,
      decorations: true,
      maximized: true,
      // Mantém o arrastar-e-soltar HTML5 da página funcionando no WebView2
      dragDropEnabled: false,
    })
    // Se a janela já existia sem termos achado (corrida), só a trazemos para frente
    win.once('tauri://error', async () => {
      const w = await WebviewWindow.getByLabel(IDE_LOCAL_WINDOW_LABEL)
      if (w) {
        await focus(w)
        await w.emit(IDE_LOCAL_OPEN_EVENT, target).catch(() => {})
      }
    })
    return true
  } catch (e) {
    console.error('Error opening IDE Local window', e)
    return false
  }
}
