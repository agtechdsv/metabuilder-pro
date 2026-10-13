'use client'

import { useState } from 'react'
import { isTauri } from '@/utils/tauriUtils'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import { DownloadModalState, ExportDefaults, Project } from './types'

/** Pergunta sim/não: usa o diálogo nativo do desktop (o confirm() do navegador pode nem aparecer no webview). */
async function askUser(message: string): Promise<boolean> {
  try {
    const { ask } = await import('@tauri-apps/plugin-dialog')
    return await ask(message, { title: 'MetaBuilder PRO', kind: 'info' })
  } catch {
    return confirm(message)
  }
}

export function useProjectExport() {
  const [downloadModal, setDownloadModal] = useState<DownloadModalState | null>(null)
  const [exportModels, setExportModels] = useState<any[]>([])
  const { toast } = useToast()
  const { t } = useI18n()

  const openExportModal = async (project: Project) => {
    const supabase = createClient()
    const [{ data: authConf }, { data: projRow }] = await Promise.all([
      supabase
        .from('project_auth_config')
        .select('auth_type, db_table_name, db_email_column, db_password_column, db_password_hash_type')
        .eq('project_id', project.id)
        .maybeSingle(),
      supabase.from('projects').select('db_type').eq('id', project.id).maybeSingle(),
    ])

    // Abre o modal já com o que o projeto tem configurado (banco e login), em vez do padrão genérico
    const defaults: ExportDefaults = {}
    const dbType = String(projRow?.db_type || '').toLowerCase()
    if (dbType === 'postgres' || dbType === 'oracle' || dbType === 'mysql' || dbType === 'sqlserver') defaults.dataMode = dbType
    // Conexão já salva no metabuilder.config.json local deste projeto (só existe no desktop)
    if (isTauri()) {
      try {
        const { getProjectDbConnection } = await import('@/utils/tunnelConfigFile')
        const c = await getProjectDbConnection(project.id, dbType)
        if (c) {
          defaults.dbConnection = { user: c.user, password: c.password, host: c.host, port: c.port, database: c.database }
          if (!defaults.dataMode && (c.type === 'postgres' || c.type === 'oracle' || c.type === 'mysql' || c.type === 'sqlserver')) defaults.dataMode = c.type
        }
      } catch (e) {
        console.warn('Não foi possível ler a conexão do metabuilder.config.json:', e)
      }
    }
    const at = String(authConf?.auth_type || '').toLowerCase()
    if (at === 'database') {
      defaults.authStrategy = 'legacy'
      defaults.legacyDriver = dbType === 'postgres' ? 'postgres' : 'supabase'
      if (authConf?.db_table_name) defaults.authTable = authConf.db_table_name
      if (authConf?.db_email_column) defaults.authEmailColumn = authConf.db_email_column
      if (authConf?.db_password_column) defaults.authPasswordColumn = authConf.db_password_column
      const hash = String(authConf?.db_password_hash_type || '').toLowerCase()
      defaults.authHash = hash === 'md5' ? 'MD5' : hash === 'plain' || hash === 'plaintext' ? 'Plain' : 'Bcrypt'
    } else if (at === 'ldap') {
      defaults.authStrategy = 'ldap'
    } else if (at === 'none') {
      defaults.authStrategy = 'none'
    }

    const { data: models, error: modelsError } = await supabase
      .from('models')
      .select('id, db_table_name')
      .eq('project_id', project.id)
      .order('db_table_name')

    if (models && models.length > 0) {
      const { data: fields } = await supabase
        .from('fields')
        .select('id, db_column_name, model_id')
        .in('model_id', models.map(m => m.id))

      const mappedModels = models.map(m => ({
        ...m,
        fields: fields?.filter(f => f.model_id === m.id) || []
      }))
      setExportModels(mappedModels)
    } else {
      if (modelsError) console.error('Error fetching models:', modelsError)
      setExportModels([])
    }

    setDownloadModal({
      open: true,
      phase: 'selecting',
      fileName: `${project.slug || 'app'}-source-code.zip`,
      progress: 0,
      savedPath: '',
      savedDir: '',
      projectId: project.id,
      authConfig: authConf,
      defaults
    })
  }

  const handleStartExport = async (
    projectId: string,
    fileName: string,
    dataMode: string,
    authStrategy: string,
    legacyDriver: string,
    dbConfig?: any,
    authConfig?: any,
    backendStack: string = 'nodejs',
    javaGroupId?: string,
    javaPort?: number,
    accessAdmin?: boolean
  ) => {
    setDownloadModal({
      open: true,
      phase: 'downloading',
      fileName,
      progress: 0,
      savedPath: '',
      savedDir: '',
      projectId
    })

    try {
      const dbStackMap: Record<string, string> = {
        'supabase': 'supabase',
        'postgres': 'postgres',
        'oracle': 'oracle',
        'mysql': 'mysql',
        'sqlserver': 'sqlserver',
        'metabuilder': 'postgres'
      }
      const dbStack = dbStackMap[dataMode] || 'postgres'

      const dbConnectionString = dbConfig?.connectionString
        || (dataMode === 'postgres' && dbConfig
          ? `postgres://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
          : undefined)

      const res = await fetch('/api/export-native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          dbStack,
          dbConnectionString,
          supabaseUrl: dbConfig?.supabaseUrl,
          supabaseAnonKey: dbConfig?.supabaseAnonKey,
          authStrategy,
          authConfig,
          backendStack,
          javaGroupId: backendStack === 'java-spring' ? javaGroupId : undefined,
          javaPort: backendStack === 'java-spring' ? javaPort : undefined,
          javaVersion: 21,
          accessAdmin: accessAdmin === true
        })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || t('ide.project.export_gen_error'))
      }

      const contentLength = Number(res.headers.get('content-length') || 0)
      const reader = res.body!.getReader()
      const chunks: Uint8Array[] = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        const pct = contentLength > 0 ? Math.min(Math.round((received / contentLength) * 100), 99) : 0
        setDownloadModal(prev => prev ? { ...prev, progress: pct } : prev)
      }

      const total = chunks.reduce((a, c) => a + c.length, 0)
      const merged = new Uint8Array(total)
      let offset = 0
      for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length }

      if (isTauri()) {
        const { open } = await import('@tauri-apps/plugin-dialog')
        const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs')
        const { join, dirname } = await import('@tauri-apps/api/path')
        const { Command } = await import('@tauri-apps/plugin-shell')
        const JSZip = (await import('jszip')).default

        const selectedDir = await open({ directory: true })
        if (!selectedDir || typeof selectedDir !== 'string') {
          setDownloadModal(null)
          return
        }

        // grava e instala com a modal travada em "processando": não volta para a configuração enquanto isso
        setDownloadModal(prev => prev ? { ...prev, phase: 'processing', progress: 100, statusMessage: t('ide.project.export_extracting') } : prev)
        toast(t('ide.project.export_extracting'), 'info')

        const zip = await JSZip.loadAsync(merged)

        for (const relativePath of Object.keys(zip.files)) {
          const zipEntry = zip.files[relativePath]
          if (zipEntry.dir) continue

          const fullPath = await join(selectedDir, relativePath)
          const dirPath = await dirname(fullPath)

          try {
            await mkdir(dirPath, { recursive: true })
          } catch (e) { }

          const fileBytes = await zipEntry.async('uint8array')
          await writeFile(fullPath, fileBytes)
        }

        setDownloadModal(prev => prev ? { ...prev, phase: 'processing', statusMessage: t('ide.project.export_installing') } : prev)
        toast(t('ide.project.export_installing'), 'info')
        // No Windows o npm é "npm.cmd": o Tauri só o encontra através do cmd
        const isWindows = /windows/i.test(navigator.userAgent)
        let installOk = false
        try {
          const cmd = isWindows
            ? Command.create('cmd', ['/c', 'npm', 'install'], { cwd: selectedDir })
            : Command.create('npm', ['install'], { cwd: selectedDir })
          const output = await cmd.execute()
          installOk = output.code === 0
          if (!installOk) console.error('NPM Install failed:', output.stderr)
        } catch (installErr) {
          console.error('NPM Install failed to start:', installErr)
        }
        if (!installOk) {
          // os arquivos já foram gravados: não é falha da exportação
          toast(t('ide.project.export_install_failed'), 'error')
        } else {
          toast(t('ide.project.export_install_ok'), 'success')
          try {
            const { sendNotification } = await import('@tauri-apps/plugin-notification')
            sendNotification({
              title: t('ide.project.eject_notif_title', 'Projeto Ejetado! 🎉'),
              body: t('ide.project.eject_notif_body', 'Os arquivos e dependências foram instalados com sucesso.')
            })
          } catch (err) { console.error('Native notification error', err) }
        }

        // gestão de acesso: cria as tabelas de acesso no banco do projeto (só com a confirmação do usuário)
        let accessSetupDone = false
        let setupError = ''
        const needsAccessSetup = accessAdmin === true && backendStack !== 'java-spring' && dataMode !== 'supabase' && dataMode !== 'tunnel'
        const canRunSetup = needsAccessSetup && isWindows
        if (canRunSetup && installOk && await askUser(t('export_modal.access_setup_confirm', "Criar agora as tabelas de acesso no banco do projeto? (Rodará npm run db:setup com a conexão do .env.local. Se o usuário do banco não puder criar tabelas, responda Cancelar e use db/access-control.sql.)"))) {
          setDownloadModal(prev => prev ? { ...prev, phase: 'processing', statusMessage: t('export_modal.access_setup_running', "Criando as tabelas de acesso...") } : prev)
          try {
            // as permissões do desktop só liberam comandos com os nomes/argumentos conhecidos; o PowerShell é o que aceita qualquer comando
            const setupCmd = Command.create('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'npm run db:setup'], { cwd: selectedDir })
            const out = await setupCmd.execute()
            accessSetupDone = out.code === 0
            if (!accessSetupDone) {
              console.error('db:setup falhou:', out.stderr || out.stdout)
              setupError = String(out.stderr || out.stdout || '').trim().split(String.fromCharCode(10)).slice(-3).join(' ').slice(0, 300)
            }
          } catch (setupErr) {
            console.error('db:setup não iniciou:', setupErr)
            setupError = String((setupErr as any)?.message || setupErr).slice(0, 300)
          }
          toast(accessSetupDone ? t('export_modal.access_setup_ok', "Tabelas de acesso criadas no banco.") : t('export_modal.access_setup_failed', "Não foi possível criar as tabelas de acesso. Rode npm run db:setup na pasta do projeto ou execute db/access-control.sql no banco.") + (setupError ? ' [' + setupError + ']' : ''), accessSetupDone ? 'success' : 'error')
        }

        setDownloadModal({
          open: true,
          phase: 'done',
          fileName,
          progress: 100,
          savedPath: selectedDir,
          savedDir: selectedDir,
          accessSetupNote: needsAccessSetup && !accessSetupDone,
        })

        if (await askUser(installOk ? t('ide.project.export_open_vscode_ok') : t('ide.project.export_open_vscode'))) {
          try {
            // no Windows o nome liberado nas permissões para abrir o VS Code é 'cmd-code' (o 'cmd' só aceita npm install)
            const codeCmd = isWindows
              ? Command.create('cmd-code', ['/c', 'code', '.'], { cwd: selectedDir })
              : Command.create('code', ['.'], { cwd: selectedDir })
            await codeCmd.execute()
          } catch (codeErr) {
            console.error('Não foi possível abrir o VS Code:', codeErr)
            toast(t('export_modal.open_vscode_failed', 'Não foi possível abrir o VS Code. Abra a pasta do projeto nele manualmente.'), 'error')
          }
        }

      } else {
        const blob = new Blob([merged], { type: 'application/zip' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)

        setDownloadModal({
          open: true,
          phase: 'done',
          fileName,
          progress: 100,
          savedPath: '',
          savedDir: 'Downloads',
          accessSetupNote: accessAdmin === true && backendStack !== 'java-spring' && dataMode !== 'supabase' && dataMode !== 'tunnel',
        })
      }
    } catch (error: any) {
      setDownloadModal(prev => prev ? { ...prev, phase: 'error', progress: 0, errorMessage: error?.message || String(error) } : null)
      toast(t('ide.project.export_failed') + ' ' + (error?.message || String(error)), 'error')
    }
  }

  return {
    downloadModal,
    setDownloadModal,
    exportModels,
    openExportModal,
    handleStartExport
  }
}
