'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, FlaskConical, Play, Square, Loader2, CheckCircle2, XCircle, MinusCircle, Circle, FolderOpen, Eye, EyeOff, ShieldAlert, FileText, RefreshCw,
} from 'lucide-react'
import { useI18n } from '@/i18n'
import { createClient } from '@/utils/supabase/client'
import { isTauri } from '@/utils/tauriUtils'
import { pickFolder } from '@/utils/exportToFolder'
import { checkRunnerDir, openTestReport, startTestRun, type TestRunHandle } from '@/utils/testRunner'
import { describeName, isSupportedView, planView } from '@/lib/testing/plan'
import type { TestManifest, ManifestView } from '@/lib/testing/manifestTypes'
import type { TestEvent, TestStatus } from '@/lib/testing/results'

interface Props {
  isOpen: boolean
  onClose: () => void
  target: { type: 'project' | 'workspace'; id: string; name: string; slug: string } | null
}

interface Result { status: TestStatus; ms?: number; error?: string }
const keyOf = (group: string, title: string) => `${group}||${title}`

/** Tipos de teste: só o primeiro existe hoje; os demais mostram o caminho que vem. */
const TEST_TYPES = [
  { id: 'funcional', label: 'Funcional · Pesquisa + Cadastro', desc: 'Lista, filtros, formulário, obrigatórios e máscaras de cada caso de uso', available: true },
  { id: 'integracao', label: 'Integração', desc: 'Cadastro completo gravando no banco de teste', available: false },
  { id: 'seguranca', label: 'Segurança', desc: 'Permissões, regras por linha e entradas maliciosas', available: false },
  { id: 'visual', label: 'Responsividade e acessibilidade', desc: 'Tamanhos de tela, contraste e leitor de tela', available: false },
  { id: 'compat', label: 'Compatibilidade', desc: 'Chrome, Firefox e Safari', available: false },
  { id: 'carga', label: 'Desempenho e carga', desc: 'Muitos acessos ao mesmo tempo', available: false },
]

const lsGet = (k: string) => { try { return localStorage.getItem(k) || '' } catch { return '' } }
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sem armazenamento */ } }

function StatusIcon({ s }: { s: TestStatus }) {
  if (s === 'passed') return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
  if (s === 'failed') return <XCircle className="w-4 h-4 text-red-400 shrink-0" />
  if (s === 'running') return <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
  if (s === 'skipped') return <MinusCircle className="w-4 h-4 text-neutral-500 shrink-0" />
  return <Circle className="w-4 h-4 text-neutral-600 shrink-0" />
}

/**
 * Ambiente de Testes (IDE Local): o dev escolhe o tipo de teste e os casos de uso, vê o plano gerado a partir do que ele configurou no Studio e
 * roda, acompanhando ao vivo (navegador na tela) ou em segundo plano. Os testes não são escritos por caso de uso: nascem do manifesto do projeto.
 */
export function IdeTestModal({ isOpen, onClose, target }: Props) {
  const { t } = useI18n()
  const [manifest, setManifest] = useState<TestManifest | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [runnerDir, setRunnerDir] = useState('')
  const [appDir, setAppDir] = useState('')
  const [live, setLive] = useState(true)
  const [slow, setSlow] = useState(300)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Record<string, Result>>({})
  const [summary, setSummary] = useState<{ total: number; passed: number; failed: number; skipped: number } | null>(null)
  const [runError, setRunError] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const handle = useRef<TestRunHandle | null>(null)

  const projectId = target?.id || ''

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
      setSelected(Object.fromEntries(m.views.map(v => [v.slug, isSupportedView(v)])))
    } catch (e: any) {
      setLoadError(e?.message || 'Não foi possível gerar o plano.')
    } finally {
      setLoading(false)
    }
  }, [target])

  useEffect(() => { if (isOpen && !manifest) loadManifest() }, [isOpen, manifest, loadManifest])
  useEffect(() => { if (!isOpen) { setManifest(null); setResults({}); setSummary(null); setRunError('') } }, [isOpen])

  const views = manifest?.views ?? []
  const chosen = useMemo(() => views.filter(v => selected[v.slug] && isSupportedView(v)), [views, selected])
  const plannedCount = useMemo(() => chosen.reduce((n, v) => n + planView(v).length, 0), [chosen])

  const pick = async (kind: 'runner' | 'app') => {
    const dir = await pickFolder()
    if (!dir) return
    if (kind === 'runner') { setRunnerDir(dir); lsSet('mb_tests_runner_dir', dir) } else { setAppDir(dir); lsSet(`mb_tests_app_dir_${projectId}`, dir) }
  }

  const onEvent = useCallback((ev: TestEvent) => {
    if (ev.t === 'done') { setSummary({ total: ev.total ?? 0, passed: ev.passed ?? 0, failed: ev.failed ?? 0, skipped: ev.skipped ?? 0 }); return }
    if (!ev.group || !ev.title) return
    const k = keyOf(ev.group, ev.title)
    setResults(r => ({ ...r, [k]: ev.t === 'begin' ? { status: 'running' } : { status: ev.status || 'failed', ms: ev.ms, error: ev.error } }))
  }, [])

  const run = async () => {
    if (!manifest || !isTauri()) return
    setRunError(''); setSummary(null); setResults({}); setLogs([])
    if (!runnerDir) { setRunError('Escolha a pasta do motor de testes (a pasta e2e).'); return }
    if (!appDir) { setRunError('Escolha a pasta do app exportado que será testado.'); return }
    const chk = await checkRunnerDir(runnerDir)
    if (!chk.ok) { setRunError(`A pasta do motor de testes está incompleta (falta: ${chk.missing.join(', ')}). Escolha a pasta e2e do projeto e rode npm install nela.`); return }
    setRunning(true)
    try {
      handle.current = await startTestRun({
        runnerDir, appDir, manifest, viewSlugs: chosen.map(v => v.slug), live, slowMoMs: slow,
        onEvent, onLog: l => setLogs(x => [...x.slice(-199), l]),
        onClose: code => { setRunning(false); handle.current = null; if (code !== 0 && code !== 1 && code !== null) setRunError(`O motor terminou com erro (código ${code}). Veja o log abaixo.`) },
      })
    } catch (e: any) {
      setRunning(false); setRunError(e?.message || 'Não foi possível iniciar os testes.')
    }
  }

  const stop = async () => { await handle.current?.stop(); setRunning(false) }

  if (!isOpen || !target) return null
  const desktop = isTauri()

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

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Segurança */}
          <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{t('ide_tests.safety', 'Os testes rodam em um banco de teste. Hoje o motor só aceita banco local da lista permitida e confere, no fim, que nenhuma linha real foi alterada. Rodar no banco original só com o seu consentimento (em breve).')}</p>
          </div>

          {/* 1. Tipo de teste */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">1 · {t('ide_tests.type', 'Tipo de teste')}</h3>
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
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">2 · {t('ide_tests.scope', 'Casos de uso')}</h3>
              <button onClick={loadManifest} disabled={loading || running} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('ide_tests.reload', 'Atualizar plano')}
              </button>
            </div>
            {loading && <p className="text-sm text-neutral-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {t('ide_tests.loading', 'Gerando o plano a partir do projeto...')}</p>}
            {loadError && <p className="text-sm text-red-400">{loadError}</p>}
            {target.type !== 'project' && <p className="text-sm text-neutral-400">{t('ide_tests.only_project', 'Por enquanto os testes rodam por projeto. Abra um projeto na IDE.')}</p>}
            <div className="space-y-2">
              {views.map((v: ManifestView) => {
                const ok = isSupportedView(v)
                const plan = planView(v)
                return (
                  <div key={v.slug} className={`rounded-xl border ${ok ? 'border-neutral-700 bg-neutral-800/40' : 'border-neutral-800 bg-neutral-900/40 opacity-60'}`}>
                    <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer">
                      <input type="checkbox" disabled={!ok || running} checked={!!selected[v.slug] && ok} onChange={e => setSelected(s => ({ ...s, [v.slug]: e.target.checked }))} className="accent-indigo-500" />
                      <span className="text-sm font-semibold text-white">{v.title}</span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">{v.logicType}</span>
                      <span className="ml-auto text-xs text-neutral-400">{ok ? `${plan.length} ${t('ide_tests.tests', 'testes')}` : t('ide_tests.no_template', 'ainda sem teste automático')}</span>
                    </label>
                    {ok && selected[v.slug] && (
                      <ul className="px-4 pb-3 space-y-1">
                        {plan.map(p => {
                          const r = results[keyOf(describeName(v), p.title)]
                          return (
                            <li key={p.title} className="text-xs">
                              <div className="flex items-start gap-2">
                                <StatusIcon s={r?.status ?? 'pending'} />
                                <span className={r?.status === 'failed' ? 'text-red-300' : 'text-neutral-300'}>{p.title}</span>
                                {r?.ms != null && <span className="ml-auto text-neutral-500 tabular-nums">{(r.ms / 1000).toFixed(1)}s</span>}
                              </div>
                              {r?.error && <pre className="mt-1 ml-6 whitespace-pre-wrap text-[11px] text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{r.error}</pre>}
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
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">3 · {t('ide_tests.where', 'Onde rodar')}</h3>
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
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">4 · {t('ide_tests.mode', 'Como acompanhar')}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setLive(true)} disabled={running} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${live ? 'border-indigo-500/50 bg-indigo-500/10 text-white' : 'border-neutral-700 text-neutral-400'}`}><Eye className="w-4 h-4" /> {t('ide_tests.live', 'Ver ao vivo (abre o navegador)')}</button>
              <button onClick={() => setLive(false)} disabled={running} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${!live ? 'border-indigo-500/50 bg-indigo-500/10 text-white' : 'border-neutral-700 text-neutral-400'}`}><EyeOff className="w-4 h-4" /> {t('ide_tests.background', 'Em segundo plano (mais rápido)')}</button>
              {live && (
                <select value={slow} onChange={e => setSlow(Number(e.target.value))} disabled={running} className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-xs text-neutral-200">
                  <option value={0}>{t('ide_tests.speed_fast', 'Rápido')}</option>
                  <option value={300}>{t('ide_tests.speed_normal', 'Normal')}</option>
                  <option value={800}>{t('ide_tests.speed_slow', 'Devagar (para acompanhar)')}</option>
                </select>
              )}
            </div>
          </section>

          {runError && <p className="text-sm text-red-400 whitespace-pre-wrap">{runError}</p>}
          {logs.length > 0 && (
            <details className="text-xs text-neutral-400">
              <summary className="cursor-pointer">{t('ide_tests.log', 'Log do motor')} ({logs.length})</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-[11px]">{logs.join('\n')}</pre>
            </details>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-neutral-800">
          <div className="flex-1 text-xs text-neutral-400">
            {summary
              ? <span><b className="text-emerald-400">{summary.passed}</b> {t('ide_tests.passed', 'passaram')} · <b className="text-red-400">{summary.failed}</b> {t('ide_tests.failed', 'falharam')}{summary.skipped ? <> · {summary.skipped} {t('ide_tests.skipped', 'ignorados')}</> : null}</span>
              : <span>{chosen.length} {t('ide_tests.views_selected', 'caso(s) de uso')} · {plannedCount} {t('ide_tests.tests', 'testes')}</span>}
          </div>
          {summary && <button onClick={() => openTestReport(runnerDir)} className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800"><FileText className="w-4 h-4" /> {t('ide_tests.report', 'Abrir relatório')}</button>}
          {running
            ? <button onClick={stop} className="flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2 text-sm font-bold text-white"><Square className="w-4 h-4" /> {t('ide_tests.stop', 'Parar')}</button>
            : <button onClick={run} disabled={!desktop || plannedCount === 0 || loading} className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-2 text-sm font-bold text-white"><Play className="w-4 h-4" /> {t('ide_tests.run', 'Executar testes')}</button>}
        </div>
      </div>
    </div>
  )
}
