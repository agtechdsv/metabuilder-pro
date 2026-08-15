'use client'

import { useState, useEffect, useRef } from 'react'
import { IdeUpdaterButton } from '@/components/runtime/IdeUpdaterButton'
import { createClient } from '@/utils/supabase/client'
import { Download, File as FileIcon, Loader2, RefreshCw, Filter, X, History, FolderOpen, Play, CheckCircle, ExternalLink } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isTauri } from '@/utils/tauriUtils'
import { useI18n } from '@/i18n'

interface Project {
  id: string
  name: string
  secret_token?: string
}

interface CliFilesClientViewProps {
  projects?: Project[]
  devOnly?: boolean // When true (dev user), only the IDE sub-tab is shown
  isPopout?: boolean
}

export function CliFilesClientView({ projects = [], devOnly = false, isPopout = false }: CliFilesClientViewProps) {
  const { t } = useI18n()
  const [files, setFiles] = useState<any[]>([])
  const [desktopBuilds, setDesktopBuilds] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Tab & Filter state — devOnly users are locked to the IDE tab
  const [mainTab, setMainTab] = useState<'ide' | 'utils' | 'workspaces'>('ide')
  const [filter, setFilter] = useState<'all' | 'cli-win' | 'cli-linux' | 'template' | 'manual' | 'ide-win' | 'ide-mac' | 'ide-linux' | 'workspace' | 'project'>('all')
  const [showOlderReleases, setShowOlderReleases] = useState(false)
  const [localVersion, setLocalVersion] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [releaseNotesList, setReleaseNotesList] = useState<any[]>([])

  // Modal state
  const [downloadModalFile, setDownloadModalFile] = useState<any | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  // DB config state
  const [dbType, setDbType] = useState('postgres')
  const [dbHost, setDbHost] = useState('localhost')
  const [dbPort, setDbPort] = useState('5432')
  const [dbName, setDbName] = useState('')
  const [dbUser, setDbUser] = useState('')
  const [dbPass, setDbPass] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  // IDE Download modal state
  const [ideDownloadModal, setIdeDownloadModal] = useState<{
    open: boolean
    phase: 'downloading' | 'done' | 'error'
    fileName: string
    progress: number // 0-100
    savedPath: string
    savedDir: string
    canRun: boolean
    isProject?: boolean
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const supabase = createClient()
  const { toast } = useToast()

  const fetchFiles = async () => {
    setIsLoading(true)
    
    // Fetch global downloads (IDE, CLI, Manuals)
    const { data, error } = await supabase
      .from('app_downloads')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      toast(t('client_views.downloads.toast_load_error', 'Erro ao carregar arquivos disponíveis: ') + error.message, 'error')
    } else {
      setFiles(data || [])
    }
    
    // Fetch desktop builds (Workspaces & Projects)
    const { data: buildsData, error: buildsError } = await supabase
      .from('desktop_builds')
      .select('*')
      .eq('status', 'success')
      .not('download_url', 'is', null)
      .order('created_at', { ascending: false })
      
    if (!buildsError && buildsData) {
      setDesktopBuilds(buildsData)
    }

    setIsLoading(false)
  }

  useEffect(() => {
    fetchFiles()
    
    // Fetch release notes and local version for Auto Updater
    fetch('/api/releases')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setReleaseNotesList(data)
      })

    const checkVersion = async () => {
      const { isTauri } = await import('@tauri-apps/api/core')
      if (!isTauri()) {
        setLocalVersion('Web App Edition')
        return
      }
      try {
        const { getVersion } = await import('@tauri-apps/api/app')
        const v = await getVersion()
        setLocalVersion(`IDE Engine v${v}`)
      } catch (e: any) {
        setLocalVersion(`Erro: ${e.message || String(e)}`)
      }
    }
    checkVersion()
  }, [])

  const handleDownloadClick = async (file: any) => {
    if (file.category === 'template') {
      setDownloadModalFile(file)
      return
    }

    let downloadUrlToUse = ''
    let realFileName = ''
    let labelName = ''

    if (file.download_url) {
      downloadUrlToUse = file.download_url
      realFileName = file.download_url.split('/').pop() || 'app-installer.msi'
      const isWorkspaceTab = mainTab === 'workspaces'
      const projectName = isWorkspaceTab && file.context_type === 'project'
        ? (projects.find(p => p.id === file.context_id)?.name || t('client_views.downloads.unknown_project', 'Projeto'))
        : t('client_views.downloads.workspace_app', 'Workspace App')
      labelName = `${projectName} (${realFileName})`
    } else {
      const { data, error } = await supabase.storage.from('releases').createSignedUrl(file.bucket_path, 60 * 60)
      if (error || !data) {
        toast(t('client_views.downloads.toast_link_error', 'Erro ao gerar link de download.'), 'error')
        return
      }
      downloadUrlToUse = data.signedUrl
      realFileName = file.bucket_path?.split('/').pop() || file.file_path?.split('/').pop() || 'download.msi'
      labelName = (file.name || 'download').replace(/[^a-zA-Z0-9._\- ()]/g, '_')
    }

    // ─── Tauri IDE path: download with progress ───
    if (isTauri()) {
      const isProjectBuild = !!file.download_url
      setIdeDownloadModal({
        open: true,
        phase: 'downloading',
        fileName: labelName,
        progress: 0,
        savedPath: '',
        savedDir: '',
        canRun: false,
        isProject: isProjectBuild,
      })

      try {
        const abort = new AbortController()
        abortRef.current = abort

        const response = await fetch(downloadUrlToUse, { signal: abort.signal })
        if (!response.ok) throw new Error(t('client_views.downloads.error_start_download', 'Falha ao iniciar download'))

        const contentLength = Number(response.headers.get('content-length') || 0)
        const reader = response.body!.getReader()
        const chunks: Uint8Array[] = []
        let received = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.length
          const pct = contentLength > 0 ? Math.min(Math.round((received / contentLength) * 100), 99) : 0
          setIdeDownloadModal(prev => prev ? { ...prev, progress: pct } : prev)
        }

        // Merge chunks and save via Tauri fs plugin
        const total = chunks.reduce((a, c) => a + c.length, 0)
        const merged = new Uint8Array(total)
        let offset = 0
        for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length }

        const { downloadDir } = await import('@tauri-apps/api/path')
        const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')

        const dir = await downloadDir()
        const isWindows = dir.includes('\\') || !dir.startsWith('/')
        const separator = isWindows ? '\\' : '/'
        let fullPath = `${dir}${separator}${realFileName}`
        if (isWindows) {
          fullPath = fullPath.replace(/\//g, '\\')
        }

        console.log(`[Download] Saving to: ${fullPath}`)
        console.log(`[Download] File size: ${merged.length} bytes`)

        await writeFile(realFileName, merged, { baseDir: BaseDirectory.Download })

        // Arquivo .msi no Windows sempre pode ser executado
        const canRun = file.bucket_path?.toLowerCase().endsWith('.msi') || 
                       realFileName?.toLowerCase().endsWith('.msi')

        setIdeDownloadModal({
          open: true,
          phase: 'done',
          fileName: labelName,
          progress: 100,
          savedPath: fullPath,
          savedDir: dir,
          canRun,
          isProject: isProjectBuild,
        })
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.error('[Download] Error details:', err)
        console.error('[Download] Error message:', err?.message)
        console.error('[Download] Error type:', err?.constructor?.name)
        setIdeDownloadModal(prev => prev ? { ...prev, phase: 'error' } : prev)
      }
      return
    }

    // ─── Browser fallback ───
    const a = document.createElement('a')
    a.href = downloadUrlToUse
    a.download = realFileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleOpenFolder = async (dir: string, fileFullPath: string) => {
    try {
      if (fileFullPath) {
        const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
        await revealItemInDir(fileFullPath)
      } else {
        const { openPath } = await import('@tauri-apps/plugin-opener')
        await openPath(dir)
      }
    } catch (e) {
      console.error('Não foi possível abrir o explorador:', e)
      // fallback: tenta abrir apenas a pasta
      try {
        const { openPath } = await import('@tauri-apps/plugin-opener')
        await openPath(dir)
      } catch {}
    }
  }

  const handleRunInstaller = async (path: string, isProject?: boolean) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('runinstaller', { path })

      // Aguarda 1.5 segundos para garantir que o instalador do Windows (msiexec) inicie em background
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Só fecha a IDE se não for um projeto customizado (caso contrário a IDE continua aberta)
      if (!isProject) {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const current = getCurrentWindow()
        await current.close()
      }
    } catch (e) {
      console.error('Não foi possível executar o instalador:', e)
      alert(t('client_views.downloads.alert_install_error', 'Não foi possível executar o instalador: ') + e)
    }
  }

  const processTemplateDownload = async () => {
    if (!downloadModalFile) return
    setIsDownloading(true)
    try {
      // 1. Get signed URL
      const { data, error } = await supabase.storage.from('releases').createSignedUrl(downloadModalFile.bucket_path, 60 * 60)
      if (error || !data) throw error

      // 2. Fetch file content
      const response = await fetch(data.signedUrl)
      const jsonContent = await response.json()

      // 3. Inject Project Data
      const selectedProject = projects.find(p => p.id === selectedProjectId)
      if (selectedProject) {
        if (jsonContent.connections && jsonContent.connections.length > 0) {
          jsonContent.connections[0].projectId = selectedProject.id
          if (selectedProject.secret_token) {
            jsonContent.connections[0].secretToken = selectedProject.secret_token
          }
        }
      }

      // 4. Inject DB Data
      if (dbName && dbUser) { // only inject if user typed something
        let connectionString = ''
        if (dbType === 'postgres') {
          const passPart = dbPass ? `:${dbPass}` : ''
          connectionString = `postgresql://${dbUser}${passPart}@${dbHost}:${dbPort}/${dbName}`
        } else if (dbType === 'mysql') {
          const passPart = dbPass ? `:${dbPass}` : ''
          connectionString = `mysql://${dbUser}${passPart}@${dbHost}:${dbPort}/${dbName}`
        } else if (dbType === 'sqlserver') {
          const passPart = dbPass ? `Password=${dbPass};` : ''
          connectionString = `Server=${dbHost},${dbPort};Database=${dbName};User Id=${dbUser};${passPart}Encrypt=True;TrustServerCertificate=True;`
        }

        if (jsonContent.connections && jsonContent.connections.length > 0) {
          if (jsonContent.connections[0].connectionsString && jsonContent.connections[0].connectionsString.length > 0) {
            jsonContent.connections[0].connectionsString[0].name = 'erp'
            jsonContent.connections[0].connectionsString[0].type = dbType
            jsonContent.connections[0].connectionsString[0].connectionString = connectionString
          }
        }
      }

      // 5. Trigger Download
      const blob = new Blob([JSON.stringify(jsonContent, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'metabuilder.config.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast(t('client_views.downloads.toast_template_success', 'Template baixado com sucesso!'), 'success')
      setDownloadModalFile(null)
    } catch (err: any) {
      console.error(err)
      toast(t('client_views.downloads.toast_template_error', 'Erro ao processar template: ') + err.message, 'error')
    }
    setIsDownloading(false)
  }

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'cli-win': return t('client_views.downloads.cat_cli_win', 'CLI (Windows)')
      case 'cli-linux': return t('client_views.downloads.cat_cli_linux', 'CLI (Linux)')
      case 'template': return t('client_views.downloads.cat_template', 'Template JSON')
      case 'manual': return t('client_views.downloads.cat_manual', 'Manual PDF')
      case 'ide-win': return t('client_views.downloads.cat_ide_win', 'App (Windows)')
      case 'ide-mac': return t('client_views.downloads.cat_ide_mac', 'App (macOS)')
      case 'ide-linux': return t('client_views.downloads.cat_ide_linux', 'App (Linux)')
      default: return cat
    }
  }

  const filteredFiles = files.filter(f => {
    const isIde = ['ide-win', 'ide-mac', 'ide-linux'].includes(f.category);
    if (mainTab === 'ide' && !isIde) return false;
    if (mainTab === 'utils' && isIde) return false;

    if (filter === 'all') return true;
    return f.category === filter;
  });

  const finalFilteredFiles = (() => {
    if (mainTab === 'workspaces') {
      return desktopBuilds.filter(b => {
        if (filter === 'all') return true;
        return b.context_type === filter;
      });
    }

    if (mainTab === 'ide' && !showOlderReleases) {
      const seen = new Set();
      return filteredFiles.filter(f => {
        if (seen.has(f.category)) return false;
        seen.add(f.category);
        return true;
      });
    }
    return filteredFiles;
  })();

  // Sync default port when dbType changes
  useEffect(() => {
    if (dbType === 'postgres') setDbPort('5432')
    else if (dbType === 'mysql') setDbPort('3306')
    else if (dbType === 'sqlserver') setDbPort('1433')
  }, [dbType])

  return (
    <div className={`flex flex-col h-full bg-neutral-50 dark:bg-black p-8 pt-10 ${isPopout ? 'mt-8' : ''}`}>
      <div className="max-w-5xl mx-auto w-full space-y-6">
        <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg border border-indigo-500/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-white/10 border border-white/20 backdrop-blur-md uppercase tracking-widest">
                <Download className="w-3.5 h-3.5 text-cyan-400" /> {t('client_views.downloads.tag', 'Central de Downloads')}
              </span>
              <div className="flex items-center gap-2">
                {!isPopout && (
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.open('/client/downloads/popout', '_blank', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no')
                      }
                    }}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md border border-white/20 transition-all flex items-center gap-2 group"
                    title={t('client_views.downloads.focus_mode_tooltip', 'Abrir em Nova Janela (Modo Foco)')}
                  >
                    <span className="hidden md:inline text-xs font-bold uppercase tracking-widest group-hover:text-white">{t('client_views.downloads.focus_mode', 'Modo Foco')}</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => fetchFiles()}
                  disabled={isLoading}
                  title={t('client_views.downloads.refresh_tooltip', 'Atualizar lista')}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md border border-white/20 transition-all flex items-center justify-center disabled:opacity-50 group active:scale-95 duration-200"
                >
                  <RefreshCw className={`w-4 h-4 transition-transform duration-500 ease-out ${isLoading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                </button>
              </div>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">{t('client_views.downloads.title', 'Central de Downloads')}</h2>
            <p className="text-indigo-100 text-sm md:text-base leading-relaxed max-w-2xl">
              {t('client_views.downloads.desc', 'Baixe aqui o CLI (Windows/Linux), Manuais em PDF e Templates JSON.')}
            </p>
          </div>
        </div>

        {releaseNotesList.length > 0 && localVersion && (
          (() => {
            const installed = localVersion.replace('IDE Engine v', '').trim()
            const latest = releaseNotesList[0].version.replace('v', '')
            const isOutdated = localVersion.startsWith('IDE Engine') && installed !== latest && installed !== 'Erro:' && !localVersion.includes('Erro')
            
            if (isOutdated) {
              return (
                <div className="relative flex items-center justify-center mb-10 z-10">
                  <button 
                    onClick={async () => {
                      try {
                        setIsUpdating(true)
                        const { check } = await import('@tauri-apps/plugin-updater')
                        const update = await check()
                        if (update?.available) {
                          await import('@tauri-apps/api/core').then(m => m.invoke('stopcli')).catch(() => {});
                          await new Promise(r => setTimeout(r, 1500)); // Aguarda o SO liberar o arquivo
                          await update.downloadAndInstall((event: any) => {
                            // Progresso opcional — mantém o spinner visível
                            if (event.event === 'Finished') {
                              // Tauri reinicia automaticamente após instalar
                            }
                          })
                        } else {
                          // Nenhuma atualização encontrada pelo updater nativo — tenta abrir a Central de Downloads
                          toast(t('client_views.downloads.toast_auto_update_error', 'Não foi possível atualizar automaticamente. Baixe a nova versão pela Central de Downloads.'), 'error')
                          setIsUpdating(false)
                        }
                      } catch (e: any) {
                        console.error('Update failed', e)
                        toast(t('client_views.downloads.toast_update_error', 'Erro na atualização: ') + (e?.message || String(e)), 'error')
                        setIsUpdating(false)
                      }
                    }}
                    disabled={isUpdating}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-full shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
                  >
                    {isUpdating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t('client_views.downloads.updating', 'Atualizando...')}
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        {t('client_views.downloads.update_to_version', 'Atualizar para a versão {version}').replace('{version}', latest)}
                      </>
                    )}
                  </button>
                </div>
              )
            }
            return null
          })()
        )}

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-4 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => { setMainTab('ide'); setFilter('all'); }}
          className={`px-6 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition-colors ${mainTab === 'ide' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300'}`}
        >
          {t('client_views.downloads.tab_ide', 'App Desktop (IDE)')}
        </button>
        <button
          onClick={() => { setMainTab('workspaces'); setFilter('all'); }}
          className={`px-6 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition-colors ${mainTab === 'workspaces' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300'}`}
        >
          {t('client_views.downloads.tab_workspaces', 'Workspaces & Projetos')}
        </button>
        <button
          onClick={() => { setMainTab('utils'); setFilter('all'); }}
          className={`px-6 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition-colors ${mainTab === 'utils' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300'}`}
        >
          {t('client_views.downloads.tab_utils', 'Utilitários (CLI & JSON)')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-500 dark:text-neutral-400">
            <Filter className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">{t('client_views.downloads.filters_label', 'Filtros:')}</span>
          </div>
          {(mainTab === 'ide' ? [
            { id: 'all', label: t('client_views.downloads.filter_all', 'Todos') },
            { id: 'ide-win', label: t('client_views.downloads.filter_win', 'Windows') },
            { id: 'ide-mac', label: t('client_views.downloads.filter_mac', 'macOS') },
            { id: 'ide-linux', label: t('client_views.downloads.filter_linux', 'Linux') }
          ] : mainTab === 'workspaces' ? [
            { id: 'all', label: t('client_views.downloads.filter_all', 'Todos') },
            { id: 'workspace', label: t('client_views.downloads.filter_workspaces', 'Workspaces') },
            { id: 'project', label: t('client_views.downloads.filter_projects', 'Projetos') }
          ] : [
            { id: 'all', label: t('client_views.downloads.filter_all', 'Todos') },
            { id: 'cli-win', label: t('client_views.downloads.filter_cli_win', 'CLI Windows') },
            { id: 'cli-linux', label: t('client_views.downloads.filter_cli_linux', 'CLI Linux') },
            { id: 'template', label: t('client_views.downloads.filter_template', 'Templates') },
            { id: 'manual', label: t('client_views.downloads.filter_manual', 'Manuais') }
          ]).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === f.id
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {mainTab === 'ide' && (
          <button
            onClick={() => setShowOlderReleases(!showOlderReleases)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors border ${showOlderReleases
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400'
              : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800'
              }`}
          >
            <History className="w-4 h-4" />
            {showOlderReleases ? t('client_views.downloads.hide_older', 'Ocultar versões antigas') : t('client_views.downloads.show_older', 'Exibir versões anteriores')}
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('client_views.downloads.th_file_name', 'Nome do Arquivo')}</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('client_views.downloads.th_category', 'Categoria')}</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('client_views.downloads.th_size', 'Tamanho')}</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">{t('client_views.downloads.th_download', 'Download')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="p-12 text-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                </td>
              </tr>
            ) : finalFilteredFiles.length > 0 ? (
              finalFilteredFiles.map(file => {
                const isWorkspaceTab = mainTab === 'workspaces';
                const displayName = isWorkspaceTab
                  ? (file.context_type === 'project' 
                      ? projects.find(p => p.id === file.context_id)?.name || t('client_views.downloads.unknown_project', 'Projeto Desconhecido')
                      : t('client_views.downloads.workspace_app', 'Workspace App'))
                  : file.name;
                  
                const displayVersion = isWorkspaceTab
                  ? new Date(file.created_at).toLocaleDateString()
                  : `v${file.version}`;
                  
                const displayCategory = isWorkspaceTab
                  ? (file.context_type === 'project' ? t('client_views.downloads.category_project', 'Projeto') : t('client_views.downloads.category_workspace', 'Workspace'))
                  : getCategoryLabel(file.category);
                  
                const displaySize = isWorkspaceTab
                  ? (file.size_bytes ? `${(file.size_bytes / 1024 / 1024).toFixed(2)} MB` : '--')
                  : `${(file.size_bytes / 1024 / 1024).toFixed(2)} MB`;

                return (
                  <tr key={file.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                        <FileIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-neutral-900 dark:text-white block">{displayName}</span>
                        <span className="text-xs font-medium text-neutral-500">{displayVersion}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
                        {displayCategory}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                      {displaySize}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDownloadClick(file)}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2 ml-auto"
                      >
                        <Download className="w-4 h-4" />
                        <span>{t('client_views.downloads.download_btn', 'Baixar')}</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="p-12 text-center">
                  <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Download className="w-8 h-8 text-neutral-400" />
                  </div>
                  <p className="text-sm font-bold text-neutral-500">{t('client_views.downloads.no_files', 'Nenhum arquivo disponível no momento.')}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* IDE Download Progress Modal */}
      {ideDownloadModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white text-center">
              <div className="mx-auto bg-white/20 w-14 h-14 rounded-full flex items-center justify-center mb-3">
                {ideDownloadModal.phase === 'done' ? (
                  <CheckCircle className="w-7 h-7 text-white" />
                ) : ideDownloadModal.phase === 'error' ? (
                  <X className="w-7 h-7 text-white" />
                ) : (
                  <Download className="w-7 h-7 text-white" />
                )}
              </div>
              <h3 className="text-lg font-black">
                {ideDownloadModal.phase === 'downloading' && t('client_views.downloads.modal_downloading', 'Baixando...')}
                {ideDownloadModal.phase === 'done' && t('client_views.downloads.modal_download_done', 'Download Concluído!')}
                {ideDownloadModal.phase === 'error' && t('client_views.downloads.modal_download_error', 'Erro no Download')}
              </h3>
              <p className="text-indigo-100 text-sm mt-1 truncate max-w-xs mx-auto">{ideDownloadModal.fileName}</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Progress bar */}
              {ideDownloadModal.phase === 'downloading' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-neutral-500">
                    <span>{t('client_views.downloads.modal_progress', 'Progresso')}</span>
                    <span>{ideDownloadModal.progress}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${ideDownloadModal.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-neutral-400">{t('client_views.downloads.modal_saving_hint', 'Salvando na pasta Downloads do sistema...')}</p>
                </div>
              )}

              {/* Done state */}
              {ideDownloadModal.phase === 'done' && (
                <div className="space-y-3">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-400 text-center font-medium">
                    {t('client_views.downloads.modal_saved_in', 'Arquivo salvo em:')} <span className="font-bold">Downloads</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => handleOpenFolder(ideDownloadModal.savedDir, ideDownloadModal.savedPath)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <FolderOpen className="w-4 h-4" />
                      {t('client_views.downloads.modal_open_folder', 'Abrir Pasta')}
                    </button>

                    {ideDownloadModal.canRun ? (
                      <button
                        onClick={() => handleRunInstaller(ideDownloadModal.savedPath, ideDownloadModal.isProject)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                      >
                        <Play className="w-4 h-4" />
                        {t('client_views.downloads.modal_install_now', 'Instalar Agora')}
                      </button>
                    ) : (
                      <div className="flex-1 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400 text-center font-medium flex items-center justify-center">
                        {t('client_views.downloads.modal_close_ide_hint', 'Feche a IDE antes de instalar')}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setIdeDownloadModal(null)}
                    className="w-full text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 font-bold uppercase tracking-widest py-1 transition-colors"
                  >
                    {t('client_views.downloads.modal_close', 'Fechar')}
                  </button>
                </div>
              )}

              {/* Error state */}
              {ideDownloadModal.phase === 'error' && (
                <div className="space-y-3">
                  <p className="text-sm text-center text-red-500 font-medium">{t('client_views.downloads.modal_error_desc', 'Não foi possível completar o download. Tente novamente.')}</p>
                  <button
                    onClick={() => setIdeDownloadModal(null)}
                    className="w-full px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    {t('client_views.downloads.modal_close', 'Fechar')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Template Download Modal */}
      {downloadModalFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-neutral-900 dark:text-white">{t('client_views.downloads.template_title', 'Configurar Template')}</h3>
              <button onClick={() => setDownloadModalFile(null)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">{t('client_views.downloads.template_link_project', 'Vincular a um Projeto (Opcional)')}</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">{t('client_views.downloads.template_no_link', 'Baixar sem vincular')}</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-400">{t('client_views.downloads.template_link_hint', 'Ao selecionar, o arquivo já virá com o Project ID e Secret Token preenchidos.')}</p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">{t('client_views.downloads.template_db_conn', 'Conexão do Banco de Dados (Opcional)')}</label>
                <p className="text-[11px] text-neutral-400 mb-2">{t('client_views.downloads.template_db_hint', 'Preencha se quiser que a string de conexão já venha montada no JSON.')}</p>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={dbType}
                    onChange={(e) => setDbType(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="sqlserver">SQL Server</option>
                  </select>

                  <input
                    type="text" placeholder={t('client_views.downloads.template_host_placeholder', 'Host (ex: localhost)')}
                    value={dbHost} onChange={(e) => setDbHost(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text" placeholder={t('client_views.downloads.template_port_placeholder', 'Porta (ex: 5432)')}
                    value={dbPort} onChange={(e) => setDbPort(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="text" placeholder="Database"
                    className="col-span-2 w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={dbName} onChange={(e) => setDbName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text" placeholder={t('client_views.downloads.template_user_placeholder', 'Usuário')}
                    value={dbUser} onChange={(e) => setDbUser(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="password" placeholder={t('client_views.downloads.template_pass_placeholder', 'Senha')}
                    value={dbPass} onChange={(e) => setDbPass(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <button
                onClick={processTemplateDownload}
                disabled={isDownloading}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {isDownloading ? t('client_views.downloads.template_btn_processing', 'Processando...') : t('client_views.downloads.template_btn_download', 'Baixar Template')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
