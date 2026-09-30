import { isTauri } from '@/utils/tauriUtils'

/**
 * Abre (ou traz para frente) a janela de logs do túnel na IDE desktop.
 * Retorna false quando não é possível abrir a janela nativa (ex.: fora do Tauri),
 * para que o chamador decida um fallback (ex.: modal inline).
 */
export async function openTunnelLogsWindow(): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const focus = async (w: any) => {
      await w.unminimize().catch(() => {})
      await w.show().catch(() => {})
      await w.setFocus().catch(() => {})
    }

    const existing = await WebviewWindow.getByLabel('tunnel-logs')
    if (existing) {
      await focus(existing)
      return true
    }

    const logWindow = new WebviewWindow('tunnel-logs', {
      url: '/tunnel-logs',
      title: 'Tunnel Logs - MetaBuilder PRO',
      width: 900,
      height: 600,
      center: true,
      decorations: true,
    })
    logWindow.once('tauri://error', async () => {
      const w = await WebviewWindow.getByLabel('tunnel-logs')
      if (w) await focus(w)
    })
    return true
  } catch (e) {
    console.error('Error opening tunnel logs window', e)
    return false
  }
}
