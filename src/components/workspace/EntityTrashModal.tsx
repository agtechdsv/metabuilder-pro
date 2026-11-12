'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Layers, Building2, Loader2, RotateCcw, Search, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import { DEFAULT_TRASH_HOURS, getTrashRetentionHours, trashRemainingMs } from '@/lib/trash/trash'
import {
  deleteEntityTrashForever, entityTrashErrorCode, listEntityTrash, restoreEntityFromTrash,
  type EntityRestoreResult, type EntityTrashItem, type EntityType,
} from '@/lib/trash/entityTrash'
import { formatDuration, formatSpan } from '@/lib/trash/format'

const E = 'workspace_components.entity_trash.'
const S = 'dashboard.projects.studio.trash.' // textos comuns (restaurar, excluir de vez, prazo...) da lixeira de casos de uso

interface Props {
  isOpen: boolean
  onClose: () => void
  type: EntityType
  /** projetos: o workspace de onde saem; workspaces: não precisa */
  workspaceId?: string
  /** depois de restaurar: a tela recarrega a lista */
  onRestored: (result: EntityRestoreResult) => void
}

/** Lixeira de projetos (de um workspace) ou de workspaces: lista o que ainda está no prazo, com busca, restaurar e excluir de vez. */
export function EntityTrashModal({ isOpen, onClose, type, workspaceId, onRestored }: Props) {
  const { t } = useI18n()
  const { toast } = useToast()
  const supabase = React.useMemo(() => createClient(), [])
  const [hours, setHours] = useState(DEFAULT_TRASH_HOURS)
  const [items, setItems] = useState<EntityTrashItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [foreverId, setForeverId] = useState<string | null>(null)
  const [restoreId, setRestoreId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const h = await getTrashRetentionHours(supabase)
      setHours(h)
      setItems(await listEntityTrash(supabase, type, type === 'project' ? workspaceId ?? null : null, h))
    } catch (e: any) {
      toast(t(E + 'err_generic') + (e?.message || ''), 'error')
    } finally { setLoading(false) }
  }, [supabase, type, workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOpen) { setForeverId(null); setRestoreId(null); setQuery(''); load() }
  }, [isOpen, load])
  // o "quanto falta" anda sozinho; o que vence com a janela aberta some da lista
  useEffect(() => {
    if (!isOpen) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [isOpen])

  const visible = items.filter(i => trashRemainingMs(i.deleted_at, hours, now) > 0)
  const q = query.trim().toLowerCase()
  const filtered = visible.filter(i => !q || i.name.toLowerCase().includes(q) || i.slug.toLowerCase().includes(q))
  const Icon = type === 'project' ? Layers : Building2

  const reasonFor = (e: any, item: EntityTrashItem): string => {
    const code = entityTrashErrorCode(e)
    return code === 'slug_in_use' ? t(E + (type === 'project' ? 'err_slug_project' : 'err_slug_workspace')).replace('{slug}', item.slug)
      : code === 'delete_not_allowed' ? t(E + 'err_denied')
      : code === 'plan_limit' ? t(E + 'err_plan')
      : code === 'workspace_missing' ? t(E + 'err_workspace_missing')
      : code === 'owner_missing' ? t(E + 'err_owner_missing')
      : code === 'already_exists' ? t(E + 'err_exists')
      : code === 'trash_expired' || code === 'trash_not_found' ? t(E + 'err_expired')
      : t(E + 'err_generic') + (e?.message || '')
  }

  const restore = async (item: EntityTrashItem) => {
    setBusyId(item.id)
    setRestoreId(null)
    try {
      const res = await restoreEntityFromTrash(supabase, item.id)
      toast(
        type === 'project'
          ? t(E + 'restored_project').replace('{name}', res.name)
          : t(E + 'restored_workspace').replace('{name}', res.name).replace('{n}', String(res.projects)),
        'success'
      )
      onRestored(res)
      await load()
    } catch (e: any) {
      toast(reasonFor(e, item), 'error')
      const code = entityTrashErrorCode(e)
      if (code === 'trash_expired' || code === 'trash_not_found' || code === 'already_exists') await load()
    } finally { setBusyId(null) }
  }

  const forever = async (item: EntityTrashItem) => {
    setBusyId(item.id)
    try {
      await deleteEntityTrashForever(supabase, item.id)
      setForeverId(null)
      toast(t(S + 'forever_done'), 'success')
      await load()
    } catch (e: any) {
      toast(reasonFor(e, item), 'error')
    } finally { setBusyId(null) }
  }

  const busyAny = busyId !== null
  const cancel = t('dashboard.projects.studio.delete_confirm.cancel')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t(E + (type === 'project' ? 'title_project' : 'title_workspace'))} size="2xl">
      <div className="space-y-4">
        <p className="text-xs text-neutral-500">{t(E + (type === 'project' ? 'subtitle_project' : 'subtitle_workspace')).replace('{duration}', formatDuration(hours, t))}</p>

        {loading && visible.length === 0 ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" /></div>
        ) : visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-400 dark:border-neutral-800">{t(E + 'empty')}</p>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t(E + 'search_ph')}
                className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-3 text-xs font-medium outline-none focus:border-indigo-500 dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>

            {filtered.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-neutral-200 py-8 text-center text-sm text-neutral-400 dark:border-neutral-800">{t(E + 'no_match')}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filtered.map(item => {
                  const busy = busyId === item.id
                  return (
                    <li key={item.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
                      <div className="min-w-0">
                        <div className="flex items-start gap-2">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                          <p className="truncate text-sm font-bold text-neutral-900 dark:text-white" title={item.name}>{item.name}</p>
                        </div>
                        <p className="truncate font-mono text-[10px] text-neutral-400">/{item.slug}</p>
                        {type === 'workspace' && <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-indigo-500">{t(E + 'projects_count').replace('{n}', String(item.project_count))}</p>}
                        <p className="mt-2 text-[11px] text-neutral-500">{t(S + 'deleted_on').replace('{date}', new Date(item.deleted_at).toLocaleString())}</p>
                        <p className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-600 dark:bg-amber-950/30">{t(S + 'remaining').replace('{time}', formatSpan(trashRemainingMs(item.deleted_at, hours, now), t))}</p>
                      </div>
                      {foreverId === item.id ? (
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={busy} onClick={() => forever(item)} className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-[11px] font-black text-white hover:bg-red-500 disabled:opacity-50">{t(S + 'forever_yes')}</button>
                          <button type="button" disabled={busy} onClick={() => setForeverId(null)} className="flex-1 rounded-xl bg-neutral-100 px-3 py-2 text-[11px] font-black text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200">{cancel}</button>
                        </div>
                      ) : restoreId === item.id ? (
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={busy} onClick={() => restore(item)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-black text-white hover:bg-indigo-500 disabled:opacity-50">
                            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{busy ? t(S + 'restoring') : t(S + 'restore_yes')}
                          </button>
                          <button type="button" disabled={busy} onClick={() => setRestoreId(null)} className="flex-1 rounded-xl bg-neutral-100 px-3 py-2 text-[11px] font-black text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200">{cancel}</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={busyAny} onClick={() => { setForeverId(null); setRestoreId(item.id) }} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-black text-white hover:bg-indigo-500 disabled:opacity-50">
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            {busy ? t(S + 'restoring') : t(S + 'restore')}
                          </button>
                          <button type="button" disabled={busyAny} onClick={() => { setRestoreId(null); setForeverId(item.id) }} title={t(S + 'delete_forever')} aria-label={t(S + 'delete_forever')} className="rounded-xl p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30">
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
          <button type="button" onClick={onClose} className="rounded-xl bg-neutral-100 px-4 py-2 text-xs font-black text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200">{t(S + 'close')}</button>
        </div>
      </div>
    </Modal>
  )
}
