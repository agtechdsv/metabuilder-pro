'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, RotateCcw, Search, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import { deleteTrashForever, listTrash, restoreUseCaseFromTrash, trashErrorCode, trashRemainingMs, type TrashItem } from '@/lib/trash/trash'
import { formatDuration, formatSpan } from '@/lib/trash/format'

const P = 'dashboard.projects.studio.trash.'

interface Props {
  isOpen: boolean
  onClose: () => void
  projectId: string
  /** prazo da lixeira em horas (configurado pelo SuperAdmin) */
  hours: number
  /** depois de restaurar: a tela atualiza a lista de casos de uso */
  onRestored: () => void
}

/** Lixeira do projeto: casos de uso excluídos que ainda estão no prazo, com filtro, restaurar e excluir de vez (um, os selecionados ou todos). */
export function TrashModal({ isOpen, onClose, projectId, hours, onRestored }: Props) {
  const { t } = useI18n()
  const { toast } = useToast()
  const supabase = React.useMemo(() => createClient(), [])
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [query, setQuery] = useState('')
  const [logic, setLogic] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkConfirm, setBulkConfirm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await listTrash(supabase, projectId, hours)) }
    catch (e: any) { toast(t(P + 'err_generic') + (e?.message || ''), 'error') }
    finally { setLoading(false) }
  }, [supabase, projectId, hours]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOpen) { setConfirmId(null); setBulkConfirm(false); setSelected(new Set()); setQuery(''); setLogic(''); load() }
  }, [isOpen, load])
  // o "quanto falta" anda sozinho; o que vence enquanto a janela está aberta some da lista
  useEffect(() => {
    if (!isOpen) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [isOpen])

  const visible = items.filter(i => trashRemainingMs(i.deleted_at, hours, now) > 0)
  const logicLabel = (l: string | null) => (l ? t(`wizard.logic.types.${l}.title`, l.replace('_', ' + ')) : '')
  const logics = useMemo(() => Array.from(new Set(visible.map(i => i.logic_type).filter(Boolean) as string[])), [visible]) // eslint-disable-line react-hooks/exhaustive-deps
  const q = query.trim().toLowerCase()
  const filtered = visible.filter(i => (!logic || i.logic_type === logic) && (!q || i.name.toLowerCase().includes(q) || i.slug.toLowerCase().includes(q)))
  const selectedInView = filtered.filter(i => selected.has(i.id))
  // com algo marcado, os botões em massa valem para o marcado; sem nada marcado, valem para tudo o que o filtro mostra
  const hasSelection = selectedInView.length > 0
  const scope = hasSelection ? selectedInView : filtered
  const allSelected = filtered.length > 0 && selectedInView.length === filtered.length

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map(i => i.id)))

  const restore = async (item: TrashItem) => {
    setBusyId(item.id)
    try {
      const res = await restoreUseCaseFromTrash(supabase, item.id, projectId)
      const missing = res.components_total - res.components_restored
      toast(
        missing > 0
          ? t(P + 'restored_partial').replace('{name}', res.name).replace('{missing}', String(missing)).replace('{total}', String(res.components_total))
          : t(P + 'restored').replace('{name}', res.name),
        'success'
      )
      if (res.model_missing) toast(t(P + 'model_missing'), 'info')
      onRestored()
      await load()
    } catch (e: any) {
      const code = trashErrorCode(e)
      toast(
        code === 'slug_in_use' ? t(P + 'err_slug').replace('{slug}', item.slug)
          : code === 'trash_expired' ? t(P + 'err_expired')
          : code === 'limit' ? t(P + 'err_limit')
          : t(P + 'err_generic') + (e?.message || ''),
        'error'
      )
      if (code === 'trash_expired') await load()
    } finally { setBusyId(null) }
  }

  const forever = async (item: TrashItem) => {
    setBusyId(item.id)
    try {
      await deleteTrashForever(supabase, item.id)
      setConfirmId(null)
      toast(t(P + 'forever_done'), 'success')
      await load()
    } catch (e: any) {
      toast(t(P + 'err_generic') + (e?.message || ''), 'error')
    } finally { setBusyId(null) }
  }

  // em massa: um por vez (cada restauração é uma transação própria); o resumo diz quantos deram certo e por que os outros não
  const restoreMany = async () => {
    const list = [...scope]
    setBulkBusy(true)
    let ok = 0
    const failed: { item: TrashItem; code: string; msg: string }[] = []
    for (const item of list) {
      try { await restoreUseCaseFromTrash(supabase, item.id, projectId); ok++ }
      catch (e: any) {
        const code = trashErrorCode(e)
        failed.push({ item, code, msg: String(e?.message || '') })
        if (code === 'limit') break // o plano não comporta mais: tentar os próximos só repete o erro
      }
    }
    setSelected(new Set())
    if (ok > 0) onRestored()
    await load()
    setBulkBusy(false)
    if (failed.length === 0) { toast(t(P + 'bulk_restored').replace('{n}', String(ok)), 'success'); return }
    const first = failed[0]
    const reason = first.code === 'slug_in_use' ? t(P + 'err_slug').replace('{slug}', first.item.slug)
      : first.code === 'limit' ? t(P + 'err_limit')
      : first.code === 'trash_expired' ? t(P + 'err_expired')
      : t(P + 'err_generic') + first.msg
    toast(t(P + 'bulk_restored_partial').replace('{ok}', String(ok)).replace('{failed}', String(failed.length)) + ' ' + reason, ok > 0 ? 'info' : 'error')
  }

  const deleteMany = async () => {
    const list = [...scope]
    setBulkBusy(true)
    let ok = 0
    for (const item of list) {
      try { await deleteTrashForever(supabase, item.id); ok++ } catch { /* segue; o resumo mostra quantos saíram */ }
    }
    setBulkConfirm(false)
    setSelected(new Set())
    await load()
    setBulkBusy(false)
    toast(ok === list.length ? t(P + 'bulk_deleted').replace('{n}', String(ok)) : t(P + 'bulk_deleted_partial').replace('{ok}', String(ok)).replace('{total}', String(list.length)), ok > 0 ? 'success' : 'error')
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleString()
  const busyAny = bulkBusy || busyId !== null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t(P + 'title')} size="2xl">
      <div className="space-y-4" data-help-id="studio.trash_modal">
        <p className="text-xs text-neutral-500">{t(P + 'subtitle').replace('{duration}', formatDuration(hours, t))}</p>

        {loading && visible.length === 0 ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" /></div>
        ) : visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-400 dark:border-neutral-800">{t(P + 'empty')}</p>
        ) : (
          <>
            {/* busca, filtro e ações em massa ficam fixos no alto enquanto a lista rola */}
            <div className="sticky top-0 z-10 -mx-8 space-y-3 border-b border-neutral-100 bg-white px-8 pb-3 pt-1 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t(P + 'search_ph')}
                  className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-3 text-xs font-medium outline-none focus:border-indigo-500 dark:border-neutral-800 dark:bg-neutral-950"
                />
              </div>
              {logics.length > 1 && (
                <select value={logic} onChange={e => setLogic(e.target.value)} className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 dark:border-neutral-800 dark:bg-neutral-950">
                  <option value="">{t(P + 'all_logics')}</option>
                  {logics.map(l => <option key={l} value={l}>{logicLabel(l)}</option>)}
                </select>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-neutral-600 dark:text-neutral-300">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={filtered.length === 0 || busyAny} className="h-3.5 w-3.5 accent-indigo-600" />
                {hasSelection ? t(P + 'selected_count').replace('{n}', String(selectedInView.length)) : t(P + 'select_all')}
              </label>
              {bulkConfirm ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-red-600">{t(P + 'bulk_confirm').replace('{n}', String(scope.length))}</span>
                  <button type="button" disabled={bulkBusy} onClick={deleteMany} className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-[11px] font-black text-white hover:bg-red-500 disabled:opacity-50">
                    {bulkBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t(P + 'forever_yes')}
                  </button>
                  <button type="button" disabled={bulkBusy} onClick={() => setBulkConfirm(false)} className="rounded-xl bg-neutral-100 px-3 py-2 text-[11px] font-black text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200">{t('dashboard.projects.studio.delete_confirm.cancel')}</button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={busyAny || scope.length === 0} onClick={restoreMany} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-black text-white hover:bg-indigo-500 disabled:opacity-50">
                    {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    {(hasSelection ? t(P + 'restore_selected') : t(P + 'restore_all')).replace('{n}', String(scope.length))}
                  </button>
                  <button type="button" disabled={busyAny || scope.length === 0} onClick={() => setBulkConfirm(true)} className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-[11px] font-black text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:hover:bg-red-950/30">
                    <Trash2 className="h-3.5 w-3.5" />
                    {(hasSelection ? t(P + 'delete_selected') : t(P + 'delete_all')).replace('{n}', String(scope.length))}
                  </button>
                </div>
              )}
            </div>

            </div>

            {filtered.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-neutral-200 py-8 text-center text-sm text-neutral-400 dark:border-neutral-800">{t(P + 'no_match')}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map(item => {
                  const busy = busyId === item.id
                  const isSel = selected.has(item.id)
                  return (
                    <li
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSel}
                      onClick={() => { if (!busyAny) toggle(item.id) }}
                      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && !busyAny) { e.preventDefault(); toggle(item.id) } }}
                      className={`flex cursor-pointer select-none flex-col justify-between gap-3 rounded-2xl border p-4 shadow-sm outline-none transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-500 ${isSel ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500/40 dark:bg-indigo-950/30' : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/40'}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-bold text-neutral-900 dark:text-white" title={item.name}>{item.name}</p>
                          {isSel && <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white"><Check className="h-3 w-3" /></span>}
                        </div>
                        <p className="truncate font-mono text-[10px] text-neutral-400">/{item.slug}</p>
                        {item.logic_type && <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wider text-indigo-500">{logicLabel(item.logic_type)}</p>}
                        <p className="mt-2 text-[11px] text-neutral-500">{t(P + 'deleted_on').replace('{date}', fmtDate(item.deleted_at))}</p>
                        <p className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-600 dark:bg-amber-950/30">{t(P + 'remaining').replace('{time}', formatSpan(trashRemainingMs(item.deleted_at, hours, now), t))}</p>
                      </div>
                      {confirmId === item.id ? (
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={busy} onClick={e => { e.stopPropagation(); forever(item) }} className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-[11px] font-black text-white hover:bg-red-500 disabled:opacity-50">{t(P + 'forever_yes')}</button>
                          <button type="button" disabled={busy} onClick={e => { e.stopPropagation(); setConfirmId(null) }} className="flex-1 rounded-xl bg-neutral-100 px-3 py-2 text-[11px] font-black text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200">{t('dashboard.projects.studio.delete_confirm.cancel')}</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={busyAny} onClick={e => { e.stopPropagation(); restore(item) }} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-black text-white hover:bg-indigo-500 disabled:opacity-50">
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            {busy ? t(P + 'restoring') : t(P + 'restore')}
                          </button>
                          <button type="button" disabled={busyAny} onClick={e => { e.stopPropagation(); setConfirmId(item.id) }} title={t(P + 'delete_forever')} aria-label={t(P + 'delete_forever')} className="rounded-xl p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}

        <div className="flex justify-end pt-1">
          <button type="button" onClick={onClose} className="rounded-xl bg-neutral-100 px-4 py-2 text-xs font-black text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200">{t(P + 'close')}</button>
        </div>
      </div>
    </Modal>
  )
}
