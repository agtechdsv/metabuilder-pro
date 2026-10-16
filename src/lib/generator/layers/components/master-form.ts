import { getGeneratorDictionary } from '../../i18n'

// função de máscara (CNPJ, CPF, CEP, telefone, data, moeda) compartilhada pelos formulários gerados
const MASK_FUNCTION = `function formatWithMask(value: string, mask?: string): string {
  if (!value || !mask) return value || ''
  const numbers = String(value).replace(/\\D/g, '')
  if (!numbers) return ''

  if (mask === '0.000,00' || mask === 'currency' || mask === 'moeda') {
    const num = parseInt(numbers, 10) / 100
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (mask === '0.000') {
    const num = parseInt(numbers, 10)
    return num.toLocaleString('pt-BR')
  }

  if (mask === '000.000.000-00') {
    const d = numbers.slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3)
    if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6)
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9, 11)
  }

  if (mask === '00.000.000/0000-00') {
    const d = numbers.slice(0, 14)
    if (d.length <= 2) return d
    if (d.length <= 5) return d.slice(0, 2) + '.' + d.slice(2)
    if (d.length <= 8) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5)
    if (d.length <= 12) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8)
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12, 14)
  }

  if (mask === '00000-000') {
    const d = numbers.slice(0, 8)
    if (d.length <= 5) return d
    return d.slice(0, 5) + '-' + d.slice(5, 8)
  }

  if (mask === '(00) 00000-0000' || mask === '(00) 0000-0000') {
    const d = numbers.slice(0, 11)
    if (d.length <= 2) return '(' + d
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2)
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6)
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7, 11)
  }

  if (mask === '00/00/0000') {
    const d = numbers.slice(0, 8)
    if (d.length <= 2) return d
    if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2)
    return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4, 8)
  }

  return value
}
`

export function generateMasterFormComponent(files: Map<string, string>, targetLang?: string) {
  const dict = getGeneratorDictionary(targetLang)
  files.set('components/DetailMasterForm.tsx', `'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Save, CheckCircle, AlertTriangle, X, Loader2 } from 'lucide-react'

export interface DetailMasterFormProps {
  id: string
  backPath: string
  title: string
  updateAction: (id: string, payload: Record<string, any>) => Promise<any>
  children: React.ReactNode
  isView?: boolean
}

${MASK_FUNCTION}
export function DetailMasterForm({ id, backPath, title, updateAction, children, isView }: DetailMasterFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  useEffect(() => {
    const handleExternalSave = () => {
      if (isView) return
      const form = document.getElementById('master-detail-form') as HTMLFormElement
      if (form && form.requestSubmit) {
        // We use a custom flag on the event to identify it as silent
        const ev = new CustomEvent('submit', { cancelable: true, bubbles: true })
        ;(ev as any).isSilentSave = true
        form.dispatchEvent(ev)
      }
    }
    window.addEventListener('save-master-form', handleExternalSave)
    return () => window.removeEventListener('save-master-form', handleExternalSave)
  }, [isView])

  const handleInput = (e: React.FormEvent<HTMLFormElement>) => {
    if (isView) return
    const target = e.target as HTMLInputElement
    const mask = target?.getAttribute?.('data-mask')
    if (mask) {
      target.value = formatWithMask(target.value, mask)
    }
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (isView) return
    const silent = e.nativeEvent?.isSilentSave || e.isSilentSave
    setIsSubmitting(true)
    if (!silent) window.dispatchEvent(new CustomEvent('page-progress-start'))
    try {
      const formData = new FormData(e.currentTarget)
      const payload: Record<string, any> = {}
      formData.forEach((v, k) => { payload[k] = v })
      await updateAction(id, payload)
      if (!silent) {
        setToastType('success')
        setToastMessage('${dict.feedback.record_updated}')
        window.dispatchEvent(new CustomEvent('save-all-relations'))
        if (typeof window !== 'undefined' && window.parent !== window) {
          window.parent.postMessage({
            type: 'RECORD_SAVED',
            action: 'update',
            id: String(id),
            payload,
            updatedRecord: { ...payload, id },
          }, '*')
          setTimeout(() => {
            window.parent.postMessage({
              type: 'CLOSE_MODAL',
              action: 'update',
              id: String(id),
              payload,
              updatedRecord: { ...payload, id },
            }, '*')
          }, 800)
        }
      }
    } catch (err: any) {
      console.error(err)
      if (!silent) {
        setToastType('error')
        setToastMessage(err?.message || '${dict.feedback.err_saving_changes}')
      }
    } finally {
      setIsSubmitting(false)
      if (!silent) window.dispatchEvent(new CustomEvent('page-progress-complete'))
    }
  }

  return (
    <>
      <form id="master-detail-form" onSubmit={handleSubmit} onInput={handleInput} className="relative z-10 space-y-6">
        <fieldset disabled={isView} className="contents border-0 p-0 m-0 min-w-0">
          {children}
        </fieldset>

        <div className="flex items-center justify-end gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-800 mt-8">
          <Link
            href={backPath}
            onClick={(e) => {
              if (typeof window !== 'undefined' && window.parent !== window) {
                e.preventDefault()
                window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')
              }
            }}
            className="px-6 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            {isView ? '${dict.form.back}' : '${dict.form.cancel}'}
          </Link>
          {!isView && (
            <button
              type="submit" data-mb-write="save"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs tracking-wide transition-colors shadow-lg shadow-indigo-500/20"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSubmitting ? '${dict.form.saving}' : '${dict.form.save_changes}'}
            </button>
          )}
        </div>
      </form>

      {/* Toast Notification */}
      {mounted && toastMessage && createPortal(
        <div className={'fixed bottom-6 right-6 z-[10000] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md border animate-in slide-in-from-bottom-5 duration-300 ' + (
          toastType === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 bg-white/95 dark:bg-neutral-900/95'
            : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300 bg-white/95 dark:bg-neutral-900/95'
        )}>
          <div className={'w-7 h-7 rounded-xl flex items-center justify-center ' + (
            toastType === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          )}>
            {toastType === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>
          <span className="text-xs font-bold tracking-wide">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>,
        document.body
      )}
    </>
  )
}
`)

  // Cadastro (new): aplica a máscara dos campos (data-mask) enquanto o usuário digita, como no formulário de edição
  files.set('components/MaskScope.tsx', `'use client'

import React from 'react'

${MASK_FUNCTION}
export function MaskScope({ children }: { children: React.ReactNode }) {
  return (
    <div
      onInput={(e) => {
        const target = e.target as HTMLInputElement
        const mask = target?.getAttribute?.('data-mask')
        if (mask) target.value = formatWithMask(target.value, mask)
      }}
    >
      {children}
    </div>
  )
}
`)

  // Cadastro (new): abas do registro (as de relacionamento só liberam depois de salvar)
  files.set('components/NewRecordTabs.tsx', `'use client'

import React, { useState } from 'react'
import { Lock } from 'lucide-react'

export function NewRecordTabs({ mainLabel, tabs, hint, children }: { mainLabel: string; tabs: string[]; hint: string; children: React.ReactNode }) {
  const [active, setActive] = useState(0)
  const cls = (on: boolean) => 'flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap shrink-0 ' + (on ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300')
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <button type="button" onClick={() => setActive(0)} className={cls(active === 0)}>{mainLabel}</button>
        {tabs.map((t, i) => (
          <button key={i} type="button" onClick={() => setActive(i + 1)} className={cls(active === i + 1)}>{t}</button>
        ))}
      </div>
      {/* o formulário continua montado ao trocar de aba: nada do que foi digitado se perde */}
      <div className={active === 0 ? '' : 'hidden'}>{children}</div>
      {active > 0 && (
        <div className="py-16 flex flex-col items-center gap-3 text-neutral-400">
          <Lock className="w-6 h-6" />
          <p className="text-xs font-medium">{hint}</p>
        </div>
      )}
    </div>
  )
}
`)
}
