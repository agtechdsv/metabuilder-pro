'use client'

import { useState } from 'react'
import { isTauri } from '@/utils/tauriUtils'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import { DownloadModalState, ExportDefaults, Project } from './types'

/** Pergunta sim/não: usa o diálogo nativo do desktop (o confirm() do navegador pode nem aparecer no webview). */
export async function askUser(message: string): Promise<boolean> {
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

  const openExportModal = async (project: Project, prefill?: Partial<ExportDefaults>) => {
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
    } else if (at) {
      // login gerenciado (Supabase): a modal não tem esta opção, então a exportação mantém o login do projeto
      defaults.authStrategy = 'managed'
    }

    // o que o dev já escolheu na tela de sincronização vale aqui (stack, opções de Java, login, gestão de acesso)
    if (prefill) Object.assign(defaults, Object.fromEntries(Object.entries(prefill).filter(([, v]) => v !== undefined)))

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
    accessAdmin?: boolean,
    javaOptions?: Record<string, unknown>,
    cleanBefore?: boolean
  ) => {
    if (!isTauri()) {
      // o código fonte é gerado pela IDE Desktop (grava na pasta, instala, executa); o navegador não baixa mais ZIP
      setDownloadModal({ open: true, phase: 'error', fileName, progress: 0, savedPath: '', savedDir: '', projectId, errorMessage: t('export_modal.desktop_only', 'A exportação do código fonte está disponível apenas na IDE Desktop. Baixe a IDE na Central de Downloads.') })
      return
    }

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
          authConfig,
          backendStack,
          javaGroupId: backendStack === 'java-spring' ? javaGroupId : undefined,
          javaPort: backendStack === 'java-spring' ? javaPort : undefined,
          javaVersion: 21,
          accessAdmin: accessAdmin === true,
          ...(backendStack === 'java-spring' ? (javaOptions || {}) : {}),
          // o que a modal escolheu para o login vale na geração (sem isso, o app seguia o login do projeto)
          authStrategy: authStrategy === 'managed' ? undefined : authStrategy,
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

        // recursive: libera a pasta escolhida (e o que há dentro) para gravação, mesmo fora do perfil do usuário
        const selectedDir = await open({ directory: true, recursive: true })
        if (!selectedDir || typeof selectedDir !== 'string') {
          setDownloadModal(null)
          return
        }

        // limpar a pasta antes (opção da modal): confirma vendo o que será apagado; só pasta que parece um app exportado; nada de raiz de disco nem pasta comum do usuário
        if (cleanBefore) {
          const { isSafeToClean, planCleanup, cleanFolder, confirmMessage } = await import('@/utils/cleanExportFolder')
          const { homeDir } = await import('@tauri-apps/api/path')
          const abortar = (msg: string) => { toast(msg, 'error'); setDownloadModal(null) }
          if (!isSafeToClean(selectedDir, await homeDir().catch(() => ''))) { abortar(t('export_modal.clean_unsafe', 'Esta pasta não pode ser limpa.')); return }
          const plano = await planCleanup(selectedDir)
          if (!plano) { abortar(t('export_modal.clean_failed', 'Não foi possível limpar a pasta. Nada foi exportado.')); return }
          if (plano.existe && plano.arquivos > 0) {
            if (!plano.exportado) { abortar(t('export_modal.clean_not_app', 'A pasta tem outros arquivos e não parece um app exportado.')); return }
            const { ask } = await import('@tauri-apps/plugin-dialog')
            const ok = await ask(confirmMessage(selectedDir, plano, t('export_modal.clean_message', 'Vão ser apagados {count} arquivo(s) de: {dir}. {entries}. Ficam: {kept}.')), {
              title: t('export_modal.clean_title', 'Limpar a pasta antes de exportar?'), kind: 'warning',
              okLabel: t('export_modal.clean_ok', 'Limpar e exportar'), cancelLabel: t('export_modal.clean_cancel', 'Cancelar'),
            })
            if (!ok) { setDownloadModal(null); return }
            setDownloadModal(prev => prev ? { ...prev, phase: 'processing', progress: 100, statusMessage: t('export_modal.clean_running', 'Limpando a pasta...') } : prev)
            if (!(await cleanFolder(selectedDir))) { abortar(t('export_modal.clean_failed', 'Não foi possível limpar a pasta. Nada foi exportado.')); return }
          }
        }

        // grava e instala com a modal travada em "processando": não volta para a configuração enquanto isso
        setDownloadModal(prev => prev ? { ...prev, phase: 'processing', progress: 100, statusMessage: t('ide.project.export_extracting') } : prev)
        toast(t('ide.project.export_extracting'), 'info')

        const zip = await JSZip.loadAsync(merged)
        const nodeDir = backendStack === 'java-spring' ? await join(selectedDir, 'frontend') : selectedDir

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
            ? Command.create('cmd', ['/c', 'npm', 'install'], { cwd: nodeDir })
            : Command.create('npm', ['install'], { cwd: nodeDir })
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
        // antes de perguntar, confere se as tabelas já existem (de uma exportação anterior): se existem, nada é recriado nem alterado
        let tablesExisted: number | null = null
        if (canRunSetup && installOk) {
          try {
            const chk = await Command.create('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'npm run db:setup -- --check'], { cwd: selectedDir }).execute()
            const m = String(chk.stdout || '').match(/MB_ACCESS_CHECK (missing|exists)(?: (\d+))?/)
            if (m && m[1] === 'exists') tablesExisted = Number(m[2] || 0)
          } catch (checkErr) {
            console.error('db:setup --check falhou:', checkErr)
          }
        }
        if (tablesExisted !== null) {
          toast(t('export_modal.access_exists', 'As tabelas de acesso já existem no banco ({n} permissões gravadas) e foram mantidas: nenhum dado foi alterado.').replace('{n}', String(tablesExisted)), 'info')
        } else if (canRunSetup && installOk && await askUser(t('export_modal.access_setup_confirm', "Criar agora as tabelas de acesso no banco do projeto? (Rodará npm run db:setup com a conexão do .env.local. Se o usuário do banco não puder criar tabelas, responda Cancelar e use db/access-control.sql.)"))) {
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

        try { (await import('@/utils/deliveryIO')).rememberDeliveryFolder(projectId, selectedDir) } catch { /* sem armazenamento */ }
        setDownloadModal({
          open: true,
          phase: 'done',
          fileName,
          progress: 100,
          savedPath: selectedDir,
          savedDir: selectedDir,
          accessSetupNote: needsAccessSetup && !accessSetupDone && tablesExisted === null,
          accessTablesExisted: tablesExisted ?? undefined,
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
