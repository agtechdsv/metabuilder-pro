'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, FlaskConical, Play, Square, Loader2, CheckCircle2, FolderOpen, Eye, EyeOff, ShieldAlert, FileText, RefreshCw, ChevronDown, Printer, Download, RotateCcw, History as HistoryIcon,
} from 'lucide-react'
import { useI18n } from '@/i18n'
import { createClient } from '@/utils/supabase/client'
import { isTauri } from '@/utils/tauriUtils'
import { pickFolder } from '@/utils/exportToFolder'
import { checkRunnerDir, openTestReport, readLiveFrame, startTestRun, type TestRunHandle, type TestWatchMode } from '@/utils/testRunner'
import { deleteRuns, historyDir, listRuns, saveRun } from '@/utils/testHistory'
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

interface Result { status: TestStatus; ms?: number; error?: string }
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
  const [slow, setSlow] = useState(300)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Record<string, Result>>({})
  const [summary, setSummary] = useState<{ total: number; passed: number; failed: number; skipped: number } | null>(null)
  const [runError, setRunError] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const handle = useRef<TestRunHandle | null>(null)
  const [reportMenu, setReportMenu] = useState(false)
  const [report, setReport] = useState<{ mode: 'html' | 'pdf'; html: string } | null>(null)
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
  const runMeta = useRef<{ startedAt: Date; views: ManifestView[]; mode: TestWatchMode; stopped: boolean } | null>(null)

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
  const buildRun = (meta: NonNullable<typeof runMeta.current>, res: Record<string, Result>): HistoryRun => {
    const groups: HistoryGroup[] = meta.views.map(v => ({
      slug: v.slug, name: describeName(v), viewTitle: v.title, logicType: v.logicType,
      rows: planView(v).map(p => {
        const r = res[keyOf(describeName(v), p.title)]
        const status: RowStatus = !r || r.status === 'running' ? 'pending' : r.status
        return { ...p, status, ms: r?.ms, error: r?.error }
      }),
    }))
    return { version: 1, id: runId(meta.startedAt), projectId, projectName: target?.name || '', startedAt: meta.startedAt.toISOString(), finishedAt: new Date().toISOString(), mode: meta.mode, stopped: meta.stopped || undefined, groups }
  }

  const finishRun = async (code: number | null) => {
    setRunning(false); handle.current = null
    const meta = runMeta.current
    runMeta.current = null
    if (code !== 0 && code !== 1 && code !== null) setRunError(t('ide_tests.err_exit', 'O motor terminou com erro (código {code}). Veja o log abaixo.').replace('{code}', String(code)))
    if (meta && Object.keys(resultsRef.current).length > 0) {
      try { await saveRun(projectSlug, buildRun(meta, resultsRef.current)); if (tab === 'history') loadHistory() }
      catch (e: any) { setRunError(`${t('ide_tests.hist_save_err', 'Os testes terminaram, mas não foi possível gravar no histórico.')} (${e?.message || e})`) }
    }
  }

  const onEvent = useCallback((ev: TestEvent) => {
    if (ev.t === 'done') { setSummary({ total: ev.total ?? 0, passed: ev.passed ?? 0, failed: ev.failed ?? 0, skipped: ev.skipped ?? 0 }); return }
    if (!ev.group || !ev.title) return
    const k = keyOf(ev.group, ev.title)
    const r: Result = ev.t === 'begin' ? { status: 'running' } : { status: ev.status || 'failed', ms: ev.ms, error: ev.error }
    resultsRef.current = { ...resultsRef.current, [k]: r }
    setResults(prev => ({ ...prev, [k]: r }))
  }, [])

  const run = async (only?: ManifestView[]) => {
    if (!manifest || !isTauri()) return
    const toRun = only ?? chosen
    setViewing(null); setRunError(''); setSummary(null); setResults({}); setLogs([]); resultsRef.current = {}
    if (toRun.length === 0) { setRunError(t('ide_tests.err_none', 'Nenhum caso de uso para testar.')); return }
    if (!runnerDir) { setRunError(t('ide_tests.err_runner', 'Escolha a pasta do motor de testes (a pasta e2e).')); return }
    if (!appDir) { setRunError(t('ide_tests.err_app', 'Escolha a pasta do app exportado que será testado.')); return }
    setRunning(true)
    try {
      const chk = await checkRunnerDir(runnerDir)
      if (!chk.ok) { setRunning(false); setRunError(t('ide_tests.err_incomplete', 'A pasta do motor de testes está incompleta (falta: {missing}). Escolha a pasta e2e do projeto e rode npm install nela.').replace('{missing}', chk.missing.join(', '))); return }
      runMeta.current = { startedAt: new Date(), views: toRun, mode, stopped: false }
      handle.current = await startTestRun({
        runnerDir, appDir, manifest, viewSlugs: toRun.map(v => v.slug), mode, slowMoMs: slow,
        onEvent, onLog: l => setLogs(x => [...x.slice(-199), l]), onClose: code => { finishRun(code) },
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

  const stop = async () => { if (runMeta.current) runMeta.current.stopped = true; await handle.current?.stop() }

  // abrir uma execução do histórico: a tela mostra os resultados como no fim de uma rodada
  const openRun = (r: HistoryRun) => {
    const res: Record<string, Result> = {}
    for (const g of r.groups) for (const row of g.rows) if (row.status !== 'pending') res[keyOf(g.name, row.title)] = { status: row.status as TestStatus, ms: row.ms, error: row.error }
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
    if (!running || mode !== 'internal' || !runnerDir) return
    let alive = true
    let last = 0
    const tick = async () => {
      const bytes = await readLiveFrame(runnerDir)
      if (!alive || !bytes || bytes.length === 0) return
      const sig = bytes.length * 31 + bytes[Math.floor(bytes.length / 2)]
      if (sig === last) return
      last = sig
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' }))
      setFrameUrl(old => { if (old) URL.revokeObjectURL(old); return url })
    }
    const id = setInterval(tick, 250)
    return () => { alive = false; clearInterval(id) }
  }, [running, mode, runnerDir])
  useEffect(() => { if (!isOpen) setFrameUrl(old => { if (old) URL.revokeObjectURL(old); return '' }) }, [isOpen])

  // ---- relatório (da rodada na tela ou da execução aberta do histórico)
  const currentGroups = (): { name: string; logicType: string; rows: { title: string; status: RowStatus; ms?: number; error?: string }[] }[] => {
    if (viewing) return viewing.groups.map(g => ({ name: g.name, logicType: g.logicType, rows: g.rows.map(r => ({ title: planTitle(r, language), status: r.status, ms: r.ms, error: r.error })) }))
    return chosen.map(v => ({
      name: describeName(v), logicType: v.logicType,
      rows: planView(v).map(p => { const r = results[keyOf(describeName(v), p.title)]; return { title: planTitle(p, language), status: (r?.status ?? 'pending') as RowStatus, ms: r?.ms, error: r?.error } }),
    }))
  }

  const showReport = (rmode: 'html' | 'pdf') => {
    setReportMenu(false)
    setReport({ mode: rmode, html: buildReportHtml({ project: viewing?.projectName || target?.name || '', generatedAt: viewing ? new Date(viewing.finishedAt) : new Date(), groups: currentGroups(), mode: rmode, lang: language }) })
  }

  const downloadReport = async () => {
    if (!report) return
    const name = `relatorio-testes-${(target?.slug || 'projeto')}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.html`
    try {
      if (isTauri()) {
        const dir = await pickFolder()
        if (!dir) return
        const { writeTextFile } = await import('@tauri-apps/plugin-fs')
        const { join } = await import('@tauri-apps/api/path')
        await writeTextFile(await join(dir, name), report.html)
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([report.html], { type: 'text/html' }))
        a.download = name; a.click(); URL.revokeObjectURL(a.href)
      }
    } catch (e: any) { setRunError(e?.message || t('ide_tests.err_save_report', 'Não foi possível salvar o relatório.')) }
  }

  if (!isOpen || !target) return null
  const desktop = isTauri()
  const lblSection = 'text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2'

  const reportButton = (
    <div className="relative">
      <button onClick={() => setReportMenu(m => !m)} className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800"><FileText className="w-4 h-4" /> {t('ide_tests.report', 'Abrir relatório')} <ChevronDown className="w-3.5 h-3.5" /></button>
      {reportMenu && (
        <div className="absolute bottom-full right-0 mb-2 w-72 rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl p-1 z-10">
          <button onClick={() => showReport('html')} className="w-full text-left rounded-lg px-3 py-2 hover:bg-neutral-800"><span className="block text-xs font-semibold text-white">{t('ide_tests.report_html', 'HTML interativo')}</span><span className="block text-[11px] text-neutral-400">{t('ide_tests.report_html_desc', 'Painel com filtros, busca e grupos por caso de uso')}</span></button>
          <button onClick={() => showReport('pdf')} className="w-full text-left rounded-lg px-3 py-2 hover:bg-neutral-800"><span className="block text-xs font-semibold text-white">PDF</span><span className="block text-[11px] text-neutral-400">{t('ide_tests.report_pdf_desc', 'Layout de papel: imprimir ou salvar como PDF')}</span></button>
          {!viewing && <button onClick={() => { setReportMenu(false); openTestReport(runnerDir) }} className="w-full text-left rounded-lg px-3 py-2 hover:bg-neutral-800"><span className="block text-xs font-semibold text-white">{t('ide_tests.report_tech', 'Relatório técnico (Playwright)')}</span><span className="block text-[11px] text-neutral-400">{t('ide_tests.report_tech_desc', 'Com rastros e capturas das falhas')}</span></button>}
        </div>
      )}
    </div>
  )

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

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
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

            {/* Navegador interno: a execução do teste, dentro do painel */}
            {!viewing && mode === 'internal' && (running || frameUrl) && (
              <section>
                <h3 className={lblSection}>{t('ide_tests.live_view', 'Navegador interno · execução ao vivo')}</h3>
                <div className="rounded-xl border border-neutral-700 bg-black overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 border-b border-neutral-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400" /><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-3 text-[11px] text-neutral-400">{running ? t('ide_tests.live_running', 'Testando... (somente visualização)') : t('ide_tests.live_last', 'Última tela da execução')}</span>
                  </div>
                  {frameUrl
                    ? <img src={frameUrl} alt="" className="w-full block" />
                    : <div className="flex items-center justify-center gap-2 h-56 text-sm text-neutral-400"><Loader2 className="w-4 h-4 animate-spin" /> {t('ide_tests.live_wait', 'Iniciando o navegador...')}</div>}
                </div>
              </section>
            )}

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
                            <span className={p.status === 'failed' ? 'text-red-300' : 'text-neutral-300'}>{planTitle(p, language)}</span>
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
                                    <span className={r?.status === 'failed' ? 'text-red-300' : 'text-neutral-300'}>{planTitle(p, language)}</span>
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
              <span className="text-sm font-bold text-white flex-1">{report.mode === 'pdf' ? t('ide_tests.report_title_pdf', 'Relatório (PDF)') : t('ide_tests.report_title', 'Relatório de testes')}</span>
              <button onClick={() => reportFrame.current?.contentWindow?.print()} className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"><Printer className="w-4 h-4" /> {report.mode === 'pdf' ? t('ide_tests.print_pdf', 'Imprimir / Salvar PDF') : t('ide_tests.print', 'Imprimir')}</button>
              <button onClick={downloadReport} className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"><Download className="w-4 h-4" /> {t('ide_tests.download_html', 'Baixar HTML')}</button>
              <button onClick={() => setReport(null)} className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"><X className="w-4 h-4" /></button>
            </div>
            <iframe ref={reportFrame} title={t('ide_tests.report_title', 'Relatório de testes')} srcDoc={report.html} sandbox="allow-scripts allow-modals allow-same-origin" className="flex-1 w-full bg-white" />
          </div>
        </div>
      )}

      {compare && <IdeTestCompareModal runs={compare} onClose={() => setCompare(null)} />}
    </div>
  )
}
