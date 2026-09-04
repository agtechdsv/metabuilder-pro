import { AppAST } from '../../ast'
import { getByocComponentName } from '../routes/helpers'

export function generateByocComponents(ast: AppAST, files: Map<string, string>) {
  // ---------------------------------------------------------------------------
  // Componentes BYOC (dinâmicos baseados nas rotas e campos do Studio)
  // ---------------------------------------------------------------------------
  const byocNames = new Set<string>()

  ;(ast.routes || []).forEach(r => {
    ;(r.formFields || []).forEach(f => {
      if (f.isByoc || f.dataType === 'byoc' || f.id.startsWith('byoc_')) {
        const resolvedName = getByocComponentName(f)
        if (resolvedName) byocNames.add(resolvedName)
        const rawId = f.id.replace(/^byoc_/, '')
        const rawPascal = rawId.replace(/[^a-zA-Z0-9_]/g, '')
        if (rawPascal) byocNames.add(rawPascal)
        if (f.config?.byocName) byocNames.add(f.config.byocName)
        if (f.config?.componentName) byocNames.add(f.config.componentName)
      }
    })
  })

  byocNames.forEach(compName => {
    if (compName.toLowerCase().includes('timeline') || compName.toLowerCase().includes('status')) {
      files.set(`components/${compName}.tsx`, `'use client'

import React, { useState, useEffect } from 'react'
import { Check, Package } from 'lucide-react'

export function ${compName}({ initialStatus = 'Novo', data }: { initialStatus?: string; data?: any }) {
  const rawInit = (data?.status || data?.Status || initialStatus || 'Novo')
  const [status, setStatus] = useState(rawInit)

  useEffect(() => {
    const checkSelect = () => {
      const select = (document.getElementById('status') || document.querySelector('select[name="status"]') || document.querySelector('select[name*="status" i]')) as HTMLSelectElement | null
      if (select && select.value) {
        setStatus(select.value)
      }
    }

    checkSelect()

    const handler = (e: Event) => {
      const target = e.target as HTMLSelectElement | HTMLInputElement | null
      if (target && (target.id === 'status' || target.name === 'status' || target.name?.toLowerCase().includes('status'))) {
        if (target.value) {
          setStatus(target.value)
        }
      }
    }

    document.addEventListener('change', handler)
    document.addEventListener('input', handler)

    const timer = setTimeout(checkSelect, 150)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('change', handler)
      document.removeEventListener('input', handler)
    }
  }, [])

  const steps = ['Novo', 'Contactado', 'Em Negociação', 'Fechado Ganho']
  const normalize = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim()
  const currentNormalized = normalize(status)
  const currentIdx = steps.findIndex(s => normalize(s) === currentNormalized)
  const activeIdx = currentIdx >= 0 ? currentIdx : 0

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
          JORNADA DE NEGOCIAÇÃO
        </span>
        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 uppercase">
          {status || 'Novo'}
        </span>
      </div>
      <div className="flex items-center justify-between relative py-2">
        {/* Linha de fundo cinza */}
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
        {/* Linha de progresso preenchida até o step atual */}
        <div
          className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 rounded-full transition-all duration-500"
          style={{ width: activeIdx === 0 ? '0%' : activeIdx === 1 ? '33%' : activeIdx === 2 ? '66%' : 'calc(100% - 3rem)' }}
        />

        {steps.map((st, i) => {
          const isPassed = i < activeIdx
          const isCurrent = i === activeIdx
          return (
            <div key={st} className="flex flex-col items-center gap-3 relative z-10 transition-all duration-300">
              {isPassed ? (
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
              ) : isCurrent ? (
                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 flex items-center justify-center ring-4 ring-indigo-500/20 shadow-md">
                  <Package className="w-5 h-5 stroke-[2]" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 text-neutral-300 dark:text-neutral-600 flex items-center justify-center">
                  <Check className="w-5 h-5 stroke-[2]" />
                </div>
              )}
              <span className={'text-xs font-bold transition-colors ' + (isCurrent ? 'text-neutral-900 dark:text-white' : isPassed ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-500')}>
                {st}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
`)
    } else {
      files.set(`components/${compName}.tsx`, `'use client'

import React from 'react'

export function ${compName}({ data }: { data?: any }) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">${compName}</span>
      <p className="text-xs text-neutral-400 mt-1">Componente BYOC personalizado carregado com sucesso.</p>
    </div>
  )
}
`)
    }
  })
}
