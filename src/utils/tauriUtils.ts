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
 * Abre uma URL externamente.
 * No Desktop (Tauri), usa o plugin JS oficial opener (opener:allow-open-url está na ACL).
 * Na Web, abre uma nova aba normalmente.
 */
export const openExternalUrl = async (url: string) => {
  if (isTauri()) {
    try {
      // Importação dinâmica para evitar erros em SSR (Next.js)
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
    } catch (error: any) {
      console.error('Falha ao abrir URL externa via Tauri opener plugin:', error);
      const errMsg = error?.message || String(error) || 'Unknown error';
      alert(`Falha ao abrir o seu navegador padrão.\n\nPor favor, acesse esta URL manualmente:\n\n${url}`);
    }
  } else {
    window.open(url, '_blank');
  }
};
