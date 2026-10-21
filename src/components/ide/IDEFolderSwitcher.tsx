'use client'

import React, { useEffect, useRef, useState } from 'react'
import { FolderTree, ChevronDown, Plus, Check, X, AlertTriangle, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { folderKeyOf } from '@/utils/folderKey'
import {
  baseFolderPath, detectFolderStack, folderOwner, listProjectFolders, otherStack, suggestFolderName, validateFolderName,
  type FolderNameError, type Pilha, type PilhaDaPasta, type ProjectFolderInfo,
} from '@/utils/projectFolders'

type Target = { id: string; slug: string; folderKey?: string }

const stackLabel = (t: (k: string, d: string) => string, s: PilhaDaPasta) =>
  s === 'node' ? t('ide_folder.stack_node', 'Node') : s === 'java' ? t('ide_folder.stack_java', 'Java') : s === 'vazia' ? t('ide_folder.stack_empty', 'vazia') : ''

const nomeDoErro = (t: (k: string, d: string) => string, e: FolderNameError) =>
  e === 'empty' ? t('ide_folder.err_empty', 'Digite um nome para a pasta.')
    : e === 'long' ? t('ide_folder.err_long', 'O nome pode ter no máximo 60 caracteres.')
      : e === 'reserved' ? t('ide_folder.err_reserved', 'Este nome é reservado pelo Windows. Escolha outro.')
        : t('ide_folder.err_chars', 'Use só letras, números, ponto, hífen e sublinhado (sem espaços nem barras), começando por letra ou número.')

// ───────────────────────────────────────────────────────────────────────────
// Nova pasta
// ───────────────────────────────────────────────────────────────────────────

/** Pede o nome de uma pasta nova (já com uma sugestão) e confere se pode usar. onConfirm recebe o nome escolhido (uma pasta nova ou uma que já é deste projeto). */
export function NewFolderDialog({ target, initialName, onCancel, onConfirm }: { target: Target; initialName: string; onCancel: () => void; onConfirm: (name: string, existing: boolean) => void }) {
  const { t } = useI18n()
  const [name, setName] = useState(initialName)
  const [base, setBase] = useState('')
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { baseFolderPath().then(setBase).catch(() => {}) }, [])

  const localError = validateFolderName(name)
  const confirm = async () => {
    if (localError || busy) return
    setBusy(true); setServerError('')
    try {
      const dono = await folderOwner(name.trim(), target.id, target.slug)
      if (dono === 'other') { setServerError(t('ide_folder.err_other', 'Já existe uma pasta com esse nome que não é deste projeto. Escolha outro nome.')); return }
      onConfirm(name.trim(), dono === 'this')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[1000003] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-700 shadow-2xl">
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400"><FolderTree className="w-5 h-5" /></div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white">{t('ide_folder.new_title', 'Nova pasta do projeto')}</h3>
            <p className="text-xs text-neutral-400 mt-0.5">{t('ide_folder.new_desc', 'Cada pasta tem o seu código, o seu histórico Git e o seu remoto. Use uma para cada pilha (Node e Java) ou para uma cópia de teste.')}</p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block text-xs font-semibold text-white">
            {t('ide_folder.name_label', 'Nome da pasta')}
            <input autoFocus value={name} onChange={e => { setName(e.target.value); setServerError('') }} onKeyDown={e => { if (e.key === 'Enter') confirm() }} maxLength={80}
              className="mt-1 w-full rounded-lg bg-neutral-950 border border-neutral-600 px-3 py-2 text-sm text-white font-mono" />
          </label>
          <p className="text-[11px] text-neutral-400 break-all">{t('ide_folder.path_label', 'Caminho')}: <span className="font-mono text-neutral-300">{base ? `${base}\\${name.trim() || '...'}` : '...'}</span></p>
          {(localError || serverError) && <p className="flex items-start gap-2 text-xs text-red-700 [html:not(.light)_&]:text-red-300"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{localError ? nomeDoErro(t, localError) : serverError}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 pb-5">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-neutral-400 hover:text-white">{t('ide_folder.cancel', 'Cancelar')}</button>
          <button onClick={confirm} disabled={!!localError || busy} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{t('ide_folder.create', 'Criar e abrir')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Seletor no cabeçalho
// ───────────────────────────────────────────────────────────────────────────

/** "Pasta: vendas-pg ▾": troca de pasta do projeto ou cria uma nova. `refreshKey` muda quando algo pode ter mudado (ex.: depois de sincronizar). */
export function IDEFolderSwitcher({ target, onSwitch, refreshKey }: { target: Target & { slug: string }; onSwitch: (name: string) => void; refreshKey?: unknown }) {
  const { t } = useI18n()
  const current = folderKeyOf(target)
  const [open, setOpen] = useState(false)
  const [folders, setFolders] = useState<ProjectFolderInfo[]>([])
  const [currentStack, setCurrentStack] = useState<PilhaDaPasta>('desconhecida')
  const [creating, setCreating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    listProjectFolders(target.id, target.slug).then(l => { if (alive) setFolders(l) })
    detectFolderStack(current).then(s => { if (alive) setCurrentStack(s) })
    return () => { alive = false }
  }, [target.id, target.slug, current, refreshKey, open])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const lista = folders.some(f => f.name === current) ? folders : [{ name: current, stack: currentStack }, ...folders]
  const sugestao = suggestFolderName(target.slug, otherStack(currentStack) as Pilha | null, lista.map(f => f.name))

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} title={t('ide_folder.switcher_title', 'Pasta do projeto: troque de pasta (por exemplo, uma para Node e outra para Java) ou crie uma nova')}
        className="flex items-center gap-1.5 h-8 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg border border-neutral-700 text-xs transition-colors">
        <FolderTree className="w-3.5 h-3.5" />
        <span className="font-mono max-w-[140px] truncate">{current}</span>
        {stackLabel(t, currentStack) && <span className="rounded bg-indigo-500/20 px-1.5 text-[10px] font-semibold text-indigo-300">{stackLabel(t, currentStack)}</span>}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-64 z-[100000] rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl overflow-hidden">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{t('ide_folder.switcher_label', 'Pastas deste projeto')}</p>
          {lista.map(f => (
            <button key={f.name} onClick={() => { setOpen(false); if (f.name !== current) onSwitch(f.name) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-neutral-200 hover:bg-neutral-800">
              <span className="w-3.5">{f.name === current && <Check className="w-3.5 h-3.5 text-indigo-400" />}</span>
              <span className="flex-1 font-mono truncate">{f.name}</span>
              {stackLabel(t, f.stack) && <span className="rounded bg-neutral-800 px-1.5 text-[10px] text-neutral-400">{stackLabel(t, f.stack)}</span>}
            </button>
          ))}
          <button onClick={() => { setOpen(false); setCreating(true) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left font-semibold text-indigo-300 hover:bg-neutral-800 border-t border-neutral-800">
            <Plus className="w-3.5 h-3.5" />{t('ide_folder.new_folder', 'Nova pasta…')}
          </button>
        </div>
      )}
      {creating && <NewFolderDialog target={target} initialName={sugestao} onCancel={() => setCreating(false)} onConfirm={name => { setCreating(false); onSwitch(name) }} />}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Aviso de pilha trocada
// ───────────────────────────────────────────────────────────────────────────

/** A pasta é de uma pilha e o dev vai sincronizar a outra: oferece uma pasta nova (principal), limpar esta ou cancelar. */
export function StackMismatchDialog({ current, wanted, suggestion, onOtherFolder, onClean, onCancel }: {
  current: Pilha; wanted: Pilha; suggestion: string; onOtherFolder: () => void; onClean: () => void; onCancel: () => void
}) {
  const { t } = useI18n()
  const nome = (s: Pilha) => (s === 'java' ? 'Java' : 'Node.js')
  return (
    <div className="fixed inset-0 z-[1000003] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-700 shadow-2xl">
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500"><AlertTriangle className="w-5 h-5" /></div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white">{t('ide_folder.mismatch_title', 'Esta pasta é de outra pilha')}</h3>
            <p className="text-xs text-neutral-400 mt-1">{t('ide_folder.mismatch_body', 'A pasta atual já tem um projeto {current}, e você escolheu sincronizar como {wanted}. Sincronizar aqui misturaria os dois projetos na mesma pasta.').replace('{current}', nome(current)).replace('{wanted}', nome(wanted))}</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-2">
          <button onClick={onOtherFolder} className="w-full text-left rounded-xl border border-indigo-500/60 bg-indigo-500/10 px-3 py-3 hover:bg-indigo-500/20">
            <span className="block text-sm font-bold text-white">{t('ide_folder.mismatch_other', 'Sincronizar em outra pasta (recomendado)')}</span>
            <span className="block text-[11px] text-neutral-400 mt-0.5">{t('ide_folder.mismatch_other_desc', 'Cria uma pasta nova ao lado da atual (sugestão: {name}). A atual continua como está.').replace('{name}', suggestion)}</span>
          </button>
          <button onClick={onClean} className="w-full text-left rounded-xl border border-neutral-700 bg-neutral-800/40 px-3 py-3 hover:bg-neutral-800/70">
            <span className="block text-sm font-semibold text-white">{t('ide_folder.mismatch_clean', 'Limpar esta pasta e sincronizar aqui')}</span>
            <span className="block text-[11px] text-neutral-400 mt-0.5">{t('ide_folder.mismatch_clean_desc', 'Apaga os arquivos e o histórico Git local desta pasta. Não dá para desfazer.')}</span>
          </button>
        </div>
        <div className="flex justify-end px-5 pb-5">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-neutral-400 hover:text-white">{t('ide_folder.cancel', 'Cancelar')}</button>
        </div>
      </div>
    </div>
  )
}
