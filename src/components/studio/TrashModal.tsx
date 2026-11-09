'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, RotateCcw, Trash2 } from 'lucide-react'
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

/** Lixeira do projeto: casos de uso excluídos que ainda estão no prazo, com restaurar e excluir de vez. */
export function TrashModal({ isOpen, onClose, projectId, hours, onRestored }: Props) {
  const { t } = useI18n()
  const { toast } = useToast()
  const supabase = React.useMemo(() => createClient(), [])
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await listTrash(supabase, projectId, hours)) }
    catch (e: any) { toast(t(P + 'err_generic') + (e?.message || ''), 'error') }
    finally { setLoading(false) }
  }, [supabase, projectId, hours]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (isOpen) { setConfirmId(null); load() } }, [isOpen, load])
  // o "quanto falta" anda sozinho; o que vence enquanto a janela está aberta some da lista
  useEffect(() => {
    if (!isOpen) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [isOpen])

  const visible = items.filter(i => trashRemainingMs(i.deleted_at, hours, now) > 0)

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

  const fmtDate = (iso: string) => new Date(iso).toLocaleString()

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t(P + 'title')} size="2xl">
      <div className="space-y-4" data-help-id="studio.trash_modal">
        <p className="text-xs text-neutral-500">{t(P + 'subtitle').replace('{duration}', formatDuration(hours, t))}</p>

        {loading && visible.length === 0 ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" /></div>
        ) : visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-400 dark:border-neutral-800">{t(P + 'empty')}</p>
        ) : (
          <ul className="space-y-2">
            {visible.map(item => {
              const busy = busyId === item.id
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-neutral-900 dark:text-white">{item.name}</p>
                    <p className="truncate font-mono text-[10px] text-neutral-400">/{item.slug}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      {t(P + 'deleted_on').replace('{date}', fmtDate(item.deleted_at))} · <span className="font-bold text-amber-600">{t(P + 'remaining').replace('{time}', formatSpan(trashRemainingMs(item.deleted_at, hours, now), t))}</span>
                    </p>
                  </div>
                  {confirmId === item.id ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" disabled={busy} onClick={() => forever(item)} className="rounded-xl bg-red-600 px-3 py-2 text-[11px] font-black text-white hover:bg-red-500 disabled:opacity-50">{t(P + 'forever_yes')}</button>
                      <button type="button" disabled={busy} onClick={() => setConfirmId(null)} className="rounded-xl bg-neutral-100 px-3 py-2 text-[11px] font-black text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200">{t('dashboard.projects.studio.delete_confirm.cancel')}</button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" disabled={busy} onClick={() => restore(item)} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-black text-white hover:bg-indigo-500 disabled:opacity-50">
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        {busy ? t(P + 'restoring') : t(P + 'restore')}
                      </button>
                      <button type="button" disabled={busy} onClick={() => setConfirmId(item.id)} title={t(P + 'delete_forever')} aria-label={t(P + 'delete_forever')} className="rounded-xl p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex justify-end pt-1">
          <button type="button" onClick={onClose} className="rounded-xl bg-neutral-100 px-4 py-2 text-xs font-black text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200">{t(P + 'close')}</button>
        </div>
      </div>
    </Modal>
  )
}
