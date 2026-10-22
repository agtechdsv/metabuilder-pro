/**
 * Pergunta sim/não com o modal do próprio app (AskDialogHost, montado no Providers). Mesma assinatura do `ask` do plugin de diálogo do Tauri,
 * então serve de troca direta. Sem o modal montado (ex.: testes), cai no diálogo nativo do desktop e, por último, no confirm() do navegador.
 */
export interface AskOptions {
  title?: string
  kind?: 'info' | 'warning' | 'error'
  okLabel?: string
  cancelLabel?: string
}

export interface AskRequest {
  message: string
  options: AskOptions
  resolve: (ok: boolean) => void
}

let host: ((req: AskRequest) => void) | null = null

/** O AskDialogHost se registra aqui ao montar; devolve a função que o desregistra. */
export function registerAskHost(fn: (req: AskRequest) => void): () => void {
  host = fn
  return () => { if (host === fn) host = null }
}

export async function askDialog(message: string, options: AskOptions = {}): Promise<boolean> {
  if (host) {
    const show = host
    return new Promise<boolean>(resolve => show({ message, options, resolve }))
  }
  try {
    const { ask } = await import('@tauri-apps/plugin-dialog')
    return await ask(message, options)
  } catch {
    return typeof confirm === 'function' ? confirm(message) : false
  }
}
