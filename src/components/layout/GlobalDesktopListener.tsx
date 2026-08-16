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
        const { getCurrentWindow } = await import('@tauri-apps/api/window');

        const bringToFront = async () => {
          try {
            const win = getCurrentWindow();
            await win.show();
            await win.unminimize();
            await win.setFocus();
          } catch(e) {}
        };

        unlisten = await listen<string>('tray-event', async (event) => {
          const payload = event.payload;

          const match = pathname?.match(/\/admin\/([^/]+)(?:\/([^/]+))?/);
          const workspaceSlug = match ? match[1] : null;
          const projectSlug = match ? match[2] : null;

          if (payload.startsWith('new_proj_')) {
            await bringToFront();
            const targetSlug = payload.replace('new_proj_', '');
            router.push(`/admin/${targetSlug}?action=new`);
            return;
          }

          switch (payload) {
            case 'new_ws':
              await bringToFront();
              router.push('/workspace?action=new');
              break;
            case 'new_proj':
              await bringToFront();
              if (workspaceSlug) {
                router.push(`/admin/${workspaceSlug}?action=new`);
              } else {
                router.push('/workspace');
                toast('Selecione um workspace primeiro para criar o projeto.', 'info');
              }
              break;
            case 'sync_byoc':
              await bringToFront();
              if (workspaceSlug && projectSlug && projectSlug !== 'settings') {
                router.push(`/admin/${workspaceSlug}/${projectSlug}/studio/byoc`);
                toast('Página de Sincronização BYOC', 'info');
              } else {
                toast('Nenhum projeto ativo. Abra um projeto primeiro.', 'error');
              }
              break;
            case 'start_tunnel':
            case 'stop_tunnel':
              try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                const win = getCurrentWindow();
                const isVisible = await win.isVisible();
                
                toast(payload === 'start_tunnel' ? 'Iniciando túnel...' : 'Parando túnel...', 'info');

                if (!isVisible) {
                  await bringToFront();
                }
                
                const { invoke } = await import('@tauri-apps/api/core');
                if (payload === 'stop_tunnel') {
                  await invoke('stopcli');
                  toast('Túnel parado com sucesso', 'success');
                } else {
                  const { appLocalDataDir, join } = await import('@tauri-apps/api/path');
                  const dir = await appLocalDataDir();
                  const configPath = await join(dir, 'metabuilder.config.json');
                  
                  await invoke('startcli', { mode: 1, configPath });
                  toast('Túnel iniciado com sucesso.', 'success');
                }
              } catch (e) {
                toast('Falha ao executar processo do túnel.', 'error');
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

        // Não logado: desabilita todos os itens de ação e retorna
        if (!user) {
          await invoke('update_tray_menu', {
            isLoggedIn: false,
            isAdmin: false,
            tunnelActive: false,
            workspaces: []
          });
          return;
        }

        // Logado: busca permissões e estado real
        const { data: guestRecord } = await supabase
          .from('owner_guests')
          .select('access_level')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        const isGuest = !!guestRecord;
        const guestAccessLevel = guestRecord?.access_level || null;
        const canCreateWorkspace = !isGuest || guestAccessLevel === 'global';

        // Workspaces onde o usuário pode criar projetos
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
          isLoggedIn: true,
          isAdmin: canCreateWorkspace,
          tunnelActive,
          workspaceCount: allWorkspaces.length
        });

        await invoke('update_tray_menu', {
          isLoggedIn: true,
          isAdmin: canCreateWorkspace,
          tunnelActive,
          workspaces: allWorkspaces
        });

        console.log('[TraySync] update_tray_menu succeeded');
      } catch (e: any) {
        console.error('[TraySync] Failed to sync tray menu:', e);
        const errMsg = String(e.message || e);
        if (!errMsg.includes('not allowed by ACL') && !errMsg.includes('not found')) {
          toast('Erro no Tray: ' + errMsg, 'error');
        }
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
