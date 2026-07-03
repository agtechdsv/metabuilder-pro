/**
 * Verifica se a aplicação está rodando dentro do ambiente Desktop (Tauri)
 */
export const isTauri = (): boolean => {
  if (typeof window === 'undefined') return false;
  // O Tauri injeta variáveis no window. Diferentes versões usam diferentes nomes.
  return Boolean(
    // @ts-ignore
    window.__TAURI_INTERNALS__ || 
    // @ts-ignore
    window.__TAURI__ || 
    // @ts-ignore
    window.__TAURI_IPC__
  );
};

/**
 * Abre uma URL externamente no Desktop (Tauri).
 * Tenta múltiplos métodos em cascata, do mais simples ao mais complexo.
 */
export const openExternalUrl = async (url: string) => {
  if (!isTauri()) {
    window.open(url, '_blank');
    return;
  }

  const errors: string[] = [];

  // Método 1: shell plugin (shell:allow-open já está nas capabilities)
  try {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
    return; // sucesso!
  } catch (shellErr: any) {
    errors.push(`shell:open → ${shellErr?.message || String(shellErr)}`);
  }

  // Método 2: opener plugin
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return; // sucesso!
  } catch (openerErr: any) {
    errors.push(`opener:openUrl → ${openerErr?.message || String(openerErr)}`);
  }

  // Método 3: invoke direto (fallback para versões antigas)
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_browser', { url });
    return; // sucesso!
  } catch (invokeErr: any) {
    errors.push(`invoke:open_browser → ${invokeErr?.message || String(invokeErr)}`);
  }

  // Nenhum método funcionou — mostra erros para diagnóstico
  alert(
    `Falha ao abrir o navegador padrão.\n\n` +
    `ERROS ENCONTRADOS:\n${errors.join('\n')}\n\n` +
    `Acesse manualmente:\n${url}`
  );
};
