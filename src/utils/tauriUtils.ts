import { invoke } from '@tauri-apps/api/core';

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
 * No Desktop (Tauri), usa o comando Rust 'open_browser' (com permissão ACL explícita via permissions/open-browser.toml).
 * Na Web, abre uma nova aba normalmente.
 */
export const openExternalUrl = async (url: string) => {
  if (isTauri()) {
    try {
      await invoke('open_browser', { url });
    } catch (error: any) {
      console.error('Falha ao abrir URL externa via Tauri:', error);
      const errMsg = error?.message || error || 'Unknown error';
      // Fallback: tenta o plugin JS direto
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(url);
      } catch (err2) {
        alert(`Falha ao abrir o seu navegador padrão. Erro interno: ${errMsg}\n\nPor favor, acesse esta URL manualmente copiando-a abaixo:\n\n${url}`);
      }
    }
  } else {
    window.open(url, '_blank');
  }
};
