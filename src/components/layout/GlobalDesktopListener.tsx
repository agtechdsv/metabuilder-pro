'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { isTauri } from '@/utils/tauriUtils'
import { useToast } from '@/components/ui/Toast'

export function GlobalDesktopListener() {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<string>('tray-event', (event) => {
          const payload = event.payload;

          const match = pathname?.match(/\/admin\/([^/]+)\/([^/]+)/);
          const workspaceSlug = match ? match[1] : null;
          const projectSlug = match ? match[2] : null;

          switch (payload) {
            case 'new_ws':
              router.push('/admin/platform');
              toast('Crie seu novo workspace por aqui.', 'info');
              break;
            case 'new_proj':
              if (workspaceSlug) {
                router.push(`/admin/${workspaceSlug}`);
                toast('Crie seu novo projeto aqui.', 'info');
              } else {
                router.push('/admin/platform');
                toast('Selecione um workspace primeiro para criar o projeto.', 'info');
              }
              break;
            case 'sync_byoc':
              if (workspaceSlug && projectSlug && projectSlug !== 'settings') {
                router.push(`/admin/${workspaceSlug}/${projectSlug}/studio/byoc`);
                toast('Página de Sincronização BYOC', 'info');
              } else {
                toast('Nenhum projeto ativo. Abra um projeto primeiro.', 'error');
              }
              break;
            case 'start_tunnel':
            case 'stop_tunnel':
              if (workspaceSlug && projectSlug && projectSlug !== 'settings') {
                router.push(`/admin/${workspaceSlug}/${projectSlug}/studio/tunnel`);
                toast(payload === 'start_tunnel' ? 'Inicie o túnel por aqui' : 'Pare o túnel por aqui', 'info');
              } else {
                toast('Nenhum projeto ativo. Abra um projeto primeiro.', 'error');
              }
              break;
          }
        });
      } catch (err) {
        console.error('Error setting up tray listener:', err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [pathname, router, toast]);

  return null;
}
