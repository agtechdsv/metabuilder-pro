import { open } from '@tauri-apps/plugin-shell';

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
 * No Desktop (Tauri), usa o navegador padrão do sistema.
 * Na Web, abre uma nova aba normalmente.
 */
export const openExternalUrl = async (url: string) => {
  if (isTauri()) {
    try {
      await open(url);
    } catch (error: any) {
      console.error('Falha ao abrir URL externa via Tauri:', error);
      alert(`Falha ao abrir o seu navegador padrão. Por favor, acesse esta URL manualmente ou configure um navegador padrão no Windows.\n\nURL: ${url}`);
      // Fallback fallback, although usually caught by Tauri if unsupported
      window.location.href = url;
    }
  } else {
    window.open(url, '_blank');
  }
};
