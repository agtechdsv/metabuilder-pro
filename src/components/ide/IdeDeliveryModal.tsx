'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Package, X, Loader2, CheckCircle2, AlertTriangle, FolderOpen, FileCode2, Container, Rocket } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { DEFAULT_DELIVERY, type DeliveryFormat, type DeliveryKind, type DeliveryOptions } from '@/utils/delivery'
import { folderKeyOf } from '@/utils/folderKey'
import { folderHasApp, folderHasDockerPack, readFolderFiles, revealPath, syncFolderPath } from '@/utils/deliveryIO'
import { deliverProject, type RunLabels, type RunResult } from '@/utils/deliveryRun'
import { kindLabel } from '@/utils/deliveryPackage'

interface Props {
  isOpen: boolean
  onClose: () => void
  target: { type: 'project' | 'workspace'; id: string; name: string; slug: string; folderKey?: string } | null
}

/**
 * Entrega: o dev escolhe COMO vai subir o app (código-fonte limpo, pacote Docker e/ou pacote compilado sem Docker), o formato (pasta ou ZIP) e o
 * destino. Tudo parte do projeto SINCRONIZADO (com as edições do dev), sem Git e sem segredos, e vai com o manual de subida.
 */
export function IdeDeliveryModal({ isOpen, onClose, target }: Props) {
  const { t } = useI18n()
  const [opts, setOpts] = useState<DeliveryOptions>(DEFAULT_DELIVERY)
  const [folder, setFolder] = useState<{ dir: string; hasApp: boolean; hasDocker: boolean } | null>(null)
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [step, setStep] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState('')
  const [result, setResult] = useState<RunResult | null>(null)
  const logRef = useRef<string[]>([])

  useEffect(() => {
    if (!isOpen || !target) return
    setPhase('idle'); setStep(''); setLog([]); setError(''); setResult(null); logRef.current = []
    let alive = true
    syncFolderPath(folderKeyOf(target)).then(async dir => {
      const [hasApp, hasDocker] = await Promise.all([folderHasApp(dir), folderHasDockerPack(dir)])
      if (!alive) return
      setFolder({ dir, hasApp, hasDocker })
      // sem o pacote de produção na pasta (projeto sincronizado antes dele existir), o Docker não é oferecido
      setOpts(o => ({ ...o, kinds: o.kinds.filter(k => k !== 'docker' || hasDocker) }))
    }).catch(() => { if (alive) setFolder(null) })
    return () => { alive = false }
  }, [isOpen, target?.id, target?.slug, target?.folderKey])

  if (!isOpen || !target) return null

  const running = phase === 'running'
  const toggleKind = (k: DeliveryKind) => setOpts(o => ({ ...o, kinds: o.kinds.includes(k) ? o.kinds.filter(x => x !== k) : [...o.kinds, k] }))
  const setFormat = (format: DeliveryFormat) => setOpts(o => ({ ...o, format, cleanBefore: format === 'zip' ? false : o.cleanBefore }))
  const onlyCompiled = opts.kinds.length > 0 && opts.kinds.every(k => k === 'compiled')

  const labels: RunLabels = {
    cleanTitle: t('export_modal.clean_title', 'Limpar a pasta antes de exportar?'),
    cleanMessage: t('export_modal.clean_message', 'Vão ser apagados {count} arquivo(s) de: {dir}. {entries}. Ficam: {kept}.'),
    cleanOk: t('export_modal.clean_ok', 'Limpar e exportar'),
    cleanCancel: t('export_modal.clean_cancel', 'Cancelar'),
    cleanUnsafe: t('export_modal.clean_unsafe', 'Esta pasta não pode ser limpa.'),
    cleanNotApp: t('export_modal.clean_not_app', 'A pasta tem outros arquivos e não parece um app exportado.'),
    cleanFailed: t('export_modal.clean_failed', 'Não foi possível limpar a pasta. Nada foi exportado.'),
    jdkTitle: t('delivery.jdk_title', 'Java 21 necessário'),
    jdkAsk: t('delivery.jdk_ask', 'Para compilar o backend Java a IDE precisa do JDK 21. Baixar agora o JDK 21 portátil (Eclipse Temurin, cerca de 190 MB, da internet)? Ele fica na pasta .metabuilder do seu usuário e não altera o sistema.'),
    jdkInstall: t('delivery.jdk_install', 'Baixar e continuar'),
    jdkCancel: t('delivery.jdk_cancel', 'Cancelar'),
    jdkFailed: t('delivery.jdk_failed', 'Sem o JDK 21 não dá para compilar o backend Java. Nada foi entregue.'),
    buildFailed: t('delivery.build_failed', 'A compilação falhou'),
    needSync: t('delivery.need_sync', 'A pasta do projeto ainda não tem os arquivos de subida (Dockerfile e compose de produção). Use Sincronizar de novo para recebê-los.'),
    noKind: t('delivery.no_kind', 'Escolha pelo menos um tipo de entrega.'),
  }
  const stepLabels = {
    reading: t('delivery.step_reading', 'Lendo os arquivos da pasta do projeto...'),
    writing: t('delivery.step_writing', 'Gerando os arquivos...'),
    preparing: t('delivery.step_preparing', 'Preparando uma cópia limpa para compilar...'),
    backend: t('delivery.step_backend', 'Compilando o backend (Java)...'),
    frontend: t('delivery.step_frontend', 'Instalando dependências e compilando o app (pode levar alguns minutos)...'),
    assembling: t('delivery.step_assembling', 'Montando a pasta do pacote...'),
    docs: t('delivery.step_docs', 'Gerando scripts de início e o manual...'),
    publishing: t('delivery.step_publishing', 'Gravando no destino...'),
  }

  const generate = async () => {
    if (!folder?.hasApp) return
    setPhase('running'); setError(''); setResult(null); setLog([]); logRef.current = []; setStep(stepLabels.reading)
    try {
      const files = await readFolderFiles(folder.dir)
      const r = await deliverProject(files, opts, {
        projectId: target.id, slug: target.slug, name: target.name, labels, stepLabels,
        onStep: setStep,
        onLog: line => { logRef.current = [...logRef.current.slice(-7), line.slice(0, 220)]; setLog(logRef.current) },
      })
      if (!r) { setPhase('idle'); setStep(''); return }
      setResult(r); setPhase('done'); setStep('')
    } catch (e: any) {
      setPhase('error'); setError(e?.message || String(e))
    }
  }

  const radio = (active: boolean) => `flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${active ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-neutral-700 bg-neutral-800/40 hover:bg-neutral-800/70'} disabled:opacity-50`
  const kinds: Array<{ id: DeliveryKind; icon: React.ReactNode; title: string; desc: string; disabled?: boolean; note?: string }> = [
    { id: 'source', icon: <FileCode2 className="w-4 h-4" />, title: t('delivery.kind_source', 'Código-fonte limpo'), desc: t('delivery.kind_source_desc', 'O app sem arquivos de trabalho, sem segredos e sem os arquivos de subida. Para continuar o desenvolvimento em outro lugar.') },
    { id: 'docker', icon: <Container className="w-4 h-4" />, title: t('delivery.kind_docker', 'Pacote Docker'), desc: t('delivery.kind_docker_desc', 'O projeto com Dockerfile, compose de produção com HTTPS, .env.example e o manual (DEPLOY.md). Para subir em servidor com Docker.'), disabled: !!folder && !folder.hasDocker, note: t('delivery.kind_docker_missing', 'A pasta do projeto ainda não tem os arquivos de subida. Use Sincronizar de novo.') },
    { id: 'compiled', icon: <Rocket className="w-4 h-4" />, title: t('delivery.kind_compiled', 'Pacote compilado (sem Docker)'), desc: t('delivery.kind_compiled_desc', 'O app já compilado, para servidor Windows ou Linux, com scripts de início e o manual (LEIA-ME.md). A IDE compila no seu computador: leva alguns minutos e usa a internet na primeira vez.') },
  ]

  return (
    <div className="fixed inset-0 z-[1000002] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-neutral-900 border border-neutral-700 shadow-2xl">
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400"><Package className="w-5 h-5" /></div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white">{t('delivery.title', 'Entrega')} <span className="text-neutral-500 font-normal">· {target.name}</span></h3>
            <p className="text-xs text-neutral-400 mt-0.5">{t('delivery.subtitle', 'Uma cópia limpa do app para entregar ou publicar: sem Git, sem ramos de sincronização e sem os segredos.')}</p>
          </div>
          <button onClick={onClose} disabled={running} className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-40"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <section>
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">{t('delivery.source', 'De onde vem o código')}</p>
            <div className="rounded-xl border border-neutral-700 bg-neutral-800/40 px-3 py-3">
              <span className="block text-sm font-semibold text-white">{t('delivery.source_folder', 'Da pasta do projeto (com as minhas edições)')}</span>
              <span className="block text-[11px] text-neutral-400 break-all">{folder?.hasApp ? folder.dir : t('delivery.source_folder_missing', 'A pasta do projeto ainda não tem o código. Use Sincronizar primeiro.')}</span>
              <span className="block text-[11px] text-neutral-500 mt-1">{t('delivery.source_now', 'Vale o que está na pasta agora, inclusive o que ainda não foi commitado.')}</span>
            </div>
          </section>

          <section>
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">{t('delivery.what', 'O que gerar (escolha um ou mais)')}</p>
            <div className="grid gap-2">
              {kinds.map(k => {
                const on = opts.kinds.includes(k.id)
                return (
                  <button key={k.id} type="button" disabled={running || k.disabled} onClick={() => toggleKind(k.id)} className={radio(on)}>
                    <span className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center ${on ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-neutral-500'}`}>{on && <CheckCircle2 className="w-3 h-3" />}</span>
                    <span className="flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold text-white"><span className="text-indigo-300">{k.icon}</span>{k.title}</span>
                      <span className="block text-[11px] text-neutral-400 mt-0.5">{k.desc}</span>
                      {k.disabled && <span className="block text-[11px] text-amber-700 [html:not(.light)_&]:text-amber-300 mt-1">{k.note}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">{t('delivery.format', 'Formato')}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={running} onClick={() => setFormat('folder')} className={radio(opts.format === 'folder')}>
                <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${opts.format === 'folder' ? 'border-indigo-400 bg-indigo-500' : 'border-neutral-500'}`} />
                <span className="text-sm font-semibold text-white">{t('delivery.format_folder', 'Pasta')}</span>
              </button>
              <button type="button" disabled={running} onClick={() => setFormat('zip')} className={radio(opts.format === 'zip')}>
                <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${opts.format === 'zip' ? 'border-indigo-400 bg-indigo-500' : 'border-neutral-500'}`} />
                <span className="text-sm font-semibold text-white">ZIP</span>
              </button>
            </div>
          </section>

          <section className="space-y-2">
            <label className={`flex items-start gap-3 rounded-xl border border-neutral-700 bg-neutral-800/30 px-3 py-2.5 ${onlyCompiled ? 'opacity-50' : 'cursor-pointer'}`}>
              <input type="checkbox" checked={opts.includeSecrets && !onlyCompiled} disabled={running || onlyCompiled} onChange={e => setOpts(o => ({ ...o, includeSecrets: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-amber-500" />
              <span className="text-xs">
                <span className="block font-bold text-white">{t('delivery.secrets', 'Levar também os segredos (.env.local e senhas do application.properties)')}</span>
                <span className="block mt-0.5 text-neutral-400">{onlyCompiled ? t('delivery.secrets_compiled', 'O pacote compilado nunca leva segredos: eles ficam no .env do servidor.') : t('delivery.secrets_hint', 'Desmarcado (recomendado): o .env.local fica de fora e vira um .env.example só com os nomes; no Java, senha e chaves viram variáveis de ambiente.')}</span>
              </span>
            </label>
            {opts.format === 'folder' && (
              <label className="flex items-start gap-3 rounded-xl border border-neutral-700 bg-neutral-800/30 px-3 py-2.5 cursor-pointer">
                <input type="checkbox" checked={opts.cleanBefore} disabled={running} onChange={e => setOpts(o => ({ ...o, cleanBefore: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-indigo-500" />
                <span className="text-xs">
                  <span className="block font-bold text-white">{t('export_modal.clean_before', 'Limpar a pasta antes de exportar (mantém node_modules)')}</span>
                  <span className="block mt-0.5 text-neutral-400">{t('export_modal.clean_before_hint', 'Apaga o que já está na pasta. Você confirma antes, vendo o que será apagado.')}</span>
                </span>
              </label>
            )}
          </section>

          {running && (
            <div className="rounded-xl border border-neutral-700 bg-neutral-800/40 px-3 py-3 space-y-2">
              <p className="flex items-center gap-2 text-xs font-semibold text-neutral-200"><Loader2 className="w-4 h-4 animate-spin shrink-0" />{step}</p>
              {log.length > 0 && <pre className="max-h-28 overflow-hidden rounded-lg bg-neutral-950 px-2 py-1.5 text-[10px] leading-snug text-neutral-400 whitespace-pre-wrap break-all">{log.join('\n')}</pre>}
            </div>
          )}
          {phase === 'error' && <p className="flex items-start gap-2 text-xs text-red-700 [html:not(.light)_&]:text-red-300"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span className="break-words">{error}</span></p>}
          {phase === 'done' && result && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-900 [html:not(.light)_&]:text-emerald-100 space-y-1.5">
              <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="w-4 h-4" />{t('delivery.done', 'Entrega gerada.')}</p>
              <ul className="space-y-0.5 text-emerald-900 [html:not(.light)_&]:text-emerald-200/90">
                {result.kinds.map(k => (
                  <li key={k.kind}>• {kindLabel(k.kind)}{k.folder ? ` → ${k.folder}/` : ''}{k.count !== null ? ` (${k.count} ${t('delivery.files', 'arquivo(s)')})` : ''}</li>
                ))}
              </ul>
              <p className="break-all text-emerald-900/80 [html:not(.light)_&]:text-emerald-200/80">{result.destination}</p>
              {result.sanitized.length > 0 && <p className="text-emerald-900/80 [html:not(.light)_&]:text-emerald-200/80">{t('delivery.sanitized', 'Segredos tratados em')}: {result.sanitized.join(', ')}</p>}
              <button onClick={() => revealPath(result.destination)} className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/40 [html:not(.light)_&]:border-emerald-400/40 px-2.5 py-1 text-[11px] font-semibold hover:bg-emerald-500/10"><FolderOpen className="w-3.5 h-3.5" />{t('delivery.reveal', 'Mostrar no Explorador')}</button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} disabled={running} className="px-4 py-2 text-sm font-semibold text-neutral-400 hover:text-white disabled:opacity-40">{phase === 'done' ? t('delivery.close', 'Fechar') : t('delivery.cancel', 'Cancelar')}</button>
          <button onClick={generate} disabled={running || !folder?.hasApp || opts.kinds.length === 0} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50">
            <Package className="w-4 h-4" />{t('delivery.generate', 'Gerar entrega')}
          </button>
        </div>
      </div>
    </div>
  )
}
