'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, FlaskConical, Play, Square, Loader2, CheckCircle2, FolderOpen, Eye, EyeOff, ShieldAlert, FileText, RefreshCw, ChevronDown, Printer, Download, RotateCcw, History as HistoryIcon, ChevronUp, Eraser, Image as ImageIcon, Video as VideoIcon, Circle,
} from 'lucide-react'
import { useI18n } from '@/i18n'
import { createClient } from '@/utils/supabase/client'
import { isTauri } from '@/utils/tauriUtils'
import { pickFolder } from '@/utils/exportToFolder'
import { checkRunnerDir, clearLiveFrame, archiveTechReport, hasFfmpeg, installFfmpeg, hasCompatBrowsers, installCompatBrowsers, makePdf, openTestReport, readLiveFrame, startTestRun, workDir, writeManifest, type TestRunHandle, type TestWatchMode } from '@/utils/testRunner'
import { buildCopyScript, buildDbUrl, createDbCopy, dbKey, dbTipoDoProjeto, appHasAccessAdmin, detectAppKind, hasJdk, suggestCopyName, detectBrowser, emptyDbSettings, engineE2eDir, engineStatus, installEngine, loadDbSettings, readAppDbUrl, runDbTool, saveDbSettings, writeEngineConfig, type DbSettings, type EngineStatus } from '@/utils/testEngine'
import { IdeTestDb, type DbBusy, type DbResult } from './IdeTestDb'
import { artifactsDirFor, deleteRuns, historyDir, listRuns, readEvidenceBlob, readEvidenceDataUri, saveRun } from '@/utils/testHistory'
import { suggestAppFolders, type AppFolderSuggestion } from '@/utils/deliveryIO'
import { CARGA_MAX_USERS, cargaGrava, describeName, isSupportedView, normalizarCarga, planTitle, planView, type CargaModo, type CargaOpcoes, type TestType } from '@/lib/testing/plan'
import type { TestManifest, ManifestView } from '@/lib/testing/manifestTypes'
import type { TestEvent, TestStatus } from '@/lib/testing/results'
import { buildReportHtml } from '@/lib/testing/reportHtml'
import { runId, runTotals, type HistoryGroup, type HistoryRun, type RowStatus } from '@/lib/testing/history'
import { IdeTestHistory } from './IdeTestHistory'
import { IdeTestCompareModal } from './IdeTestCompareModal'
import { StatusIcon } from './IdeTestStatus'

interface Props {
  isOpen: boolean
  onClose: () => void
  target: { type: 'project' | 'workspace'; id: string; name: string; slug: string } | null
}

interface Result { status: TestStatus; ms?: number; error?: string; reason?: string; shot?: string; video?: string }
const keyOf = (group: string, title: string) => `${group}||${title}`

const lsGet = (k: string) => { try { return localStorage.getItem(k) || '' } catch { return '' } }
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sem armazenamento */ } }

/**
 * Ambiente de Testes (IDE Local): o dev escolhe o tipo de teste e os casos de uso, vê o plano gerado a partir do que ele configurou no Studio e
 * roda, acompanhando pelo navegador interno (imagem no painel), pelo navegador do sistema ou em segundo plano. Cada rodada fica gravada no histórico.
 */
export function IdeTestModal({ isOpen, onClose, target }: Props) {
  const { t, language } = useI18n()
  const [tab, setTab] = useState<'run' | 'history'>('run')
  const [manifest, setManifest] = useState<TestManifest | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [appDir, setAppDir] = useState('')
  // pastas do projeto com um app pronto (a do Sincronizar e a da última Entrega): a primeira vira a pasta de teste quando o dev ainda não escolheu
  const [folderSuggestions, setFolderSuggestions] = useState<AppFolderSuggestion[]>([])
  const [appDirAuto, setAppDirAuto] = useState(false)
  // o motor é sempre o instalado pela IDE (pasta do motor em `managedDir`)
  const [managedDir, setManagedDir] = useState('')
  const [engineSt, setEngineSt] = useState<EngineStatus | null>(null)
  const [engineBusy, setEngineBusy] = useState<'' | 'files' | 'npm'>('')
  const [engineErr, setEngineErr] = useState('')
  const [browserName, setBrowserName] = useState<'chrome' | 'msedge' | null>(null)
  const [dbSettings, setDbSettings] = useState<DbSettings>(emptyDbSettings())
  const [dbBusy, setDbBusy] = useState<DbBusy>('')
  const [dbResult, setDbResult] = useState<DbResult | null>(null)
  const [appDbHint, setAppDbHint] = useState('')
  const [appDbUrl, setAppDbUrl] = useState('')
  const [copyName, setCopyName] = useState('')
  // o app exportado tem a gestão de acesso? (null = ainda verificando). Muda o plano: grupos, usuário de teste no grupo de administração e os testes dela.
  const [appAccess, setAppAccess] = useState<boolean | null>(null)
  const runnerDir = managedDir
  const [mode, setMode] = useState<TestWatchMode>('internal')
  const [types, setTypes] = useState<TestType[]>(() => { const v = lsGet('mb_tests_types').split(',').filter((x): x is TestType => x === 'funcional' || x === 'integracao' || x === 'seguranca' || x === 'compat' || x === 'carga' || x === 'visual'); return v.length ? v : ['funcional'] })
  // Desempenho e carga: quantos usuários simultâneos e o que medir (leitura, gravação, mistura); lembrado entre as aberturas
  const [carga, setCarga] = useState<CargaOpcoes>(() => { try { return normalizarCarga(JSON.parse(lsGet('mb_tests_carga') || '{}')) } catch { return normalizarCarga() } })
  const changeCarga = (next: Partial<CargaOpcoes>) => setCarga(prev => { const n = normalizarCarga({ ...prev, ...next }); lsSet('mb_tests_carga', JSON.stringify(n)); return n })
  const toggleCargaModo = (m: CargaModo) => changeCarga({ modos: carga.modos.includes(m) ? (carga.modos.length > 1 ? carga.modos.filter(x => x !== m) : carga.modos) : [...carga.modos, m] })
  const [cargaUsersText, setCargaUsersText] = useState(() => String(carga.users))
  const toggleType = (id: TestType) => setTypes(prev => {
    const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    if (next.length === 0) return prev // pelo menos um tipo
    lsSet('mb_tests_types', next.join(','))
    return next
  })
  const planFor = useCallback((v: ManifestView) => planView(v, { types, auth: manifest?.auth, carga }), [types, manifest, carga])
  const [frameUrl, setFrameUrl] = useState('')
  const [liveOpen, setLiveOpen] = useState(true)
  // só lê quadros do navegador depois que o quadro da execução anterior foi apagado (senão a imagem velha aparece nos primeiros instantes)
  const [liveGate, setLiveGate] = useState(false)
  const [secOpen, setSecOpen] = useState<Record<'type' | 'scope' | 'where', boolean>>({ type: true, scope: true, where: true })
  const [runTotal, setRunTotal] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [slow, setSlow] = useState(300)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Record<string, Result>>({})
  const [summary, setSummary] = useState<{ total: number; passed: number; failed: number; skipped: number } | null>(null)
  const [runError, setRunError] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const handle = useRef<TestRunHandle | null>(null)
  const [reportMenu, setReportMenu] = useState(false)
  const [report, setReport] = useState<{ html: string; json: string; base: string } | null>(null)
  const [downloadMenu, setDownloadMenu] = useState(false)
  // vídeo das falhas: precisa do ffmpeg do Playwright (download pequeno, só com o aceite do usuário)
  const [ffmpeg, setFfmpeg] = useState<'unknown' | 'ok' | 'missing' | 'installing'>('unknown')
  const [ffmpegErr, setFfmpegErr] = useState('')
  const [askFfmpeg, setAskFfmpeg] = useState<{ only?: ManifestView[] } | null>(null)
  const ffmpegSkipped = useRef(false)
  // compatibilidade: Firefox e WebKit são baixados só com o aceite do usuário
  const [compatBr, setCompatBr] = useState<'unknown' | 'ok' | 'missing' | 'installing'>('unknown')
  const [compatErr, setCompatErr] = useState('')
  const [askCompat, setAskCompat] = useState<{ only?: ManifestView[] } | null>(null)
  const compatSkipped = useRef(false)
  const [reportMsg, setReportMsg] = useState<{ kind: 'busy' | 'ok' | 'err'; text: string } | null>(null)
  const [media, setMedia] = useState<{ kind: 'image' | 'video'; url: string; title: string } | null>(null)
  const reportFrame = useRef<HTMLIFrameElement | null>(null)
  // histórico
  const [history, setHistory] = useState<HistoryRun[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [histError, setHistError] = useState('')
  const [histDir, setHistDir] = useState('')
  const [histSel, setHistSel] = useState<Record<string, boolean>>({})
  const [viewing, setViewing] = useState<HistoryRun | null>(null)
  const [compare, setCompare] = useState<[HistoryRun, HistoryRun] | null>(null)
  // o que a rodada em andamento precisa para ser gravada quando terminar
  const resultsRef = useRef<Record<string, Result>>({})
  const runMeta = useRef<{ startedAt: Date; views: ManifestView[]; mode: TestWatchMode; stopped: boolean; artifactsDir: string } | null>(null)

  const projectId = target?.id || ''
  const projectSlug = target?.slug || ''
  const locale = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US'

  const TEST_TYPES = [
    // ordem pelo uso no mercado (e não por estar pronto): funcional, integração, desempenho, segurança, compatibilidade, responsividade e acessibilidade
    { id: 'funcional', label: t('ide_tests.type_funcional', 'Funcional · Pesquisa + Cadastro'), desc: t('ide_tests.type_funcional_desc', 'Todo caso de uso: a tela abre. Pesquisa + Cadastro: lista, formulário, obrigatórios, máscaras, total, ordenação, filtro e exportação'), available: true },
    { id: 'integracao', label: t('ide_tests.type_integracao', 'Integração'), desc: t('ide_tests.type_integracao_desc', 'Cadastro, edição e exclusão com dados gerados, gravando no banco de teste (e apagando no fim)'), available: true },
    { id: 'carga', label: t('ide_tests.type_carga', 'Desempenho e carga'), desc: t('ide_tests.type_carga_desc', 'Tempo de abertura de cada tela e N usuários ao mesmo tempo: lendo, gravando ou os dois juntos (você escolhe)'), available: true },
    { id: 'seguranca', label: t('ide_tests.type_seguranca', 'Segurança'), desc: t('ide_tests.type_seguranca_desc', 'Permissão da tabela, acesso por grupo e regra por linha, conferidos com usuários temporários'), available: true },
    { id: 'compat', label: t('ide_tests.type_compat', 'Compatibilidade'), desc: t('ide_tests.type_compat_desc', 'A tela abre, lista o total do banco e mostra o formulário em Chrome, Firefox e Safari (WebKit)'), available: true },
    { id: 'visual', label: t('ide_tests.type_visual', 'Responsividade e acessibilidade'), desc: t('ide_tests.type_visual_desc', 'Celular, tablet e computador sem rolagem horizontal; idioma, títulos, imagens, botões e campos com nome para leitor de tela'), available: true },
  ]

  // lembra a pasta do app exportado (de cada projeto)
  useEffect(() => {
    if (!isOpen) return
    const saved = lsGet(`mb_tests_app_dir_${projectId}`)
    setAppDir(saved); setAppDirAuto(false)
    if (isTauri() && projectSlug) {
      suggestAppFolders(projectId, projectSlug).then(list => {
        setFolderSuggestions(list)
        if (!saved && list.length > 0) { setAppDir(list[0].dir); setAppDirAuto(true) }
      }).catch(() => setFolderSuggestions([]))
    }
    setDbResult(null)
    if (isTauri()) loadDbSettings(projectSlug).then(setDbSettings).catch(() => {})
    if (!isTauri()) return
    engineE2eDir().then(setManagedDir).catch(() => {})
    engineStatus().then(setEngineSt).catch(() => setEngineSt(null))
    detectBrowser().then(setBrowserName).catch(() => setBrowserName(null))
  }, [isOpen, projectId, projectSlug])

  // a conexão que o app exportado já usa (com a senha escondida): é o que o modo "banco original" mostra
  useEffect(() => {
    if (!isOpen || !appDir || !isTauri()) { setAppDbHint(''); setAppDbUrl(''); return }
    readAppDbUrl(appDir).then(u => { setAppDbUrl(u || ''); setAppDbHint(u ? u.replace(/(:\/\/[^:@/]+:)[^@]+@/, '$1***@') : ''); if (u) setCopyName(prev => prev || suggestCopyName(u)) }).catch(() => { setAppDbHint(''); setAppDbUrl('') })
  }, [isOpen, appDir])

  // o banco do projeto (Studio): PostgreSQL ou Oracle; no Oracle a porta padrão é 1521 e o "banco" é o serviço
  const dbTipo = dbTipoDoProjeto(manifest?.dbStack)
  useEffect(() => { if (dbTipo === 'oracle') setDbSettings(p => (p.port === '5432' && !p.database ? { ...p, port: '1521' } : p)) }, [dbTipo])

  // sugere a conexão da cópia a partir da conexão do app (mesmo servidor, porta e, no Postgres, o mesmo usuário e senha), com o nome sugerido para a cópia.
  // Acompanha o app escolhido: troca o que veio da sugestão anterior, mas não mexe no que o usuário digitou (usuário ou senha preenchidos por ele).
  // Não grava em disco.
  const lastSuggest = useRef<Partial<DbSettings> | null>(null)
  useEffect(() => {
    if (!appDbUrl || !dbTipo) return
    let u: URL
    try { u = new URL(appDbUrl) } catch { return }
    const sug: Partial<DbSettings> = dbTipo === 'oracle'
      // no Oracle a cópia é outro esquema (outro usuário): sugere só o servidor, a porta e o serviço
      ? { host: u.hostname, port: u.port || '1521', database: decodeURIComponent(u.pathname.replace(/^\//, '')), user: '', password: '' }
      : { host: u.hostname, port: u.port || '5432', database: copyName || suggestCopyName(appDbUrl), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password) }
    setDbSettings(prev => {
      if (prev.mode !== 'copy') return prev
      const last = lastSuggest.current
      const doUsuario = !!(prev.user || prev.password) && !(last && prev.user === (last.user ?? '') && prev.password === (last.password ?? '') && prev.host === last.host && prev.port === last.port && prev.database === last.database)
      if (doUsuario) return prev
      if (prev.host === sug.host && prev.port === sug.port && prev.database === sug.database && prev.user === (sug.user ?? '') && prev.password === (sug.password ?? '')) { lastSuggest.current = sug; return prev }
      lastSuggest.current = sug
      return { ...prev, ...sug, copyConfirmed: false }
    })
  }, [appDbUrl, dbTipo, copyName, dbSettings.mode, dbSettings.user, dbSettings.password, dbSettings.database, dbSettings.host, dbSettings.port])

  const updateDb = (patch: Partial<DbSettings>) => {
    setDbSettings(prev => { const next = { ...prev, ...patch }; saveDbSettings(projectSlug, next).catch(() => {}); return next })
    setDbResult(null)
  }

  /** Conexão com o banco de teste escolhido (cópia informada ou o banco do próprio app). */
  const resolveDbUrl = async (ds: DbSettings): Promise<string | null> => {
    if (ds.mode === 'copy') return ds.host.trim() && ds.port.trim() && ds.database.trim() && ds.user.trim() ? buildDbUrl(ds, dbTipo ?? 'postgres') : null
    return readAppDbUrl(appDir)
  }

  /** Grava a configuração da rodada e chama a ferramenta de banco do motor. */
  const callDbTool = async (action: 'check' | 'prepare' | 'remove', ds: DbSettings) => {
    if (!manifest) return { ok: false as const, error: t('ide_tests.err_plan', 'Não foi possível gerar o plano.') }
    const dbUrl = await resolveDbUrl(ds)
    if (!dbUrl) return { ok: false as const, error: ds.mode === 'copy' ? t('ide_tests.db_err_fields', 'Preencha servidor, porta, banco e usuário.') : t('ide_tests.err_dburl', 'Não encontrei DATABASE_URL no .env.local do app exportado.') }
    const manifestPath = await writeManifest(manifest)
    const configPath = await writeEngineConfig(projectSlug, {
      appDir, dbUrl, user: '', password: '', mode: ds.mode, copyConfirmed: ds.copyConfirmed, consentOriginal: ds.consentOriginal, noAuth: false,
      allowRemote: ds.mode === 'original' && ds.consentOriginal, robotPassword: ds.robot?.password,
    })
    return { ...(await runDbTool(action, { runnerDir, configPath, manifestPath })), dbUrl }
  }

  /** Cria a cópia no mesmo servidor do banco que o app já usa e preenche os campos com ela. */
  const createCopy = async () => {
    if (!manifest || !appDbUrl) { setDbResult({ kind: 'err', text: t('ide_tests.err_dburl', 'Não encontrei DATABASE_URL no .env.local do app exportado.') }); return }
    setDbBusy('copy'); setDbResult(null)
    try {
      const manifestPath = await writeManifest(manifest)
      const configPath = await writeEngineConfig(projectSlug, { appDir, dbUrl: appDbUrl, user: '', password: '', mode: 'copy', copyConfirmed: false, consentOriginal: false, noAuth: false, allowRemote: false, copyName: copyName.trim() })
      const r = await createDbCopy({ runnerDir, configPath, manifestPath })
      if (!r.ok) { setDbResult({ kind: 'err', text: r.error || '' }); return }
      const u = new URL(appDbUrl)
      updateDb({ mode: 'copy', host: u.hostname, port: u.port || '5432', user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: r.name || copyName.trim(), copyConfirmed: true, robot: undefined })
      setDbResult({ kind: 'ok', text: r.existed ? t('ide_tests.db_copy_existed', 'A cópia "{n}" já existia: os campos foram preenchidos com ela.').replace('{n}', r.name || '') : t('ide_tests.db_copy_done', 'Cópia "{n}" criada ({mb} MB) e já preenchida nos campos.').replace('{n}', r.name || '').replace('{mb}', String(r.sizeMb ?? '?')) })
    } catch (e: any) { setDbResult({ kind: 'err', text: String(e?.message || e) }) } finally { setDbBusy('') }
  }

  const testDb = async () => {
    setDbBusy('test'); setDbResult(null)
    try {
      const r = await callDbTool('check', dbSettings)
      if (!r.ok) { setDbResult({ kind: 'err', text: `${t('ide_tests.db_fail', 'Não foi possível conectar:')} ${r.error}` }); return }
      const falt = (r as any).tables?.missing ?? []
      const total = (r as any).tables?.expected ?? 0
      setDbResult({
        kind: falt.length ? 'warn' : 'ok',
        text: t('ide_tests.db_ok', 'Conectado a {db} ({version}). Tabelas dos casos de uso: {n} de {total} encontradas.').replace('{db}', String((r as any).database)).replace('{version}', String((r as any).version)).replace('{n}', String(total - falt.length)).replace('{total}', String(total))
          + (falt.length ? ` ${t('ide_tests.db_missing', 'Faltam no banco: {list}').replace('{list}', falt.join(', '))}` : ''),
      })
    } catch (e: any) { setDbResult({ kind: 'err', text: String(e?.message || e) }) } finally { setDbBusy('') }
  }

  /** Cria (ou renova) o usuário de teste do app no banco de teste e guarda a senha gerada. Devolve o que a rodada precisa. */
  const prepareRobot = async (ds: DbSettings): Promise<{ ok: boolean; error?: string; noAuth?: boolean; robot?: DbSettings['robot'] }> => {
    const r = await callDbTool('prepare', ds)
    if (!r.ok) return { ok: false, error: r.error }
    if ((r as any).noAuth) return { ok: true, noAuth: true }
    const robot = { user: String((r as any).user), password: String((r as any).password), forDb: dbKey((r as any).dbUrl), group: (r as any).group ?? null }
    const next = { ...ds, robot }
    setDbSettings(next); saveDbSettings(projectSlug, next).catch(() => {})
    return { ok: true, robot }
  }

  const prepareDb = async () => {
    setDbBusy('prepare'); setDbResult(null)
    try {
      const r = await prepareRobot(dbSettings)
      setDbResult(r.ok
        ? { kind: 'ok', text: r.noAuth ? t('ide_tests.db_robot_noauth', 'O app não tem login: nenhum usuário é necessário.') : t('ide_tests.db_robot_ready', 'Usuário de teste pronto ({user}).').replace('{user}', r.robot!.user) + (r.robot!.group ? ` ${t('ide_tests.db_robot_group', 'No grupo "{g}".').replace('{g}', r.robot!.group)}` : '') }
        : { kind: 'err', text: r.error || '' })
    } catch (e: any) { setDbResult({ kind: 'err', text: String(e?.message || e) }) } finally { setDbBusy('') }
  }

  const removeRobot = async () => {
    setDbBusy('remove'); setDbResult(null)
    try {
      const r = await callDbTool('remove', dbSettings)
      if (r.ok) { const next = { ...dbSettings, robot: undefined }; setDbSettings(next); saveDbSettings(projectSlug, next).catch(() => {}); setDbResult({ kind: 'ok', text: t('ide_tests.db_robot_removed', 'Usuário de teste removido do banco.') }) }
      else setDbResult({ kind: 'err', text: r.error || '' })
    } catch (e: any) { setDbResult({ kind: 'err', text: String(e?.message || e) }) } finally { setDbBusy('') }
  }

  /** Instala (ou atualiza) o motor na pasta do usuário. O clique do usuário é o consentimento: baixa pacotes do npm. */
  const doInstallEngine = async () => {
    setEngineErr(''); setEngineBusy('files')
    try {
      await installEngine(step => setEngineBusy(step as 'files' | 'npm'))
      setEngineSt(await engineStatus())
    } catch (e: any) {
      setEngineErr(e?.message === 'NODE_MISSING' ? t('ide_tests.engine_node_missing', 'Para instalar o motor é preciso ter o Node.js. Instale-o em nodejs.org e tente de novo.') : `${t('ide_tests.engine_err', 'Não foi possível instalar o motor.')} (${e?.message || e})`)
    } finally { setEngineBusy('') }
  }

  useEffect(() => {
    if (!isOpen || !isTauri()) return
    hasFfmpeg().then(ok => setFfmpeg(ok ? 'ok' : 'missing')).catch(() => setFfmpeg('unknown'))
    hasCompatBrowsers().then(ok => setCompatBr(ok ? 'ok' : 'missing')).catch(() => setCompatBr('unknown'))
  }, [isOpen])

  /** Baixa o ffmpeg (a pasta do motor é onde está o Playwright que sabe instalá-lo). */
  const enableVideo = async (): Promise<boolean> => {
    if (!runnerDir) { setFfmpegErr(t('ide_tests.engine_hint', 'Instale o motor de testes na seção 3 antes de executar.')); return false }
    setFfmpeg('installing'); setFfmpegErr('')
    try { await installFfmpeg(runnerDir); const ok = await hasFfmpeg(); setFfmpeg(ok ? 'ok' : 'missing'); return ok }
    catch (e: any) { setFfmpeg('missing'); setFfmpegErr(`${t('ide_tests.ffmpeg_err', 'Não foi possível baixar o ffmpeg.')} (${e?.message || e})`); return false }
  }

  /** Baixa o Firefox e o WebKit (a pasta do motor é onde está o Playwright que sabe instalá-los). */
  const enableCompat = async (): Promise<boolean> => {
    if (!runnerDir) { setCompatErr(t('ide_tests.engine_hint', 'Instale o motor de testes na seção 3 antes de executar.')); return false }
    setCompatBr('installing'); setCompatErr('')
    try { await installCompatBrowsers(runnerDir); const ok = await hasCompatBrowsers(); setCompatBr(ok ? 'ok' : 'missing'); return ok }
    catch (e: any) { setCompatBr('missing'); setCompatErr(`${t('ide_tests.compat_err', 'Não foi possível baixar o Firefox e o WebKit.')} (${e?.message || e})`); return false }
  }

  const loadManifest = useCallback(async () => {
    if (!target || target.type !== 'project' || appAccess === null) return
    setLoading(true); setLoadError('')
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch('/api/test-manifest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ projectId: target.id, accessAdmin: appAccess }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `Erro ${res.status}`)
      const m = json as TestManifest
      setManifest(m)
      setSelected(Object.fromEntries(m.views.map(v => [v.slug, planFor(v).length > 0])))
    } catch (e: any) {
      setLoadError(e?.message || t('ide_tests.err_plan', 'Não foi possível gerar o plano.'))
    } finally {
      setLoading(false)
    }
  }, [target, t, appAccess])

  // verifica na pasta do app exportado se a gestão de acesso foi exportada; sem pasta (ou fora da IDE Desktop) vale "não"
  useEffect(() => {
    if (!isOpen) return
    if (!appDir || !isTauri()) { setAppAccess(false); return }
    let alive = true
    appHasAccessAdmin(appDir).then(v => { if (alive) setAppAccess(v) }).catch(() => { if (alive) setAppAccess(false) })
    return () => { alive = false }
  }, [isOpen, appDir])

  useEffect(() => { if (isOpen && !manifest) loadManifest() }, [isOpen, manifest, loadManifest])
  // trocou de app (com ou sem gestão de acesso): o plano muda, então gera de novo
  useEffect(() => { if (manifest && appAccess !== null && !!manifest.auth?.access !== appAccess) loadManifest() }, [appAccess]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!isOpen) { setManifest(null); setResults({}); setSummary(null); setRunError(''); setViewing(null); setCompare(null); setTab('run') } }, [isOpen])

  const views = manifest?.views ?? []
  const selectable = useMemo(() => views.filter(v => planFor(v).length > 0), [views, planFor])
  const chosen = useMemo(() => selectable.filter(v => selected[v.slug]), [selectable, selected])
  const plannedCount = useMemo(() => chosen.reduce((n, v) => n + planFor(v).length, 0), [chosen, planFor])

  useEffect(() => { if (manifest) setSelected(prev => Object.fromEntries(manifest.views.map(v => [v.slug, planFor(v).length > 0 && (prev[v.slug] ?? true)]))) }, [types, manifest, planFor])

  const setAll = (on: boolean) => setSelected(Object.fromEntries(views.map(v => [v.slug, on && planFor(v).length > 0])))

  const pick = async () => {
    const dir = await pickFolder()
    if (!dir) return
    setAppDir(dir); setAppDirAuto(false); lsSet(`mb_tests_app_dir_${projectId}`, dir)
  }
  const useSuggested = (dir: string) => { setAppDir(dir); setAppDirAuto(false); lsSet(`mb_tests_app_dir_${projectId}`, dir) }

  // ---- histórico
  const loadHistory = useCallback(async () => {
    if (!isTauri() || !projectSlug) return
    setHistLoading(true); setHistError('')
    try {
      setHistory(await listRuns(projectSlug))
      setHistDir(await historyDir(projectSlug))
    } catch (e: any) {
      setHistError(`${t('ide_tests.hist_err', 'Não foi possível ler o histórico.')} (${e?.message || e})`)
    } finally { setHistLoading(false) }
  }, [projectSlug, t])

  useEffect(() => { if (isOpen && tab === 'history') loadHistory() }, [isOpen, tab, loadHistory])

  const onDeleteRuns = async (ids: string[]) => {
    await deleteRuns(projectSlug, ids)
    setHistSel({})
    await loadHistory()
  }

  /** Monta o registro da rodada com o plano dos casos de uso rodados e o resultado de cada teste (sem resultado = não executado). */
  const buildRun = (meta: NonNullable<typeof runMeta.current>, res: Record<string, Result>, techReport?: string): HistoryRun => {
    const groups: HistoryGroup[] = meta.views.map(v => ({
      slug: v.slug, name: describeName(v), viewTitle: v.title, logicType: v.logicType,
      rows: planFor(v).map(p => {
        const r = res[keyOf(describeName(v), p.title)]
        const status: RowStatus = !r || r.status === 'running' ? 'pending' : r.status
        return { ...p, status, ms: r?.ms, error: r?.error, reason: r?.reason, shot: r?.shot, video: r?.video }
      }),
    }))
    return { version: 1, id: runId(meta.startedAt), projectId, projectName: target?.name || '', startedAt: meta.startedAt.toISOString(), finishedAt: new Date().toISOString(), mode: meta.mode, stopped: meta.stopped || undefined, groups, ...(techReport ? { techReport } : {}) }
  }

  const finishRun = async (code: number | null) => {
    setRunning(false); handle.current = null
    const meta = runMeta.current
    runMeta.current = null
    if (code !== 0 && code !== 1 && code !== null) setRunError(t('ide_tests.err_exit', 'O motor terminou com erro (código {code}). Veja o log abaixo.').replace('{code}', String(code)))
    if (meta && Object.keys(resultsRef.current).length > 0) {
      try {
        const techReport = await archiveTechReport(runnerDir, meta.artifactsDir).catch(() => undefined)
        await saveRun(projectSlug, buildRun(meta, resultsRef.current, techReport)); if (tab === 'history') loadHistory()
      }
      catch (e: any) { setRunError(`${t('ide_tests.hist_save_err', 'Os testes terminaram, mas não foi possível gravar no histórico.')} (${e?.message || e})`) }
    }
  }

  const onEvent = useCallback((ev: TestEvent) => {
    if (ev.t === 'done') { setSummary({ total: ev.total ?? 0, passed: ev.passed ?? 0, failed: ev.failed ?? 0, skipped: ev.skipped ?? 0 }); return }
    if (!ev.group || !ev.title) return
    const k = keyOf(ev.group, ev.title)
    const r: Result = ev.t === 'begin' ? { status: 'running' } : { status: ev.status || 'failed', ms: ev.ms, error: ev.error, reason: ev.reason, shot: ev.shot, video: ev.video }
    resultsRef.current = { ...resultsRef.current, [k]: r }
    setResults(prev => ({ ...prev, [k]: r }))
  }, [])

  const run = async (only?: ManifestView[], skipAsk = false) => {
    if (!manifest || !isTauri()) return
    const toRun = only ?? chosen
    setViewing(null); setRunError(''); setSummary(null); setResults({}); setLogs([]); resultsRef.current = {}
    if (toRun.length === 0) { setRunError(t('ide_tests.err_none', 'Nenhum caso de uso para testar.')); return }
    if (!runnerDir) { setRunError(t('ide_tests.engine_hint', 'Instale o motor de testes na seção 3 antes de executar.')); return }
    if (!appDir) { setRunError(t('ide_tests.err_app', 'Escolha a pasta do app exportado que será testado.')); return }
    // vídeo das falhas: se falta o ffmpeg, pergunta uma vez (a menos que o usuário já tenha dito para não perguntar mais)
    if (!skipAsk && mode !== 'external' && ffmpeg === 'missing' && !ffmpegSkipped.current && lsGet('mb_tests_ffmpeg_never') !== '1') { setAskFfmpeg({ only }); return }
    // compatibilidade: sem o Firefox e o WebKit, pergunta antes de baixar (ou roda só com o Chrome: os outros testes ficam "pulados")
    if (!skipAsk && mode !== 'external' && types.includes('compat') && compatBr === 'missing' && !compatSkipped.current) { setAskCompat({ only }); return }
    // bancos e pilhas: PostgreSQL e Oracle, com app Node ou Java
    if (!dbTipo) { setRunError(t('ide_tests.err_db_unsupported', 'Os testes automáticos ainda só suportam bancos PostgreSQL e Oracle.')); return }
    const tipoApp = await detectAppKind(appDir).catch(() => 'node' as const)
    if (tipoApp === 'java' && !(await hasJdk().catch(() => false))) { setRunError(t('ide_tests.err_jdk', 'O app tem backend Java e a máquina não tem o JDK 21. Rode o app uma vez pela exportação (a IDE oferece baixar o JDK portátil) ou instale o JDK 21.')); return }
    if (!engineSt?.installed) { setRunError(t('ide_tests.engine_hint', 'Instale o motor de testes na seção 3 antes de executar.')); return }
    if (!(dbSettings.mode === 'copy' ? dbSettings.copyConfirmed : dbSettings.consentOriginal)) { setRunError(t('ide_tests.db_err_need_confirm', 'Confirme a opção acima para continuar.')); return }
    setLiveGate(false)
    setRunning(true)
    try {
      let configPath: string | undefined
      const dbUrl = await resolveDbUrl(dbSettings)
      if (!dbUrl) { setRunning(false); setRunError(dbSettings.mode === 'copy' ? t('ide_tests.db_err_fields', 'Preencha servidor, porta, banco e usuário.') : t('ide_tests.err_dburl', 'Não encontrei DATABASE_URL no .env.local do app exportado.')); return }
      // o usuário de teste salvo vale se for deste banco e, quando o app tem gestão de acesso, se já foi posto num grupo (senão prepara de novo)
      let robot = dbSettings.robot && dbSettings.robot.forDb === dbKey(dbUrl) && !(manifest.auth?.access && !dbSettings.robot.group) ? dbSettings.robot : undefined
      let noAuth = manifest.auth?.type === 'none'
      if (!robot && !noAuth) {
        const prep = await prepareRobot(dbSettings)
        if (!prep.ok) { setRunning(false); setRunError(`${t('ide_tests.db_fail', 'Não foi possível conectar:')} ${prep.error}`); return }
        robot = prep.robot; noAuth = !!prep.noAuth
      }
      configPath = await writeEngineConfig(projectSlug, {
        appDir, dbUrl, user: robot?.user ?? '', password: robot?.password ?? '', mode: dbSettings.mode, copyConfirmed: dbSettings.copyConfirmed,
        consentOriginal: dbSettings.consentOriginal, noAuth, allowRemote: dbSettings.mode === 'original' && dbSettings.consentOriginal,
      })
      const chk = await checkRunnerDir(runnerDir)
      if (!chk.ok) { setRunning(false); setRunError(t('ide_tests.err_incomplete', 'A pasta do motor de testes está incompleta (falta: {missing}). Escolha a pasta e2e do projeto e rode npm install nela.').replace('{missing}', chk.missing.join(', '))); return }
      const startedAt = new Date()
      const artifactsDir = await artifactsDirFor(runId(startedAt))
      runMeta.current = { startedAt, views: toRun, mode, stopped: false, artifactsDir }
      setRunTotal(toRun.reduce((n, v) => n + planFor(v).length, 0)); setLiveOpen(true)
      setFrameUrl(old => { if (old) URL.revokeObjectURL(old); return '' })
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      await clearLiveFrame()
      setLiveGate(true)
      handle.current = await startTestRun({
        runnerDir, appDir, manifest, viewSlugs: toRun.map(v => v.slug), mode, slowMoMs: slow,
        configPath, browser: browserName, types, ...(types.includes('carga') ? { cargaUsers: carga.users, cargaModos: carga.modos } : {}), artifactsDir, onEvent, onLog: l => setLogs(x => [...x.slice(-199), l]), onClose: code => { finishRun(code) },
      })
    } catch (e: any) {
      setRunning(false); runMeta.current = null
      const msg = String(e?.message || e || '')
      // o Tauri só libera pastas fora do perfil do usuário durante a sessão em que foram escolhidas: depois de reabrir a IDE é preciso escolher de novo
      setRunError(/forbidden|scope|not allowed|permission/i.test(msg)
        ? t('ide_tests.err_reauth', 'O Windows pede para autorizar a pasta de novo depois que a IDE é reaberta. Clique em "{app}" e escolha a mesma pasta.').replace('{app}', t('ide_tests.app', 'App exportado a testar')) + `\n(${msg})`
        : (msg || t('ide_tests.err_start', 'Não foi possível iniciar os testes.')))
    }
  }

  const secToggle = (k: 'type' | 'scope' | 'where') => (
    <button type="button" onClick={() => setSecOpen(o => ({ ...o, [k]: !o[k] }))} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200">
      {secOpen[k] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} {secOpen[k] ? t('ide_tests.live_collapse', 'Recolher') : t('ide_tests.live_expand', 'Expandir')}
    </button>
  )

  /** volta a tela ao estado original: sem resultados, sem imagem do navegador e sem mensagens */
  const resetRun = () => {
    setResults({}); resultsRef.current = {}; setSummary(null); setViewing(null); setRunError(''); setLogs([]); setRunTotal(0)
    setFrameUrl(old => { if (old) URL.revokeObjectURL(old); return '' })
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const stop = async () => { if (runMeta.current) runMeta.current.stopped = true; await handle.current?.stop() }

  // abrir uma execução do histórico: a tela mostra os resultados como no fim de uma rodada
  const openRun = (r: HistoryRun) => {
    const res: Record<string, Result> = {}
    for (const g of r.groups) for (const row of g.rows) if (row.status !== 'pending') res[keyOf(g.name, row.title)] = { status: row.status as TestStatus, ms: row.ms, error: row.error, reason: row.reason, shot: row.shot, video: row.video }
    const tt = runTotals(r)
    setResults(res); setSummary({ total: tt.total, passed: tt.passed, failed: tt.failed, skipped: tt.other }); setViewing(r); setRunError(''); setTab('run')
  }

  const rerun = (r: HistoryRun) => {
    const slugs = new Set(r.groups.map(g => g.slug))
    const still = selectable.filter(v => slugs.has(v.slug))
    if (still.length === 0) { setRunError(t('ide_tests.err_rerun_missing', 'Os casos de uso desta execução não existem mais no projeto.')); return }
    setSelected(Object.fromEntries(views.map(v => [v.slug, slugs.has(v.slug) && planFor(v).length > 0])))
    run(still)
  }

  // navegador interno: lê o quadro mais recente da tela do teste e mostra no painel
  useEffect(() => {
    if (!running || mode !== 'internal' || !liveGate) return
    let alive = true
    let last = 0
    const tick = async () => {
      const bytes = await readLiveFrame()
      if (!alive || !bytes || bytes.length === 0) return
      const sig = bytes.length * 31 + bytes[Math.floor(bytes.length / 2)]
      if (sig === last) return
      last = sig
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' }))
      setFrameUrl(old => { if (old) URL.revokeObjectURL(old); return url })
    }
    const id = setInterval(tick, 250)
    return () => { alive = false; clearInterval(id) }
  }, [running, mode, liveGate])
  useEffect(() => { if (!isOpen) setFrameUrl(old => { if (old) URL.revokeObjectURL(old); return '' }) }, [isOpen])

  // ---- evidências da falha (captura de tela e vídeo)
  const openMedia = async (kind: 'image' | 'video', file: string, title: string) => {
    const url = await readEvidenceBlob(file, kind === 'image' ? 'image/png' : 'video/webm')
    if (!url) { setRunError(t('ide_tests.media_missing', 'Não foi possível abrir o arquivo (ele pode ter sido apagado).')); return }
    setMedia(old => { if (old) URL.revokeObjectURL(old.url); return { kind, url, title } })
  }
  const closeMedia = () => setMedia(old => { if (old) URL.revokeObjectURL(old.url); return null })

  // ---- relatório (da rodada na tela ou da execução aberta do histórico)
  type GroupData = { name: string; logicType: string; rows: { title: string; text: string; status: RowStatus; ms?: number; error?: string; shot?: string }[] }
  const currentGroups = (): GroupData[] => {
    if (viewing) return viewing.groups.map(g => ({ name: g.name, logicType: g.logicType, rows: g.rows.map(r => ({ title: r.title, text: planTitle(r, language), status: r.status, ms: r.ms, error: r.error, reason: r.reason, shot: r.shot })) }))
    return chosen.map(v => ({
      name: describeName(v), logicType: v.logicType,
      rows: planFor(v).map(p => { const r = results[keyOf(describeName(v), p.title)]; return { title: p.title, text: planTitle(p, language), status: (r?.status ?? 'pending') as RowStatus, ms: r?.ms, error: r?.error, shot: r?.shot } }),
    }))
  }

  const watchLabel = (m: string) => m === 'internal' ? t('ide_tests.mode_internal_short', 'Navegador interno') : m === 'external' ? t('ide_tests.mode_external_short', 'Navegador do sistema') : t('ide_tests.mode_background_short', 'Segundo plano')

  /** Abre o relatório da rodada: monta o HTML (com a captura de tela das falhas embutida) e o JSON com os mesmos dados. */
  const showReport = async () => {
    setReportMenu(false); setReportMsg(null); setDownloadMenu(false)
    const groups = currentGroups()
    const when = viewing ? new Date(viewing.finishedAt) : new Date()
    const watch = watchLabel(viewing?.mode || mode)
    const withShots = await Promise.all(groups.map(async g => ({
      name: g.name, logicType: g.logicType,
      rows: await Promise.all(g.rows.map(async r => ({ title: r.text, status: r.status, ms: r.ms, error: r.error, shot: r.shot && r.status === 'failed' ? await readEvidenceDataUri(r.shot) : undefined }))),
    })))
    const project = viewing?.projectName || target?.name || ''
    const tt = runTotals({ groups: groups.map(g => ({ slug: '', name: g.name, viewTitle: g.name, logicType: g.logicType, rows: g.rows.map(r => ({ kind: 'abre' as const, title: r.title, status: r.status, ms: r.ms })) })) })
    const json = JSON.stringify({
      project, generatedAt: when.toISOString(), mode: viewing?.mode || mode, language,
      totals: { total: tt.total, passed: tt.passed, failed: tt.failed, notRun: tt.other, successRate: tt.rate, totalMs: tt.ms },
      groups: groups.map(g => ({ name: g.name, logicType: g.logicType, tests: g.rows.map(r => ({ name: r.title, description: r.text, status: r.status, ms: r.ms ?? null, error: r.error ?? null, screenshot: r.shot ?? null })) })),
    }, null, 2)
    setReport({
      html: buildReportHtml({ project, generatedAt: when, groups: withShots, mode: 'html', lang: language, watch }),
      json, base: `relatorio-testes-${(target?.slug || 'projeto')}-${when.toISOString().slice(0, 16).replace(/[:T]/g, '-')}`,
    })
  }

  /** Download do relatório em PDF (gerado de verdade pelo Chrome do motor de testes), HTML ou JSON. */
  const downloadReport = async (fmt: 'pdf' | 'html' | 'json') => {
    if (!report) return
    setDownloadMenu(false); setReportMsg(null)
    const file = `${report.base}.${fmt}`
    try {
      if (!isTauri()) {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([fmt === 'json' ? report.json : report.html], { type: fmt === 'json' ? 'application/json' : 'text/html' }))
        a.download = file; a.click(); URL.revokeObjectURL(a.href)
        return
      }
      if (fmt === 'pdf' && !runnerDir) { setReportMsg({ kind: 'err', text: t('ide_tests.engine_hint', 'Instale o motor de testes na seção 3 antes de executar.') }); return }
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { downloadDir, join } = await import('@tauri-apps/api/path')
      const filterName = fmt.toUpperCase()
      const dest = await save({ defaultPath: await join(await downloadDir(), file), filters: [{ name: filterName, extensions: [fmt] }] })
      if (!dest) return
      const { writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs')
      if (fmt === 'pdf') {
        setReportMsg({ kind: 'busy', text: t('ide_tests.pdf_busy', 'Gerando o PDF...') })
        const tmpDir = await workDir('report')
        await mkdir(tmpDir, { recursive: true }).catch(() => {})
        const html = await join(tmpDir, `${report.base}.html`)
        await writeTextFile(html, report.html)
        await makePdf(runnerDir, html, dest)
      } else {
        await writeTextFile(dest, fmt === 'json' ? report.json : report.html)
      }
      setReportMsg({ kind: 'ok', text: t('ide_tests.saved_in', 'Salvo em {path}').replace('{path}', dest) })
    } catch (e: any) {
      setReportMsg({ kind: 'err', text: `${t('ide_tests.err_save_report', 'Não foi possível salvar o relatório.')} (${e?.message || e})` })
    }
  }

  if (!isOpen || !target) return null
  const desktop = isTauri()
  const lblSection = 'text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2'

  const reportButton = (
    <div className="relative">
      <button onClick={() => setReportMenu(m => !m)} className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800"><FileText className="w-4 h-4" /> {t('ide_tests.report', 'Abrir relatório')} <ChevronDown className="w-3.5 h-3.5" /></button>
      {reportMenu && (
        <div className="absolute bottom-full right-0 mb-2 w-72 rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl p-1 z-10">
          <button onClick={showReport} className="w-full text-left rounded-lg px-3 py-2 hover:bg-neutral-800"><span className="block text-xs font-semibold text-white">{t('ide_tests.report_generic', 'Relatório de testes')}</span><span className="block text-[11px] text-neutral-400">{t('ide_tests.report_generic_desc', 'Resumo, gráficos, falhas e todos os testes')}</span></button>
          {(!viewing || viewing.techReport) && <button onClick={() => { setReportMenu(false); openTestReport(runnerDir, viewing?.techReport) }} className="w-full text-left rounded-lg px-3 py-2 hover:bg-neutral-800"><span className="block text-xs font-semibold text-white">{t('ide_tests.report_tech', 'Relatório técnico (Playwright)')}</span><span className="block text-[11px] text-neutral-400">{t('ide_tests.report_tech_desc', 'Com rastros e capturas das falhas')}</span></button>}
        </div>
      )}
    </div>
  )

  /** Captura e vídeo da falha, ao lado do teste que falhou. */
  const evidence = (shot?: string, video?: string, title = '') => (shot || video) ? (
    <span className="ml-2 inline-flex gap-1">
      {shot && <button onClick={() => openMedia('image', shot, title)} className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-1.5 py-0.5 text-[10px] text-red-300 hover:bg-red-500/10"><ImageIcon className="w-3 h-3" /> {t('ide_tests.shot_btn', 'Captura')}</button>}
      {video && <button onClick={() => openMedia('video', video, title)} className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-1.5 py-0.5 text-[10px] text-red-300 hover:bg-red-500/10"><VideoIcon className="w-3 h-3" /> {t('ide_tests.video_btn', 'Vídeo')}</button>}
    </span>
  ) : null

  return (
    <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/60 p-4" onClick={e => { if (e.target === e.currentTarget && !running) onClose() }}>
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-neutral-900 border border-neutral-700 text-neutral-200 shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-800">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center"><FlaskConical className="w-5 h-5 text-indigo-400" /></div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white">{t('ide_tests.title', 'Ambiente de Testes')} <span className="text-neutral-500 font-medium">· {target.name}</span></h2>
            <p className="text-xs text-neutral-400">{t('ide_tests.subtitle', 'Os testes nascem do que você configurou no Studio: um caso de uso novo ou alterado muda o plano, sem escrever teste.')}</p>
          </div>
          <button onClick={onClose} disabled={running} className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-40"><X className="w-4 h-4" /></button>
        </div>

        {/* Abas */}
        <div className="flex gap-1 px-6 pt-3 border-b border-neutral-800">
          {([['run', FlaskConical, t('ide_tests.tab_run', 'Executar')], ['history', HistoryIcon, t('ide_tests.tab_history', 'Histórico')]] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 -mb-px ${tab === id ? 'border-indigo-500 text-indigo-300' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}><Icon className="w-3.5 h-3.5" /> {label}{id === 'history' && history.length > 0 ? ` (${history.length})` : ''}</button>
          ))}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {tab === 'history' && (
            <IdeTestHistory runs={history} loading={histLoading} error={histError} dir={histDir} selected={histSel} setSelected={setHistSel}
              onOpen={openRun} onDelete={onDeleteRuns} onCompare={(a, b) => setCompare([a, b])} />
          )}

          {tab === 'run' && (<>
            {/* Segurança */}
            <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 [html:not(.light)_&]:text-amber-400">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{t('ide_tests.safety', 'Os testes rodam em um banco de teste: por padrão, uma cópia do banco, informada por você. Rodar no banco original só com o seu consentimento. O motor confere, no fim, que nenhum dado existente foi alterado.')}</p>
            </div>

            {/* Execução aberta do histórico */}
            {viewing && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-3 text-xs text-indigo-200">
                <HistoryIcon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{t('ide_tests.viewing', 'Execução de {date} (histórico)').replace('{date}', new Date(viewing.startedAt).toLocaleString(locale))}</span>
                <button onClick={() => rerun(viewing)} disabled={running} className="flex items-center gap-1.5 rounded-lg border border-indigo-400/50 px-3 py-1.5 font-semibold hover:bg-indigo-500/20 disabled:opacity-40"><RotateCcw className="w-3.5 h-3.5" /> {t('ide_tests.rerun', 'Executar de novo')}</button>
                <button onClick={() => { setViewing(null); setResults({}); setSummary(null) }} className="rounded-lg border border-neutral-600 px-3 py-1.5 text-neutral-200 hover:bg-neutral-800">{t('ide_tests.back_to_plan', 'Voltar ao plano')}</button>
              </div>
            )}

            {/* Navegador interno: a execução do teste dentro do painel. Fica fixo no topo enquanto a lista de testes rola por baixo. */}
            {!viewing && mode === 'internal' && (running || frameUrl) && (() => {
              const done = Object.values(results).filter(r => r.status !== 'running').length
              const finished = !running && !!summary
              const bad = (summary?.failed ?? 0) > 0
              return (
                <section className="sticky top-0 z-20 -mx-2 px-2 pb-2 bg-neutral-900">
                  <div className={`rounded-xl border overflow-hidden bg-black ${finished ? (bad ? 'border-red-500/60' : 'border-emerald-500/60') : 'border-neutral-700'}`}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800 border-b border-neutral-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" /><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-300">{t('ide_tests.live_view', 'Navegador interno · execução ao vivo')}</span>
                      <span className={`ml-2 text-[11px] flex items-center gap-1.5 ${finished ? (bad ? 'text-red-300' : 'text-emerald-300') : 'text-neutral-400'}`}>
                        {running && <Loader2 className="w-3 h-3 animate-spin" />}
                        {running
                          ? t('ide_tests.live_progress', 'Testando... {done}/{total}').replace('{done}', String(done)).replace('{total}', String(runTotal))
                          : finished
                            ? t('ide_tests.live_done', 'Concluído: {passed} passaram, {failed} falharam').replace('{passed}', String(summary?.passed ?? 0)).replace('{failed}', String(summary?.failed ?? 0))
                            : t('ide_tests.live_last', 'Última tela da execução')}
                      </span>
                      <div className="ml-auto flex items-center gap-1">
                        {!running && <button onClick={resetRun} title={t('ide_tests.reset_hint', 'Limpar resultados e voltar ao estado original')} className="flex items-center gap-1.5 rounded-lg border border-neutral-600 px-2.5 py-1 text-[11px] text-neutral-200 hover:bg-neutral-700"><Eraser className="w-3.5 h-3.5" /> {t('ide_tests.reset', 'Limpar')}</button>}
                        <button onClick={() => setLiveOpen(o => !o)} title={liveOpen ? t('ide_tests.live_collapse', 'Recolher') : t('ide_tests.live_expand', 'Expandir')} className="flex items-center gap-1 rounded-lg border border-neutral-600 px-2.5 py-1 text-[11px] text-neutral-200 hover:bg-neutral-700">
                          {liveOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} {liveOpen ? t('ide_tests.live_collapse', 'Recolher') : t('ide_tests.live_expand', 'Expandir')}
                        </button>
                      </div>
                    </div>
                    {liveOpen && (frameUrl
                      ? <img src={frameUrl} alt="" className="w-full block max-h-[46vh] object-contain bg-black" />
                      : <div className="flex flex-col items-center justify-center gap-3 h-56 bg-white text-sm text-neutral-600">
                          <img src="/logo-white-v2.jpg" alt="MetaBuilder PRO" className="h-28 w-28 object-contain" />
                          <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {t('ide_tests.live_wait', 'Iniciando o navegador...')}</span>
                        </div>)}
                  </div>
                </section>
              )
            })()}

            {viewing ? (
              /* resultados da execução aberta: o que foi planejado e o que aconteceu naquela rodada */
              <section className="space-y-2">
                {viewing.groups.map(g => (
                  <div key={g.slug} className="rounded-xl border border-neutral-700 bg-neutral-800/40">
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-sm font-semibold text-white">{g.viewTitle}</span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">{g.logicType}</span>
                      <span className="ml-auto text-xs text-neutral-400">{g.rows.length} {t('ide_tests.tests', 'testes')}</span>
                    </div>
                    <ul className="px-4 pb-3 space-y-1">
                      {g.rows.map(p => (
                        <li key={p.title} className="text-xs">
                          <div className="flex items-start gap-2">
                            <StatusIcon s={p.status} />
                            <span className={p.status === 'failed' ? 'text-red-300' : 'text-neutral-300'}>{planTitle(p, language)}</span>{p.status === 'failed' && evidence(p.shot, p.video, planTitle(p, language))}
                            {p.ms != null && <span className="ml-auto text-neutral-500 tabular-nums">{(p.ms / 1000).toFixed(1)}s</span>}
                          </div>
                          {(p.status === 'skipped' || p.status === 'passed') && p.reason && <p className="mt-0.5 ml-6 text-[11px] text-neutral-500">{p.reason}</p>}
                          {p.error && <pre className="mt-1 ml-6 whitespace-pre-wrap text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{p.error}</pre>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ) : (<>
              {/* 1. Tipo de teste */}
              <section>
                <div className="flex items-center gap-3"><h3 className={`${lblSection} mr-auto`}>1 · {t('ide_tests.type', 'Tipo de teste')}</h3>{secToggle('type')}</div>
                {secOpen.type && <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {TEST_TYPES.map(tp => {
                    const escolhivel = tp.id === 'funcional' || tp.id === 'integracao' || tp.id === 'seguranca' || tp.id === 'compat' || tp.id === 'carga' || tp.id === 'visual'
                    const on = escolhivel && types.includes(tp.id as TestType)
                    return (
                      <button key={tp.id} type="button" disabled={!tp.available || running} onClick={() => escolhivel && toggleType(tp.id as TestType)}
                        className={`text-left rounded-xl border px-3 py-2.5 ${on ? 'border-indigo-500/50 bg-indigo-500/10' : tp.available ? 'border-neutral-700 bg-neutral-800/30 hover:bg-neutral-800/60' : 'border-neutral-800 bg-neutral-900/60 opacity-60'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white">{tp.label}</span>
                          {on ? <CheckCircle2 className="w-4 h-4 text-indigo-400" /> : !tp.available ? <span className="text-[10px] uppercase tracking-wider text-neutral-500">{t('ide_tests.soon', 'em breve')}</span> : <Circle className="w-4 h-4 text-neutral-600" />}
                        </div>
                        <p className="text-xs text-neutral-400 mt-1">{tp.desc}</p>
                      </button>
                    )
                  })}
                </div>
                {types.includes('carga') && (
                  <div className="mt-3 rounded-xl border border-neutral-700 bg-neutral-800/30 px-3 py-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-white">
                        {t('ide_tests.carga_users', 'Usuários simultâneos')}
                        <input type="number" min={1} max={CARGA_MAX_USERS} value={cargaUsersText} disabled={running}
                          onChange={e => setCargaUsersText(e.target.value)}
                          onBlur={() => { changeCarga({ users: Number(cargaUsersText) }); setCargaUsersText(String(normalizarCarga({ users: Number(cargaUsersText) }).users)) }}
                          className="w-20 rounded-lg bg-neutral-900 border border-neutral-600 px-2 py-1 text-xs text-white" />
                        <span className="text-[10px] font-normal text-neutral-400">{t('ide_tests.carga_users_max', 'de 1 a')} {CARGA_MAX_USERS}</span>
                      </label>
                      {([['leitura', t('ide_tests.carga_modo_leitura', 'Leitura')], ['gravacao', t('ide_tests.carga_modo_gravacao', 'Gravação')], ['mistura', t('ide_tests.carga_modo_mistura', 'Mistura')]] as Array<[CargaModo, string]>).map(([m, label]) => (
                        <label key={m} className="flex items-center gap-1.5 text-xs text-neutral-200 cursor-pointer">
                          <input type="checkbox" checked={carga.modos.includes(m)} disabled={running} onChange={() => toggleCargaModo(m)} className="accent-indigo-500" />
                          {label}
                        </label>
                      ))}
                    </div>
                    <p className="text-[11px] text-neutral-400">{t('ide_tests.carga_modos_desc', 'Leitura: todos abrem a tela ao mesmo tempo. Gravação: todos cadastram um registro ao mesmo tempo (dados E2E-, apagados no fim; só Pesquisa + Cadastro). Mistura: metade grava e metade lê. Escolha um, dois ou os três.')}</p>
                  </div>
                )}
                {(types.some(x => x === 'integracao' || x === 'seguranca') || (types.includes('carga') && cargaGrava(carga))) && (
                  <p className="mt-2 text-[11px] text-neutral-400">{t('ide_tests.int_note', 'A integração grava dados de teste (texto começando com E2E-) no banco de teste e os apaga no fim; a conferência final confirma que nada existente mudou.')}</p>
                )}
                </>}
              </section>

              {/* 2. Casos de uso */}
              <section>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mr-auto">2 · {t('ide_tests.scope', 'Casos de uso')}</h3>
                  <button onClick={() => setAll(true)} disabled={running || selectable.length === 0} className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40">{t('ide_tests.select_all', 'Marcar todos')}</button>
                  <button onClick={() => setAll(false)} disabled={running || chosen.length === 0} className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40">{t('ide_tests.select_none', 'Desmarcar todos')}</button>
                  <button onClick={loadManifest} disabled={loading || running} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('ide_tests.reload', 'Atualizar plano')}
                  </button>
                  {secToggle('scope')}
                </div>
                {secOpen.scope && <>
                {loading && <p className="text-sm text-neutral-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {t('ide_tests.loading', 'Gerando o plano a partir do projeto...')}</p>}
                {loadError && <p className="text-sm text-red-400">{loadError}</p>}
                {target.type !== 'project' && <p className="text-sm text-neutral-400">{t('ide_tests.only_project', 'Por enquanto os testes rodam por projeto. Abra um projeto na IDE.')}</p>}
                <div className="space-y-2">
                  {views.map((v: ManifestView) => {
                    const plan = planFor(v)
                    const ok = plan.length > 0
                    const completo = isSupportedView(v)
                    return (
                      <div key={v.slug} className={`rounded-xl border ${ok ? 'border-neutral-700 bg-neutral-800/40' : 'border-neutral-800 bg-neutral-900/40 opacity-60'}`}>
                        <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer">
                          <input type="checkbox" disabled={!ok || running} checked={!!selected[v.slug] && ok} onChange={e => setSelected(s => ({ ...s, [v.slug]: e.target.checked }))} className="accent-indigo-500" />
                          <span className="text-sm font-semibold text-white">{v.title}</span>
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">{v.logicType}</span>
                          <span className="ml-auto text-xs text-neutral-400">{ok ? `${plan.length} ${plan.length === 1 ? t('ide_tests.test', 'teste') : t('ide_tests.tests', 'testes')}${completo ? '' : ' · ' + t('ide_tests.basic_only', 'só "a tela abre" (gabarito completo em breve)')}` : t('ide_tests.no_template', 'ainda sem teste automático')}</span>
                        </label>
                        {ok && selected[v.slug] && (
                          <ul className="px-4 pb-3 space-y-1">
                            {plan.map(p => {
                              const r = results[keyOf(describeName(v), p.title)]
                              return (
                                <li key={p.title} className="text-xs">
                                  <div className="flex items-start gap-2">
                                    <StatusIcon s={r?.status ?? 'pending'} />
                                    <span className={r?.status === 'failed' ? 'text-red-300' : 'text-neutral-300'}>{planTitle(p, language)}</span>{r?.status === 'failed' && evidence(r.shot, r.video, planTitle(p, language))}
                                    {r?.ms != null && <span className="ml-auto text-neutral-500 tabular-nums">{(r.ms / 1000).toFixed(1)}s</span>}
                                  </div>
                                  {(r?.status === 'skipped' || r?.status === 'passed') && r.reason && <p className="mt-0.5 ml-6 text-[11px] text-neutral-500">{r.reason}</p>}
                                  {r?.error && <pre className="mt-1 ml-6 whitespace-pre-wrap text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{r.error}</pre>}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
                </>}
              </section>

              {/* 3. Onde rodar */}
              <section>
                <div className="flex items-center gap-3"><h3 className={`${lblSection} mr-auto`}>3 · {t('ide_tests.where', 'Onde rodar')}</h3>{secToggle('where')}</div>
                {secOpen.where && <>
                {desktop && (
                  <div className="mb-3 rounded-xl border border-neutral-700 bg-neutral-800/40 px-4 py-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-white mr-2">{t('ide_tests.engine_title', 'Motor de testes')}</span>
                    </div>
                    {(
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        {engineBusy
                          ? <span className="flex items-center gap-1.5 text-neutral-400"><Loader2 className="w-3 h-3 animate-spin" /> {engineBusy === 'files' ? t('ide_tests.engine_installing_files', 'Gravando os arquivos do motor...') : t('ide_tests.engine_installing_npm', 'Instalando as dependências (npm install, pode levar um minuto)...')}</span>
                          : !engineSt?.installed
                            ? <>
                                <span className="text-amber-700 [html:not(.light)_&]:text-amber-400">{t('ide_tests.engine_not_installed', 'Motor ainda não instalado nesta máquina.')}</span>
                                <button onClick={doInstallEngine} disabled={running} className="rounded-md border border-indigo-500/50 px-2 py-0.5 text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-40">{t('ide_tests.engine_install', 'Instalar motor')}</button>
                              </>
                            : engineSt.upToDate
                              ? <span className="text-emerald-400">{t('ide_tests.engine_ok', 'Motor instalado e atualizado (versão {v}).').replace('{v}', engineSt.currentVersion)}</span>
                              : <>
                                  <span className="text-amber-700 [html:not(.light)_&]:text-amber-400">{t('ide_tests.engine_outdated', 'Há uma versão nova do motor.')}</span>
                                  <button onClick={doInstallEngine} disabled={running} className="rounded-md border border-indigo-500/50 px-2 py-0.5 text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-40">{t('ide_tests.engine_update', 'Atualizar motor')}</button>
                                </>}
                        {browserName === null && engineSt?.installed && <span className="text-red-300">{t('ide_tests.browser_none', 'Nenhum navegador compatível (Chrome ou Edge) encontrado.')}</span>}
                      </div>
                    )}
                    {engineErr && <p className="text-[11px] text-red-300 whitespace-pre-wrap">{engineErr}</p>}
                  </div>
                )}
                {desktop && (
                  <IdeTestDb settings={dbSettings} onChange={updateDb} appDbHint={appDbHint} busy={dbBusy} result={dbResult} engineReady={!!engineSt?.installed} disabled={running}
                    authType={manifest?.auth?.type ?? null} onTest={testDb} onPrepare={prepareDb} onRemove={removeRobot}
                    dbTipo={dbTipo ?? 'postgres'} canAutoCopy={dbTipo === 'postgres'}
                    copyName={copyName} onCopyName={setCopyName} onCreateCopy={createCopy} copyScript={buildCopyScript(appDbUrl, copyName || suggestCopyName(appDbUrl))} />
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">{t('ide_tests.app', 'App exportado a testar')}</p>
                    <button onClick={() => pick()} disabled={running || !desktop} className="w-full flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/60 hover:bg-neutral-800 px-3 py-2 text-left text-xs disabled:opacity-50">
                      <FolderOpen className="w-4 h-4 text-neutral-400 shrink-0" />
                      <span className={`truncate ${appDir ? 'text-neutral-200' : 'text-neutral-500'}`}>{appDir || t('ide_tests.pick', 'Escolher pasta...')}</span>
                    </button>
                    {(folderSuggestions.length > 0 || appDirAuto) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {folderSuggestions.map(sg => (
                          <button key={sg.dir} type="button" disabled={running || sg.dir === appDir} onClick={() => useSuggested(sg.dir)} title={sg.dir}
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${sg.dir === appDir ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-200' : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'}`}>
                            {sg.kind === 'sync' ? t('delivery.tests_use_sync', 'Pasta do Sincronizar') : t('delivery.tests_use_delivery', 'Última Entrega')}
                          </button>
                        ))}
                        {appDirAuto && <span className="text-[10px] text-neutral-500">{t('delivery.tests_auto', 'Pasta do projeto escolhida automaticamente.')}</span>}
                      </div>
                    )}
                  </div>
                </div>
                {!desktop && <p className="text-xs text-neutral-500 mt-2">{t('ide_tests.desktop_only', 'Rodar os testes só funciona na IDE Desktop.')}</p>}
                </>}
              </section>

              {/* 4. Modo */}
              <section>
                <h3 className={lblSection}>4 · {t('ide_tests.mode', 'Como acompanhar')}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {([
                    ['internal', Eye, t('ide_tests.mode_internal', 'Navegador interno (aqui no painel)')],
                    ['external', FolderOpen, t('ide_tests.mode_external', 'Navegador do sistema (abre uma janela)')],
                    ['background', EyeOff, t('ide_tests.background', 'Em segundo plano (mais rápido)')],
                  ] as const).map(([id, Icon, label]) => (
                    <button key={id} onClick={() => setMode(id)} disabled={running} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${mode === id ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300' : 'border-neutral-700 text-neutral-400'}`}><Icon className="w-4 h-4" /> {label}</button>
                  ))}
                  {mode !== 'background' && (
                    <select value={slow} onChange={e => setSlow(Number(e.target.value))} disabled={running} className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-xs text-neutral-200">
                      <option value={0}>{t('ide_tests.speed_fast', 'Rápido')}</option>
                      <option value={300}>{t('ide_tests.speed_normal', 'Normal')}</option>
                      <option value={800}>{t('ide_tests.speed_slow', 'Devagar (para acompanhar)')}</option>
                    </select>
                  )}
                </div>
                {desktop && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    {mode === 'external'
                      ? <span className="text-neutral-500">{t('ide_tests.ffmpeg_external', 'Vídeo das falhas: só nos modos navegador interno e segundo plano (a captura de tela vale em todos).')}</span>
                      : ffmpeg === 'ok'
                        ? <span className="text-emerald-400">{t('ide_tests.ffmpeg_on', 'Vídeo das falhas: ativado')}</span>
                        : ffmpeg === 'installing'
                          ? <span className="flex items-center gap-1.5 text-neutral-400"><Loader2 className="w-3 h-3 animate-spin" /> {t('ide_tests.ffmpeg_installing', 'Baixando o ffmpeg...')}</span>
                          : ffmpeg === 'missing' && (
                            <>
                              <span className="text-amber-700 [html:not(.light)_&]:text-amber-400">{t('ide_tests.ffmpeg_missing', 'Vídeo das falhas: desativado (só a captura de tela é gravada)')}</span>
                              <button onClick={enableVideo} disabled={running} className="rounded-md border border-indigo-500/50 px-2 py-0.5 text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-40">{t('ide_tests.ffmpeg_enable', 'Ativar vídeo das falhas')}</button>
                            </>
                          )}
                    {ffmpegErr && <span className="text-red-300 whitespace-pre-wrap">{ffmpegErr}</span>}
                  </div>
                )}
              </section>
            </>)}

            {runError && <p className="text-sm text-red-400 whitespace-pre-wrap">{runError}</p>}
            {logs.length > 0 && (
              <details className="text-xs text-neutral-400">
                <summary className="cursor-pointer">{t('ide_tests.log', 'Log do motor')} ({logs.length})</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-[11px]">{logs.join('\n')}</pre>
              </details>
            )}
          </>)}
        </div>

        {/* Rodapé */}
        {tab === 'run' && (
          <div className="flex items-center gap-3 px-6 py-4 border-t border-neutral-800">
            <div className="flex-1 text-xs text-neutral-400">
              {summary
                ? <span><b className="text-emerald-400">{summary.passed}</b> {t('ide_tests.passed', 'passaram')} · <b className="text-red-400">{summary.failed}</b> {t('ide_tests.failed', 'falharam')}{summary.skipped ? <> · {summary.skipped} {t('ide_tests.skipped', 'ignorados')}</> : null}</span>
                : <span>{chosen.length} {t('ide_tests.views_selected', 'caso(s) de uso')} · {plannedCount} {t('ide_tests.tests', 'testes')}</span>}
            </div>
            {summary && !running && <button onClick={resetRun} className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800"><Eraser className="w-4 h-4" /> {t('ide_tests.reset', 'Limpar')}</button>}
            {summary && reportButton}
            {running
              ? <button onClick={stop} className="flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2 text-sm font-bold text-white"><Square className="w-4 h-4" /> {t('ide_tests.stop', 'Parar')}</button>
              : <button onClick={() => run()} disabled={!desktop || plannedCount === 0 || loading || !!viewing} className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-2 text-sm font-bold text-white"><Play className="w-4 h-4" /> {t('ide_tests.run', 'Executar testes')}</button>}
          </div>
        )}
      </div>

      {report && (
        <div className="fixed inset-0 z-[1000001] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl h-[92vh] flex flex-col rounded-2xl bg-neutral-900 border border-neutral-700 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-bold text-white flex-1">{t('ide_tests.report_title', 'Relatório de testes')}</span>
              {reportMsg && <span className={`text-[11px] max-w-xs truncate ${reportMsg.kind === 'err' ? 'text-red-300' : reportMsg.kind === 'ok' ? 'text-emerald-300' : 'text-neutral-400'}`} title={reportMsg.text}>{reportMsg.kind === 'busy' && <Loader2 className="inline w-3 h-3 animate-spin mr-1" />}{reportMsg.text}</span>}
              <button onClick={() => reportFrame.current?.contentWindow?.print()} className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"><Printer className="w-4 h-4" /> {t('ide_tests.print', 'Imprimir')}</button>
              <div className="relative">
                <button onClick={() => setDownloadMenu(m => !m)} disabled={reportMsg?.kind === 'busy'} className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"><Download className="w-4 h-4" /> {t('ide_tests.download', 'Download')} <ChevronDown className="w-3.5 h-3.5" /></button>
                {downloadMenu && (
                  <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl p-1 z-10">
                    {(['pdf', 'html', 'json'] as const).map(f => <button key={f} onClick={() => downloadReport(f)} className="w-full text-left rounded-lg px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800">{f.toUpperCase()}</button>)}
                  </div>
                )}
              </div>
              <button onClick={() => { setReport(null); setReportMsg(null); setDownloadMenu(false) }} className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"><X className="w-4 h-4" /></button>
            </div>
            <iframe ref={reportFrame} title={t('ide_tests.report_title', 'Relatório de testes')} srcDoc={report.html} sandbox="allow-scripts allow-modals allow-same-origin" className="flex-1 w-full bg-white" />
          </div>
        </div>
      )}

      {askCompat && (
        <div className="fixed inset-0 z-[1000004] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-700 p-5 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-white">{t('ide_tests.compat_ask_title', 'Testar também no Firefox e no Safari?')}</h3>
            <p className="text-xs text-neutral-300">{t('ide_tests.compat_ask_body', 'Para testar no Firefox e no Safari (WebKit), o Playwright precisa baixar esses dois navegadores (cerca de 150 MB cada, da internet, para a pasta do Playwright do seu usuário). Nada é instalado no sistema e eles não substituem o seu navegador. Sem eles, só o Chrome é testado e os outros testes ficam como pulados.')}</p>
            <div className="flex flex-col gap-2">
              <button onClick={async () => { const a = askCompat; setAskCompat(null); await enableCompat(); run(a.only, true) }} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-xs font-bold text-white">{t('ide_tests.compat_ask_yes', 'Baixar e executar')}</button>
              <button onClick={() => { const a = askCompat; setAskCompat(null); compatSkipped.current = true; run(a.only, true) }} className="rounded-lg border border-neutral-600 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800">{t('ide_tests.compat_ask_no', 'Executar só com o Chrome')}</button>
            </div>
            {compatErr && <p className="text-[11px] text-red-300">{compatErr}</p>}
          </div>
        </div>
      )}

      {askFfmpeg && (
        <div className="fixed inset-0 z-[1000004] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-700 p-5 shadow-2xl space-y-3">
            <div className="flex items-center gap-2"><VideoIcon className="w-5 h-5 text-indigo-400" /><h3 className="text-sm font-bold text-white">{t('ide_tests.ffmpeg_ask_title', 'Gravar vídeo das falhas?')}</h3></div>
            <p className="text-xs text-neutral-300">{t('ide_tests.ffmpeg_ask_body', 'Para gravar o vídeo dos testes que falharem, o Playwright precisa baixar o ffmpeg (cerca de 1 MB, da internet, para a pasta do Playwright do seu usuário). Nada é instalado no sistema. Sem ele, só a captura de tela é gravada.')}</p>
            <div className="flex flex-col gap-2">
              <button onClick={async () => { const a = askFfmpeg; setAskFfmpeg(null); await enableVideo(); run(a.only, true) }} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-xs font-bold text-white">{t('ide_tests.ffmpeg_ask_yes', 'Baixar e executar')}</button>
              <button onClick={() => { const a = askFfmpeg; setAskFfmpeg(null); ffmpegSkipped.current = true; run(a.only, true) }} className="rounded-lg border border-neutral-600 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800">{t('ide_tests.ffmpeg_ask_no', 'Executar sem vídeo')}</button>
              <button onClick={() => { const a = askFfmpeg; setAskFfmpeg(null); lsSet('mb_tests_ffmpeg_never', '1'); run(a.only, true) }} className="text-[11px] text-neutral-400 hover:text-neutral-200">{t('ide_tests.ffmpeg_ask_never', 'Executar sem vídeo e não perguntar mais')}</button>
            </div>
          </div>
        </div>
      )}

      {media && (
        <div className="fixed inset-0 z-[1000003] flex items-center justify-center bg-black/80 p-4" onClick={closeMedia}>
          <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-neutral-900 border border-neutral-700 overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800">
              {media.kind === 'image' ? <ImageIcon className="w-4 h-4 text-red-300" /> : <VideoIcon className="w-4 h-4 text-red-300" />}
              <span className="text-sm font-bold text-white">{media.kind === 'image' ? t('ide_tests.media_shot', 'Captura da tela da falha') : t('ide_tests.media_video', 'Vídeo da falha')}</span>
              <span className="text-xs text-neutral-400 flex-1 truncate">{media.title}</span>
              <button onClick={closeMedia} className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-auto bg-black flex items-center justify-center">
              {media.kind === 'image' ? <img src={media.url} alt="" className="max-w-full" /> : <video src={media.url} controls autoPlay className="max-w-full max-h-[78vh]" />}
            </div>
          </div>
        </div>
      )}

      {compare && <IdeTestCompareModal runs={compare} onClose={() => setCompare(null)} />}
    </div>
  )
}
