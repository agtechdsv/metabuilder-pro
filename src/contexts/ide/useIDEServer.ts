import { useState } from 'react'
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
  /** Stack detectada no fileTree (Módulo 9.2 / 10.4). Default: 'nodejs'. */
  isJavaSpringProject?: boolean
}

export function useIDEServer({
  target,
  addConsoleLog,
  setShowConsole,
  isSyncing,
  isJavaSpringProject = false,
}: UseIDEServerProps) {
  const { t } = useI18n()
  const { toast } = useToast()
  const { openPreview } = usePreview()

  const [devProcess, setDevProcess] = useState<any>(null)
  const [isStoppingServer, setIsStoppingServer] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  // ── Spring Boot state (separado do Node.js) ──
  const [springProcess, setSpringProcess] = useState<any>(null)
  const [isStartingSpring, setIsStartingSpring] = useState(false)
  const [isStoppingSpring, setIsStoppingSpring] = useState(false)
  const [springPort, setSpringPort] = useState(8080)

  const getProjectPath = async () => {
    const home = await homeDir()
    return `${home.replace(/\\/g, '/')}/AGTech/MetaBuilderPRO/${target!.slug}`
  }

  const handleCheckNode = async (retryAction: () => void): Promise<boolean> => {
    try {
      await invoke('check_node_available')
      return true
    } catch (e) {
      if (window.confirm('O Node.js (v20+) é necessário para rodar o frontend.\n\nDeseja que o MetaBuilder baixe e configure uma versão portátil do Node automaticamente? (Aprox. 30MB)')) {
        try {
          addConsoleLog('▶ Iniciando download do Node.js Portátil...', 'info')
          const { Command } = await import('@tauri-apps/plugin-shell')
          const psCommand = Command.create('powershell', [
            '-NoProfile', '-Command',
            `
            $ProgressPreference = 'SilentlyContinue';
            $url = 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip';
            $dir = "$env:USERPROFILE\\.metabuilder";
            if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
            if (Test-Path "$dir\\node20") { Remove-Item -Recurse -Force "$dir\\node20" }
            $zip = "$dir\\node20.zip";
            Write-Output 'Baixando Node.js v20... isso pode demorar alguns segundos dependendo da sua internet.';
            Invoke-WebRequest -Uri $url -OutFile $zip;
            Write-Output 'Download concluído. Extraindo arquivos...';
            Expand-Archive -Path $zip -DestinationPath $dir -Force;
            Remove-Item $zip;
            $extractedDir = Get-ChildItem -Path $dir -Directory -Filter 'node-v20*';
            Rename-Item -Path $extractedDir.FullName -NewName 'node20';
            Write-Output '✓ Node.js Portable instalado com sucesso no MetaBuilder!';
            `
          ])
          
          psCommand.on('close', async (data) => {
             if (data.code === 0) {
                toast('Node.js instalado com sucesso!', 'success')
                retryAction()
             } else {
                addConsoleLog(`✗ Falha ao instalar o Node (Código ${data.code})`, 'error')
                toast('Falha ao instalar o Node', 'error')
             }
          })

          psCommand.on('error', error => {
             addConsoleLog(`✗ Erro no script de instalação: ${error}`, 'error')
          })

          await psCommand.spawn()
          psCommand.stdout.on('data', line => addConsoleLog(line, 'stdout'))
          psCommand.stderr.on('data', line => addConsoleLog(line, 'error'))
          
          return false
        } catch (err: any) {
          addConsoleLog(`✗ Falha ao agendar instalação do Node: ${err?.message || err}`, 'error')
          return false
        }
      }
      return false
    }
  }

  // ──────────────────────────────────────────────────────
  // Node.js handlers (idênticos ao original — zero regressão)
  // ──────────────────────────────────────────────────────

  const handleInstall = async () => {
    if (!target || isInstalling || devProcess) return
    setIsInstalling(true)
    setShowConsole(true)
    
    addConsoleLog('▶ Verificando Node.js...', 'info')
    const nodeOk = await handleCheckNode(() => {
      setIsInstalling(false)
      handleInstall()
    })
    if (!nodeOk) {
      setIsInstalling(false)
      return
    }

    addConsoleLog(`▶ ${t('workspace_components.ide_local.starting_npm_install', 'Iniciando npm install...')}`, 'info')
    try {
      let projectPath = await getProjectPath()
      if (isJavaSpringProject) {
        projectPath = `${projectPath}/frontend`
      }
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

    addConsoleLog('▶ Verificando Node.js...', 'info')
    const nodeOk = await handleCheckNode(() => {
      handleStart()
    })
    if (!nodeOk) return

    addConsoleLog(`▶ ${t('workspace_components.ide_local.starting_next_server', 'Iniciando servidor Next.js...')}`, 'info')
    try {
      let projectPath = await getProjectPath()
      if (isJavaSpringProject) {
        projectPath = `${projectPath}/frontend`
      }
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

          const warmUp = async () => {
            for (let i = 0; i < 40; i++) {
              try {
                const res = await fetch('http://localhost:3000', {
                  mode: 'no-cors',
                  signal: AbortSignal.timeout(8000),
                  cache: 'no-store'
                })
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

  // ──────────────────────────────────────────────────────
  // Spring Boot handlers (Módulo 9.4)
  // ──────────────────────────────────────────────────────

  const handleCheckJava = async (): Promise<boolean> => {
    try {
      await invoke('check_java_available')
      return true
    } catch (err: any) {
      addConsoleLog(`✗ JDK não encontrado: ${err?.message || err}`, 'error')
      toast('JDK 21 não encontrado no PATH. Instale o Adoptium Temurin 21.', 'error')
      return false
    }
  }

  const handleStartSpring = async () => {
    if (!target || springProcess || isStartingSpring) return
    setShowConsole(true)
    setIsStartingSpring(true)

    addConsoleLog('▶ Verificando JDK...', 'info')
    const javaOk = await handleCheckJava()
    if (!javaOk) {
      if (window.confirm('O Java 21 é necessário para rodar o backend.\n\nDeseja que o MetaBuilder baixe e configure uma versão portátil do Java automaticamente? (Aprox. 190MB)')) {
        try {
          addConsoleLog('▶ Iniciando download do Java 21 Portátil...', 'info')
          const { Command } = await import('@tauri-apps/plugin-shell')
          const psCommand = Command.create('powershell', [
            '-NoProfile', '-Command',
            `
            $ProgressPreference = 'SilentlyContinue';
            $url = 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.4%2B7/OpenJDK21U-jdk_x64_windows_hotspot_21.0.4_7.zip';
            $dir = "$env:USERPROFILE\\.metabuilder";
            if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
            if (Test-Path "$dir\\jdk21") { Remove-Item -Recurse -Force "$dir\\jdk21" }
            $zip = "$dir\\jdk21.zip";
            Write-Output 'Baixando JDK 21... isso pode demorar alguns minutos dependendo da sua internet.';
            Invoke-WebRequest -Uri $url -OutFile $zip;
            Write-Output 'Download concluído. Extraindo arquivos...';
            Expand-Archive -Path $zip -DestinationPath $dir -Force;
            Remove-Item $zip;
            $extractedDir = Get-ChildItem -Path $dir -Directory -Filter 'jdk-21*';
            Rename-Item -Path $extractedDir.FullName -NewName 'jdk21';
            Write-Output '✓ JDK 21 Portable instalado com sucesso no MetaBuilder!';
            `
          ])
          
          psCommand.on('close', async (data) => {
             if (data.code === 0) {
                toast('Java instalado com sucesso!', 'success')
                // Tenta iniciar o Spring novamente agora que o Java está instalado
                setIsStartingSpring(false)
                handleStartSpring()
             } else {
                addConsoleLog(`✗ Falha ao instalar o Java (Código ${data.code})`, 'error')
                toast('Falha ao instalar o Java', 'error')
                setIsStartingSpring(false)
             }
          })

          psCommand.on('error', error => {
             addConsoleLog(`✗ Erro no script de instalação: ${error}`, 'error')
             setIsStartingSpring(false)
          })

          const child = await psCommand.spawn()
          
          const { listen } = await import('@tauri-apps/api/event')
          const unlistenStdout = await listen<string>('plugin:shell://stdout', (e) => {
             // O payload pode vir num formato diferente se não usarmos stdout/stderr nativo, 
             // mas o tauri_plugin_shell Command também emite eventos 'out' e 'err' direto no objeto js
          })
          
          // O objeto CommandChild do Tauri já recebe os eventos .on('close') definidos acima, 
          // mas para ver o output no console:
          psCommand.stdout.on('data', line => addConsoleLog(line, 'stdout'))
          psCommand.stderr.on('data', line => addConsoleLog(line, 'error'))
          
          return
        } catch (e: any) {
          addConsoleLog(`✗ Falha ao agendar instalação do Java: ${e?.message || e}`, 'error')
          setIsStartingSpring(false)
          return
        }
      } else {
        setIsStartingSpring(false)
        return
      }
    }

    addConsoleLog('▶ Iniciando Spring Boot backend...', 'info')
    try {
      const baseProjectPath = await getProjectPath()
      // Em modo java-spring, o backend fica em <project>/backend/
      const projectPath = `${baseProjectPath}/backend`

      const { listen } = await import('@tauri-apps/api/event')
      let springReady = false

      const unlisten = await listen<string>('spring-boot-log', (event) => {
        const text = event.payload
        const lower = text.toLowerCase()
        // Maven emite muito na stderr — classificar corretamente
        const isError = lower.includes('build failure') || lower.includes('error]')
        const isWarn = lower.includes('warn')
        const type = isError ? 'error' : isWarn ? 'warn' : 'stdout'
        addConsoleLog(text, type)

        // Detectar que o Spring Boot está pronto
        if (!springReady && (lower.includes('started') && lower.includes('seconds'))) {
          springReady = true
          setIsStartingSpring(false)
          addConsoleLog(`✓ Spring Boot pronto em http://localhost:${springPort}`, 'info')
          addConsoleLog(`✓ Swagger UI: http://localhost:${springPort}/swagger-ui.html`, 'info')
          toast('Spring Boot pronto!', 'success')
        }

        if (text.includes('Encerrado com código')) {
          setSpringProcess(null)
          setIsStoppingSpring(false)
          setIsStartingSpring(false)
          addConsoleLog('■ Spring Boot encerrado.', 'info')
          unlisten()
        }
      })

      await invoke('start_spring_boot', { projectPath })

      setSpringProcess({
        kill: async () => {
          setIsStoppingSpring(true)
          await invoke('stop_spring_boot')
          setTimeout(() => {
            setSpringProcess(null)
            setIsStoppingSpring(false)
          }, 5000)
        }
      } as any)

    } catch (err: any) {
      addConsoleLog(`✗ Erro ao iniciar Spring Boot: ${err?.message || err}`, 'error')
      toast(`Erro ao iniciar Spring Boot: ${err?.message || err}`, 'error')
    } finally {
      setIsStartingSpring(false)
    }
  }

  const handleStopSpring = async () => {
    if (!springProcess || isStoppingSpring) return
    springProcess.kill()
  }

  const handleOpenSpringSwagger = async () => {
    const url = `http://localhost:${springPort}/swagger-ui.html`
    addConsoleLog(`↗ Abrindo Swagger UI em ${url}`, 'info')
    import('@tauri-apps/plugin-shell').then(({ open }) => {
      open(url)
    }).catch(() => {
      openPreview(url, 'Swagger UI')
    })
  }

  return {
    // Node.js
    devProcess,
    setDevProcess,
    isStoppingServer,
    isInstalling,
    handleInstall,
    handleStart,
    handleStop,
    handleOpenBrowser,
    getProjectPath,
    isJavaSpringProject,
    // Spring Boot
    springProcess,
    isStartingSpring,
    isStoppingSpring,
    springPort,
    setSpringPort,
    handleStartSpring,
    handleStopSpring,
    handleOpenSpringSwagger,
  }
}
