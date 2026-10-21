'use client'

import React, { useEffect, useState } from 'react'
import { Package, X, Loader2, CheckCircle2, AlertTriangle, FolderOpen } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { DEFAULT_DELIVERY, type DeliveryFormat, type DeliveryOptions } from '@/utils/delivery'
import { folderKeyOf } from '@/utils/folderKey'
import { deliverFiles, folderHasApp, readFolderFiles, revealPath, syncFolderPath, type DeliveryLabels, type DeliveryResult } from '@/utils/deliveryIO'

interface Props {
  isOpen: boolean
  onClose: () => void
  target: { type: 'project' | 'workspace'; id: string; name: string; slug: string; folderKey?: string } | null
}

/**
 * Entrega: uma cópia limpa do projeto SINCRONIZADO (sem .git, ramos, .metabuilder, dependências nem segredos), em pasta ou ZIP. O código vem da pasta
 * do projeto, com as edições do dev. Diferente do Sincronizar, não deixa nenhum vínculo com o repositório.
 */
export function IdeDeliveryModal({ isOpen, onClose, target }: Props) {
  const { t } = useI18n()
  const [opts, setOpts] = useState<DeliveryOptions>(DEFAULT_DELIVERY)
  const [folder, setFolder] = useState<{ dir: string; hasApp: boolean } | null>(null)
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<DeliveryResult | null>(null)

  useEffect(() => {
    if (!isOpen || !target) return
    setPhase('idle'); setMessage(''); setResult(null)
    let alive = true
    syncFolderPath(folderKeyOf(target)).then(async dir => {
      const hasApp = await folderHasApp(dir)
      if (!alive) return
      setFolder({ dir, hasApp })
    }).catch(() => { if (alive) setFolder(null) })
    return () => { alive = false }
  }, [isOpen, target?.id, target?.slug, target?.folderKey])

  if (!isOpen || !target) return null

  const labels: DeliveryLabels = {
    cleanTitle: t('export_modal.clean_title', 'Limpar a pasta antes de exportar?'),
    cleanMessage: t('export_modal.clean_message', 'Vão ser apagados {count} arquivo(s) de: {dir}. {entries}. Ficam: {kept}.'),
    cleanOk: t('export_modal.clean_ok', 'Limpar e exportar'),
    cleanCancel: t('export_modal.clean_cancel', 'Cancelar'),
    cleanUnsafe: t('export_modal.clean_unsafe', 'Esta pasta não pode ser limpa.'),
    cleanNotApp: t('export_modal.clean_not_app', 'A pasta tem outros arquivos e não parece um app exportado.'),
    cleanFailed: t('export_modal.clean_failed', 'Não foi possível limpar a pasta. Nada foi exportado.'),
  }

  const setFormat = (format: DeliveryFormat) => setOpts(o => ({ ...o, format, cleanBefore: format === 'zip' ? false : o.cleanBefore }))
  const running = phase === 'running'

  const generate = async () => {
    if (!folder?.hasApp) return
    setPhase('running'); setMessage(t('delivery.reading', 'Lendo os arquivos da pasta do projeto...')); setResult(null)
    try {
      const files = await readFolderFiles(folder.dir)
      setMessage(t('delivery.writing', 'Gerando a entrega...'))
      const r = await deliverFiles(files, opts, { projectId: target.id, slug: target.slug, labels })
      if (!r) { setPhase('idle'); setMessage(''); return }
      setResult(r); setPhase('done'); setMessage('')
    } catch (e: any) {
      setPhase('error'); setMessage(e?.message || String(e))
    }
  }

  const radio = (active: boolean) => `flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${active ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-neutral-700 bg-neutral-800/40 hover:bg-neutral-800/70'} disabled:opacity-50`

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
            <label className="flex items-start gap-3 rounded-xl border border-neutral-700 bg-neutral-800/30 px-3 py-2.5 cursor-pointer">
              <input type="checkbox" checked={opts.includeSecrets} disabled={running} onChange={e => setOpts(o => ({ ...o, includeSecrets: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-amber-500" />
              <span className="text-xs">
                <span className="block font-bold text-white">{t('delivery.secrets', 'Levar também os segredos (.env.local e senhas do application.properties)')}</span>
                <span className="block mt-0.5 text-neutral-400">{t('delivery.secrets_hint', 'Desmarcado (recomendado): o .env.local fica de fora e vira um .env.example só com os nomes; no Java, senha e chaves viram variáveis de ambiente.')}</span>
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

          {phase === 'running' && <p className="flex items-center gap-2 text-xs text-neutral-300"><Loader2 className="w-4 h-4 animate-spin" />{message}</p>}
          {phase === 'error' && <p className="flex items-start gap-2 text-xs text-red-300"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{message}</p>}
          {phase === 'done' && result && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-100 space-y-1">
              <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="w-4 h-4" />{t('delivery.done', 'Entrega gerada.')} {result.count} {t('delivery.files', 'arquivo(s)')}</p>
              <p className="break-all text-emerald-200/80">{result.destination}</p>
              {result.sanitized.length > 0 && <p className="text-emerald-200/80">{t('delivery.sanitized', 'Segredos tratados em')}: {result.sanitized.join(', ')}</p>}
              <button onClick={() => revealPath(result.destination)} className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 px-2.5 py-1 text-[11px] font-semibold hover:bg-emerald-500/10"><FolderOpen className="w-3.5 h-3.5" />{t('delivery.reveal', 'Mostrar no Explorador')}</button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} disabled={running} className="px-4 py-2 text-sm font-semibold text-neutral-400 hover:text-white disabled:opacity-40">{phase === 'done' ? t('delivery.close', 'Fechar') : t('delivery.cancel', 'Cancelar')}</button>
          <button onClick={generate} disabled={running || !folder?.hasApp} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50">
            <Package className="w-4 h-4" />{t('delivery.generate', 'Gerar entrega')}
          </button>
        </div>
      </div>
    </div>
  )
}
