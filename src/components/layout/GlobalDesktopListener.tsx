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

          if (payload.startsWith('new_proj_')) {
            const targetSlug = payload.replace('new_proj_', '');
            router.push(`/admin/${targetSlug}`);
            toast('Crie seu novo projeto aqui.', 'info');
            return;
          }

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

    const syncTrayMenu = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Verifica se é convidado e qual nível de acesso
        const { data: guestRecord } = await supabase
          .from('owner_guests')
          .select('access_level')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        const isGuest = !!guestRecord;
        const guestAccessLevel = guestRecord?.access_level || null;
        const canCreateWorkspace = !isGuest || guestAccessLevel === 'global';

        // Busca somente workspaces onde o usuário tem permissão de criar projetos:
        // → workspaces que o usuário é owner
        // → workspaces onde é member com can_create = true
        // → workspaces de owners cujo guestRecord tem acesso global
        const { data: ownedWs } = await supabase
          .from('workspaces')
          .select('name, slug')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false });

        const { data: memberWs } = await supabase
          .from('workspace_members')
          .select('workspace:workspaces(name, slug)')
          .eq('user_id', user.id)
          .eq('can_create', true);

        // Unifica os workspaces sem duplicatas
        const memberWorkspaces = (memberWs || [])
          .map((m: any) => m.workspace)
          .filter(Boolean);

        const allWorkspaces = [...(ownedWs || [])];
        for (const ws of memberWorkspaces) {
          if (!allWorkspaces.find((w: any) => w.slug === ws.slug)) {
            allWorkspaces.push(ws);
          }
        }

        const tunnelActive = await invoke<boolean>('statuscli').catch(() => false);

        console.log('[TraySync] Calling update_tray_menu', {
          isAdmin: canCreateWorkspace,
          tunnelActive,
          workspaceCount: allWorkspaces.length
        });

        await invoke('update_tray_menu', {
          isAdmin: canCreateWorkspace,
          tunnelActive,
          workspaces: allWorkspaces
        });

        console.log('[TraySync] update_tray_menu succeeded');
      } catch (e) {
        console.error('[TraySync] Failed to sync tray menu:', e);
      }
    };

    setupListener();
    syncTrayMenu();

    // Re-sync on regular intervals to catch tunnel status changes
    const interval = setInterval(syncTrayMenu, 10000);

    return () => {
      if (unlisten) unlisten();
      clearInterval(interval);
    };
  }, [pathname, router, toast]);

  return null;
}
