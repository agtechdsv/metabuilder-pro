import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

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
 * No Desktop (Tauri), usa o plugin oficial opener do Tauri (JS API).
 * Na Web, abre uma nova aba normalmente.
 */
export const openExternalUrl = async (url: string) => {
  if (isTauri()) {
    try {
      // Tenta o plugin JS oficial primeiro (melhor compatibilidade com ACL)
      await openUrl(url);
    } catch (err1: any) {
      console.warn('opener plugin failed, trying invoke fallback:', err1);
      try {
        // Fallback: invoke do comando Rust customizado
        await invoke('open_browser', { url });
      } catch (error: any) {
        console.error('Falha ao abrir URL externa via Tauri:', error);
        const errMsg = error?.message || error || 'Unknown error';
        alert(`Falha ao abrir o seu navegador padrão. Erro interno: ${errMsg}\n\nPor favor, acesse esta URL manualmente copiando-a abaixo:\n\n${url}`);
      }
    }
  } else {
    window.open(url, '_blank');
  }
};
