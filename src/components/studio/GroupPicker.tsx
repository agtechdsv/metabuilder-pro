'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

/**
 * Escolha de grupos do projeto para a exceção "por grupo" das regras de acesso por linha.
 * Lista os grupos do projeto (project_roles) num combo; os escolhidos aparecem como etiquetas que se removem com um clique.
 * Sem grupos cadastrados (ou se não for possível ler), volta para o campo de texto (nomes separados por vírgula).
 */
export function useProjectGroups(projectId?: string): string[] | null {
  const supabase = useMemo(() => createClient(), [])
  const [groups, setGroups] = useState<string[] | null>(null)
  useEffect(() => {
    let alive = true
    if (!projectId) { setGroups([]); return }
    ;(async () => {
      const { data, error } = await supabase.from('project_roles').select('name').eq('project_id', projectId).order('name')
      if (!alive) return
      setGroups(error ? [] : Array.from(new Set(((data as any[]) || []).map(r => String(r.name || '').trim()).filter(Boolean))))
    })()
    return () => { alive = false }
  }, [projectId, supabase])
  return groups
}

interface Props {
  projectId?: string
  values: string[]
  onChange: (values: string[]) => void
  /** texto do combo ("Adicionar grupo...") */
  addLabel: string
  /** dica do campo de texto (quando não há grupos para listar) */
  placeholder?: string
  selectClassName: string
  inputClassName: string
}

export function GroupPicker({ projectId, values, onChange, addLabel, placeholder, selectClassName, inputClassName }: Props) {
  const groups = useProjectGroups(projectId)

  // sem grupos para listar (ou ainda carregando): campo de texto, como antes
  if (!groups || groups.length === 0) {
    return (
      <input
        className={inputClassName}
        value={values.join(', ')}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value.split(',').map(v => v.trim()).filter(Boolean))}
      />
    )
  }

  const known = new Set(groups.map(g => g.toLowerCase()))
  const left = groups.filter(g => !values.some(v => v.toLowerCase() === g.toLowerCase()))
  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map(v => {
            const ok = known.has(v.toLowerCase())
            return (
              <span
                key={v}
                title={ok ? undefined : 'Este nome não é um grupo do projeto'}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold border ${ok ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'}`}
              >
                {v}
                <button type="button" aria-label={`Remover ${v}`} onClick={() => onChange(values.filter(x => x !== v))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
              </span>
            )
          })}
        </div>
      )}
      <select
        className={selectClassName}
        value=""
        disabled={left.length === 0}
        onChange={e => { if (e.target.value) onChange([...values, e.target.value]) }}
      >
        <option value="">{addLabel}</option>
        {left.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
    </div>
  )
}
