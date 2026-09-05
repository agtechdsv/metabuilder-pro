'use client'

import { useState } from 'react'
import { isTauri } from '@/utils/tauriUtils'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import { DownloadModalState, Project } from './types'

export function useProjectExport() {
  const [downloadModal, setDownloadModal] = useState<DownloadModalState | null>(null)
  const [exportModels, setExportModels] = useState<any[]>([])
  const { toast } = useToast()
  const { t } = useI18n()

  const openExportModal = async (project: Project) => {
    const supabase = createClient()
    const { data: authConf } = await supabase
      .from('project_auth_config')
      .select('auth_type, auth_config')
      .eq('project_id', project.id)
      .maybeSingle()

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
      authConfig: authConf?.auth_config
    })
  }

  const handleStartExport = async (
    projectId: string,
    fileName: string,
    dataMode: string,
    authStrategy: string,
    legacyDriver: string,
    dbConfig?: any,
    authConfig?: any
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
          authConfig
        })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao gerar código')
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

        setDownloadModal(prev => prev ? { ...prev, phase: 'selecting', progress: 100 } : prev)
        toast('Extraindo projeto...', 'info')

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

        toast('Instalando dependências (npm install)...', 'info')
        const cmd = Command.create('npm', ['install'], { cwd: selectedDir })
        const output = await cmd.execute()
        if (output.code !== 0) {
          console.error('NPM Install failed:', output.stderr)
          toast('As dependências foram instaladas com erros, verifique o terminal.', 'error')
        } else {
          toast('Dependências instaladas com sucesso!', 'success')
          try {
            const { sendNotification } = await import('@tauri-apps/plugin-notification')
            sendNotification({
              title: t('ide.project.eject_notif_title', 'Projeto Ejetado! 🎉'),
              body: t('ide.project.eject_notif_body', 'Os arquivos e dependências foram instalados com sucesso.')
            })
          } catch (err) { console.error('Native notification error', err) }
        }

        setDownloadModal({
          open: true,
          phase: 'done',
          fileName,
          progress: 100,
          savedPath: selectedDir,
          savedDir: selectedDir
        })

        if (confirm('Projeto ejetado e dependências instaladas! Deseja abrir no VS Code?')) {
          const codeCmd = Command.create('code', ['.'], { cwd: selectedDir })
          await codeCmd.execute()
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
          savedDir: 'Downloads'
        })
      }
    } catch (error: any) {
      setDownloadModal(prev => prev ? { ...prev, phase: 'error', progress: 0 } : null)
      toast('Falha na exportação: ' + error.message, 'error')
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
