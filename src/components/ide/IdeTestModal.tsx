'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, FlaskConical, Play, Square, Loader2, CheckCircle2, FolderOpen, Eye, EyeOff, ShieldAlert, FileText, RefreshCw, ChevronDown, Printer, Download, RotateCcw, History as HistoryIcon, ChevronUp, Eraser, Image as ImageIcon, Video as VideoIcon,
} from 'lucide-react'
import { useI18n } from '@/i18n'
import { createClient } from '@/utils/supabase/client'
import { isTauri } from '@/utils/tauriUtils'
import { pickFolder } from '@/utils/exportToFolder'
import { checkRunnerDir, archiveTechReport, hasFfmpeg, installFfmpeg, makePdf, openTestReport, readLiveFrame, startTestRun, workDir, type TestRunHandle, type TestWatchMode } from '@/utils/testRunner'
import { artifactsDirFor, deleteRuns, historyDir, listRuns, readEvidenceBlob, readEvidenceDataUri, saveRun } from '@/utils/testHistory'
import { describeName, isSupportedView, planTitle, planView } from '@/lib/testing/plan'
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

interface Result { status: TestStatus; ms?: number; error?: string; shot?: string; video?: string }
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
  const [runnerDir, setRunnerDir] = useState('')
  const [appDir, setAppDir] = useState('')
  const [mode, setMode] = useState<TestWatchMode>('internal')
  const [frameUrl, setFrameUrl] = useState('')
  const [liveOpen, setLiveOpen] = useState(true)
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
    { id: 'funcional', label: t('ide_tests.type_funcional', 'Funcional · Pesquisa + Cadastro'), desc: t('ide_tests.type_funcional_desc', 'Todo caso de uso: a tela abre. Pesquisa + Cadastro: lista, formulário, obrigatórios, máscaras, total, ordenação, filtro e exportação'), available: true },
    { id: 'integracao', label: t('ide_tests.type_integracao', 'Integração'), desc: t('ide_tests.type_integracao_desc', 'Cadastro completo gravando no banco de teste'), available: false },
    { id: 'seguranca', label: t('ide_tests.type_seguranca', 'Segurança'), desc: t('ide_tests.type_seguranca_desc', 'Permissões, regras por linha e entradas maliciosas'), available: false },
    { id: 'visual', label: t('ide_tests.type_visual', 'Responsividade e acessibilidade'), desc: t('ide_tests.type_visual_desc', 'Tamanhos de tela, contraste e leitor de tela'), available: false },
    { id: 'compat', label: t('ide_tests.type_compat', 'Compatibilidade'), desc: t('ide_tests.type_compat_desc', 'Chrome, Firefox e Safari'), available: false },
    { id: 'carga', label: t('ide_tests.type_carga', 'Desempenho e carga'), desc: t('ide_tests.type_carga_desc', 'Muitos acessos ao mesmo tempo'), available: false },
  ]

  // lembra a pasta do motor (vale para todos os projetos) e a do app exportado (de cada projeto)
  useEffect(() => {
    if (!isOpen) return
    setRunnerDir(lsGet('mb_tests_runner_dir'))
    setAppDir(lsGet(`mb_tests_app_dir_${projectId}`))
  }, [isOpen, projectId])

  useEffect(() => {
    if (!isOpen || !isTauri()) return
    hasFfmpeg().then(ok => setFfmpeg(ok ? 'ok' : 'missing')).catch(() => setFfmpeg('unknown'))
  }, [isOpen])

  /** Baixa o ffmpeg (a pasta do motor é onde está o Playwright que sabe instalá-lo). */
  const enableVideo = async (): Promise<boolean> => {
    if (!runnerDir) { setFfmpegErr(t('ide_tests.err_runner', 'Escolha a pasta do motor de testes (a pasta e2e).')); return false }
    setFfmpeg('installing'); setFfmpegErr('')
    try { await installFfmpeg(runnerDir); const ok = await hasFfmpeg(); setFfmpeg(ok ? 'ok' : 'missing'); return ok }
    catch (e: any) { setFfmpeg('missing'); setFfmpegErr(`${t('ide_tests.ffmpeg_err', 'Não foi possível baixar o ffmpeg.')} (${e?.message || e})`); return false }
  }

  const loadManifest = useCallback(async () => {
    if (!target || target.type !== 'project') return
    setLoading(true); setLoadError('')
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch('/api/test-manifest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ projectId: target.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `Erro ${res.status}`)
      const m = json as TestManifest
      setManifest(m)
      setSelected(Object.fromEntries(m.views.map(v => [v.slug, planView(v).length > 0])))
    } catch (e: any) {
      setLoadError(e?.message || t('ide_tests.err_plan', 'Não foi possível gerar o plano.'))
    } finally {
      setLoading(false)
    }
  }, [target, t])

  useEffect(() => { if (isOpen && !manifest) loadManifest() }, [isOpen, manifest, loadManifest])
  useEffect(() => { if (!isOpen) { setManifest(null); setResults({}); setSummary(null); setRunError(''); setViewing(null); setCompare(null); setTab('run') } }, [isOpen])

  const views = manifest?.views ?? []
  const selectable = useMemo(() => views.filter(v => planView(v).length > 0), [views])
  const chosen = useMemo(() => selectable.filter(v => selected[v.slug]), [selectable, selected])
  const plannedCount = useMemo(() => chosen.reduce((n, v) => n + planView(v).length, 0), [chosen])

  const setAll = (on: boolean) => setSelected(Object.fromEntries(views.map(v => [v.slug, on && planView(v).length > 0])))

  const pick = async (kind: 'runner' | 'app') => {
    const dir = await pickFolder()
    if (!dir) return
    if (kind === 'runner') { setRunnerDir(dir); lsSet('mb_tests_runner_dir', dir) } else { setAppDir(dir); lsSet(`mb_tests_app_dir_${projectId}`, dir) }
  }

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
      rows: planView(v).map(p => {
        const r = res[keyOf(describeName(v), p.title)]
        const status: RowStatus = !r || r.status === 'running' ? 'pending' : r.status
        return { ...p, status, ms: r?.ms, error: r?.error, shot: r?.shot, video: r?.video }
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
    const r: Result = ev.t === 'begin' ? { status: 'running' } : { status: ev.status || 'failed', ms: ev.ms, error: ev.error, shot: ev.shot, video: ev.video }
    resultsRef.current = { ...resultsRef.current, [k]: r }
    setResults(prev => ({ ...prev, [k]: r }))
  }, [])

  const run = async (only?: ManifestView[], skipAsk = false) => {
    if (!manifest || !isTauri()) return
    const toRun = only ?? chosen
    setViewing(null); setRunError(''); setSummary(null); setResults({}); setLogs([]); resultsRef.current = {}
    if (toRun.length === 0) { setRunError(t('ide_tests.err_none', 'Nenhum caso de uso para testar.')); return }
    if (!runnerDir) { setRunError(t('ide_tests.err_runner', 'Escolha a pasta do motor de testes (a pasta e2e).')); return }
    if (!appDir) { setRunError(t('ide_tests.err_app', 'Escolha a pasta do app exportado que será testado.')); return }
    // vídeo das falhas: se falta o ffmpeg, pergunta uma vez (a menos que o usuário já tenha dito para não perguntar mais)
    if (!skipAsk && mode !== 'external' && ffmpeg === 'missing' && !ffmpegSkipped.current && lsGet('mb_tests_ffmpeg_never') !== '1') { setAskFfmpeg({ only }); return }
    setRunning(true)
    try {
      const chk = await checkRunnerDir(runnerDir)
      if (!chk.ok) { setRunning(false); setRunError(t('ide_tests.err_incomplete', 'A pasta do motor de testes está incompleta (falta: {missing}). Escolha a pasta e2e do projeto e rode npm install nela.').replace('{missing}', chk.missing.join(', '))); return }
      const startedAt = new Date()
      const artifactsDir = await artifactsDirFor(runId(startedAt))
      runMeta.current = { startedAt, views: toRun, mode, stopped: false, artifactsDir }
      setRunTotal(toRun.reduce((n, v) => n + planView(v).length, 0)); setLiveOpen(true)
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      handle.current = await startTestRun({
        runnerDir, appDir, manifest, viewSlugs: toRun.map(v => v.slug), mode, slowMoMs: slow,
        artifactsDir, onEvent, onLog: l => setLogs(x => [...x.slice(-199), l]), onClose: code => { finishRun(code) },
      })
    } catch (e: any) {
      setRunning(false); runMeta.current = null
      const msg = String(e?.message || e || '')
      // o Tauri só libera pastas fora do perfil do usuário durante a sessão em que foram escolhidas: depois de reabrir a IDE é preciso escolher de novo
      setRunError(/forbidden|scope|not allowed|permission/i.test(msg)
        ? t('ide_tests.err_reauth', 'O Windows pede para autorizar a pasta de novo depois que a IDE é reaberta. Clique em "{runner}" e em "{app}" e escolha as mesmas pastas.').replace('{runner}', t('ide_tests.runner', 'Motor de testes (pasta e2e)')).replace('{app}', t('ide_tests.app', 'App exportado a testar')) + `\n(${msg})`
        : (msg || t('ide_tests.err_start', 'Não foi possível iniciar os testes.')))
    }
  }

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
    for (const g of r.groups) for (const row of g.rows) if (row.status !== 'pending') res[keyOf(g.name, row.title)] = { status: row.status as TestStatus, ms: row.ms, error: row.error, shot: row.shot, video: row.video }
    const tt = runTotals(r)
    setResults(res); setSummary({ total: tt.total, passed: tt.passed, failed: tt.failed, skipped: tt.other }); setViewing(r); setRunError(''); setTab('run')
  }

  const rerun = (r: HistoryRun) => {
    const slugs = new Set(r.groups.map(g => g.slug))
    const still = selectable.filter(v => slugs.has(v.slug))
    if (still.length === 0) { setRunError(t('ide_tests.err_rerun_missing', 'Os casos de uso desta execução não existem mais no projeto.')); return }
    setSelected(Object.fromEntries(views.map(v => [v.slug, slugs.has(v.slug) && planView(v).length > 0])))
    run(still)
  }

  // navegador interno: lê o quadro mais recente da tela do teste e mostra no painel
  useEffect(() => {
    if (!running || mode !== 'internal') return
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
  }, [running, mode])
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
    if (viewing) return viewing.groups.map(g => ({ name: g.name, logicType: g.logicType, rows: g.rows.map(r => ({ title: r.title, text: planTitle(r, language), status: r.status, ms: r.ms, error: r.error, shot: r.shot })) }))
    return chosen.map(v => ({
      name: describeName(v), logicType: v.logicType,
      rows: planView(v).map(p => { const r = results[keyOf(describeName(v), p.title)]; return { title: p.title, text: planTitle(p, language), status: (r?.status ?? 'pending') as RowStatus, ms: r?.ms, error: r?.error, shot: r?.shot } }),
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
      if (fmt === 'pdf' && !runnerDir) { setReportMsg({ kind: 'err', text: t('ide_tests.err_runner', 'Escolha a pasta do motor de testes (a pasta e2e).') }); return }
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
              <p>{t('ide_tests.safety', 'Os testes rodam em um banco de teste. Hoje o motor só aceita banco local da lista permitida e confere, no fim, que nenhuma linha real foi alterada. Rodar no banco original só com o seu consentimento (em breve).')}</p>
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
                      : <div className="flex items-center justify-center gap-2 h-40 text-sm text-neutral-400"><Loader2 className="w-4 h-4 animate-spin" /> {t('ide_tests.live_wait', 'Iniciando o navegador...')}</div>)}
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
                <h3 className={lblSection}>1 · {t('ide_tests.type', 'Tipo de teste')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {TEST_TYPES.map(tp => (
                    <div key={tp.id} className={`rounded-xl border px-3 py-2.5 ${tp.available ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-neutral-800 bg-neutral-900/60 opacity-60'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{tp.label}</span>
                        {tp.available ? <CheckCircle2 className="w-4 h-4 text-indigo-400" /> : <span className="text-[10px] uppercase tracking-wider text-neutral-500">{t('ide_tests.soon', 'em breve')}</span>}
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">{tp.desc}</p>
                    </div>
                  ))}
                </div>
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
                </div>
                {loading && <p className="text-sm text-neutral-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {t('ide_tests.loading', 'Gerando o plano a partir do projeto...')}</p>}
                {loadError && <p className="text-sm text-red-400">{loadError}</p>}
                {target.type !== 'project' && <p className="text-sm text-neutral-400">{t('ide_tests.only_project', 'Por enquanto os testes rodam por projeto. Abra um projeto na IDE.')}</p>}
                <div className="space-y-2">
                  {views.map((v: ManifestView) => {
                    const plan = planView(v)
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
              </section>

              {/* 3. Onde rodar */}
              <section>
                <h3 className={lblSection}>3 · {t('ide_tests.where', 'Onde rodar')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {([['runner', t('ide_tests.runner', 'Motor de testes (pasta e2e)'), runnerDir], ['app', t('ide_tests.app', 'App exportado a testar'), appDir]] as const).map(([kind, label, value]) => (
                    <div key={kind}>
                      <p className="text-xs text-neutral-400 mb-1">{label}</p>
                      <button onClick={() => pick(kind)} disabled={running || !desktop} className="w-full flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/60 hover:bg-neutral-800 px-3 py-2 text-left text-xs disabled:opacity-50">
                        <FolderOpen className="w-4 h-4 text-neutral-400 shrink-0" />
                        <span className={`truncate ${value ? 'text-neutral-200' : 'text-neutral-500'}`}>{value || t('ide_tests.pick', 'Escolher pasta...')}</span>
                      </button>
                    </div>
                  ))}
                </div>
                {!desktop && <p className="text-xs text-neutral-500 mt-2">{t('ide_tests.desktop_only', 'Rodar os testes só funciona na IDE Desktop.')}</p>}
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
