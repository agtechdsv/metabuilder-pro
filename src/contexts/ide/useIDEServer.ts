import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n'
import { usePreview } from '../PreviewContext'

export interface UseIDEServerProps {
  target: { id: string; name: string; slug: string } | null
  addConsoleLog: (text: string, type?: 'info' | 'error' | 'warn' | 'stdout') => void
  setShowConsole: React.Dispatch<React.SetStateAction<boolean>>
  isSyncing: boolean
}

export function useIDEServer({
  target,
  addConsoleLog,
  setShowConsole,
  isSyncing
}: UseIDEServerProps) {
  const { t } = useI18n()
  const { toast } = useToast()
  const { openPreview } = usePreview()

  const [devProcess, setDevProcess] = useState<any>(null)
  const [isStoppingServer, setIsStoppingServer] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  const getProjectPath = async () => {
    const home = await homeDir()
    return `${home.replace(/\\/g, '/')}/AGTech/MetaBuilderPRO/${target!.slug}`
  }

  const handleInstall = async () => {
    if (!target || isInstalling || devProcess) return
    setIsInstalling(true)
    setShowConsole(true)
    addConsoleLog(`▶ ${t('workspace_components.ide_local.starting_npm_install', 'Iniciando npm install...')}`, 'info')
    try {
      const projectPath = await getProjectPath()
      const { listen } = await import('@tauri-apps/api/event')

      await new Promise<void>(async (resolve, reject) => {
        const unlistenLog = await listen<string>('nextjs-dev-log', (event) => {
          const text = event.payload
          const lower = text.toLowerCase()
          const type = lower.includes('error') ? 'error' : lower.includes('warn') ? 'warn' : 'stdout'
          addConsoleLog(text, type)
        })

        const unlistenInstall = await listen<boolean>('npm-install-done', (event) => {
          unlistenInstall()
          unlistenLog()
          if (event.payload) resolve()
          else reject(new Error('npm install falhou'))
        })

        try {
          await invoke('start_npm_install', { projectPath })
        } catch (e) {
          unlistenInstall()
          unlistenLog()
          reject(e)
        }
      })

      addConsoleLog(`✓ ${t('workspace_components.ide_local.deps_installed_success', 'Dependências instaladas com sucesso!')}`, 'info')
    } catch (err: any) {
      addConsoleLog(`✗ Erro no build: ${err?.message || err}`, 'error')
      toast('Erro ao instalar dependências', 'error')
    } finally {
      setIsInstalling(false)
    }
  }

  const handleStart = async () => {
    if (!target || devProcess || isInstalling) return
    setShowConsole(true)
    addConsoleLog(`▶ ${t('workspace_components.ide_local.starting_next_server', 'Iniciando servidor Next.js...')}`, 'info')
    try {
      const projectPath = await getProjectPath()
      await invoke('start_nextjs_server', { projectPath })

      const { listen } = await import('@tauri-apps/api/event')
      let serverReady = false
      const unlisten = await listen<string>('nextjs-dev-log', (event) => {
        const text = event.payload
        const lower = text.toLowerCase()
        const type = lower.includes('error') ? 'error' : lower.includes('warn') ? 'warn' : 'stdout'
        addConsoleLog(text, type)

        if (!serverReady && lower.includes('ready in')) {
          serverReady = true
          addConsoleLog(`⚙ ${t('workspace_components.ide_local.compiling_app', 'Compilando a aplicação... Aguardando primeira resposta.')}`, 'info')

          // Warm-up: wait for first successful HTTP response before enabling open-in-browser
          const warmUp = async () => {
            for (let i = 0; i < 40; i++) {
              try {
                const res = await fetch('http://localhost:3000', {
                  mode: 'no-cors',
                  signal: AbortSignal.timeout(8000),
                  cache: 'no-store'
                })
                // mode: 'no-cors' returns an opaque response with status 0, which means the server responded!
                if (res.status === 0 || res.status < 500) {
                  addConsoleLog(`✓ ${t('workspace_components.ide_local.app_ready', 'Aplicação pronta em localhost:3000')}`, 'info')
                  toast(t('workspace_components.ide_local.server_ready_toast', 'Servidor pronto!'), 'success')
                  return
                }
              } catch (_) {}
              await new Promise(r => setTimeout(r, 3000))
            }
          }
          warmUp()
        }

        if (text.includes('Encerrado com código')) {
          setDevProcess(null)
          setIsStoppingServer(false)
          addConsoleLog(`■ ${t('workspace_components.ide_local.server_stopped', 'Servidor encerrado.')}`, 'info')
          unlisten()
        }
      })

      setDevProcess({
        kill: async () => {
          setIsStoppingServer(true)
          await invoke('stopcli')
          setTimeout(() => {
            setDevProcess(null)
            setIsStoppingServer(false)
          }, 5000)
        }
      } as any)

    } catch (err: any) {
      addConsoleLog(`✗ Erro ao iniciar servidor: ${err?.message || err}`, 'error')
      toast(`Erro ao iniciar servidor: ${err?.message || err}`, 'error')
    }
  }

  const handleStop = async () => {
    if (!devProcess || isStoppingServer) return
    devProcess.kill()
  }

  const handleOpenBrowser = async () => {
    addConsoleLog(t('ide.console.opening_browser', '↗ Abrindo localhost:3000 no browser...'), 'info')
    import('@tauri-apps/plugin-shell').then(({ open }) => {
      open('http://localhost:3000')
    }).catch(() => {
      openPreview('http://localhost:3000', `Preview: ${target?.name}`)
    })
  }

  return {
    devProcess,
    setDevProcess,
    isStoppingServer,
    isInstalling,
    handleInstall,
    handleStart,
    handleStop,
    handleOpenBrowser,
    getProjectPath
  }
}
