export function generateMasterFormComponent(files: Map<string, string>) {
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
}

function formatWithMask(value: string, mask?: string): string {
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

export function DetailMasterForm({ id, backPath, title, updateAction, children }: DetailMasterFormProps) {
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
  }, [])

  const handleInput = (e: React.FormEvent<HTMLFormElement>) => {
    const target = e.target as HTMLInputElement
    const mask = target?.getAttribute?.('data-mask')
    if (mask) {
      target.value = formatWithMask(target.value, mask)
    }
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
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
        setToastMessage('Registro atualizado com sucesso!')
        window.dispatchEvent(new CustomEvent('save-all-relations'))
        if (typeof window !== 'undefined' && window.parent !== window) {
          setTimeout(() => {
            window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')
          }, 800)
        }
      }
    } catch (err: any) {
      console.error(err)
      if (!silent) {
        setToastType('error')
        setToastMessage(err?.message || 'Erro ao salvar alterações.')
      }
    } finally {
      setIsSubmitting(false)
      if (!silent) window.dispatchEvent(new CustomEvent('page-progress-complete'))
    }
  }

  return (
    <>
      <form id="master-detail-form" onSubmit={handleSubmit} onInput={handleInput} className="relative z-10 space-y-6">
        {children}

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
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs tracking-wide transition-colors shadow-lg shadow-indigo-500/20"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
          </button>
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
}
