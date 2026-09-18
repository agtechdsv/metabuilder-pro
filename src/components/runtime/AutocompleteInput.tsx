'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, X, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getModelSchemaName } from '@/components/runtime/utils/schemaHelper'

export interface AutocompleteOption {
  label: string
  value: any
  [key: string]: any
}

export interface AutocompleteInputProps {
  value: any
  onChange: (value: any, selectedItem?: AutocompleteOption | null) => void
  options?: AutocompleteOption[]
  table?: string
  labelCol?: string
  valueCol?: string
  minChars?: number
  debounceMs?: number
  limit?: number | string | null
  placeholder?: string
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  projectId?: string
  project?: any
  tunnelChannel?: any
  isTunnelReady?: boolean
  secretToken?: string
  onSearch?: (query: string) => Promise<AutocompleteOption[]>
}

export function AutocompleteInput({
  value,
  onChange,
  options = [],
  table,
  labelCol,
  valueCol,
  minChars = 2,
  debounceMs = 300,
  limit,
  placeholder = 'Digite para pesquisar...',
  disabled = false,
  className,
  style,
  projectId,
  project,
  tunnelChannel,
  isTunnelReady,
  secretToken,
  onSearch,
}: AutocompleteInputProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [dynamicResults, setDynamicResults] = useState<AutocompleteOption[]>([])
  const [selectedItemCache, setSelectedItemCache] = useState<AutocompleteOption | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Combina opções estáticas/pré-carregadas com resultados dinâmicos e cache de seleção
  const allAvailableOptions = useMemo(() => {
    const map = new Map<string, AutocompleteOption>()

    ;(options || []).forEach((opt) => {
      if (opt && opt.value !== undefined && opt.value !== null) {
        map.set(String(opt.value), opt)
      }
    })

    dynamicResults.forEach((opt) => {
      if (opt && opt.value !== undefined && opt.value !== null) {
        map.set(String(opt.value), opt)
      }
    })

    if (selectedItemCache && selectedItemCache.value !== undefined && selectedItemCache.value !== null) {
      map.set(String(selectedItemCache.value), selectedItemCache)
    }

    return Array.from(map.values())
  }, [options, dynamicResults, selectedItemCache])

  // Encontra o item selecionado atualmente a partir do value
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null || value === '') return null
    return allAvailableOptions.find((opt) => String(opt.value) === String(value)) || null
  }, [value, allAvailableOptions])

  // Sincroniza o texto do input com o item selecionado ou com o próprio value
  useEffect(() => {
    if (selectedOption) {
      setQuery(selectedOption.label)
    } else if (value !== undefined && value !== null && value !== '') {
      // Se não temos a opção mapeada ainda, exibe o próprio valor
      setQuery((prev) => (prev ? prev : String(value)))
    } else {
      setQuery('')
    }
  }, [selectedOption, value])

  // Fecha o dropdown ao clicar fora do container e restaura texto do item selecionado
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        if (selectedOption) {
          setQuery(selectedOption.label)
        } else if (value !== undefined && value !== null && value !== '') {
          setQuery(String(value))
        } else {
          setQuery('')
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectedOption, value])

  // Filtra as opções com base na query digitada
  const filteredResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (trimmed.length < minChars) return []

    let matches = allAvailableOptions.filter((opt) => {
      const label = String(opt.label ?? '').toLowerCase()
      const val = String(opt.value ?? '').toLowerCase()
      return label.includes(trimmed) || val.includes(trimmed)
    })

    const numLimit = limit ? Number(limit) : 0
    if (numLimit > 0) {
      matches = matches.slice(0, numLimit)
    }

    return matches
  }, [query, allAvailableOptions, minChars, limit])

  // Executa busca dinâmica no banco de dados via Túnel ou API
  const executeDynamicSearch = useCallback(
    async (searchTerm: string) => {
      if (onSearch) {
        try {
          const res = await onSearch(searchTerm)
          if (Array.isArray(res)) {
            setDynamicResults(res)
          }
        } catch (err) {
          console.error('[AutocompleteInput] Erro em onSearch customizado:', err)
        }
        return
      }

      if (!table || !labelCol) return

      const valCol = valueCol || labelCol || 'id'
      const limitNum = limit ? Number(limit) : 0

      // Caso 1: Projeto com Túnel ativo
      if (projectId && project?.db_type !== 'postgres' && tunnelChannel && isTunnelReady) {
        const queryId = crypto.randomUUID()
        const schemaToUse = project ? getModelSchemaName(project, table) : 'public'

        return new Promise<void>((resolve) => {
          let resolved = false

          const handleResult = (payload: any) => {
            if (payload.payload?.queryId === queryId) {
              resolved = true
              cleanup()
              if (payload.payload?.success && Array.isArray(payload.payload.data)) {
                const mapped: AutocompleteOption[] = payload.payload.data.map((row: any) => {
                  const val = row[valCol] ?? row[valCol.toLowerCase()] ?? row.id ?? row.ID ?? Object.values(row)[0]
                  const lbl = row[labelCol] ?? row[labelCol.toLowerCase()] ?? row.display_name ?? row.name ?? String(val)
                  return {
                    label: String(lbl ?? ''),
                    value: val,
                    ...row,
                  }
                })
                setDynamicResults(mapped)
              }
              resolve()
            }
          }

          const cleanup = () => {
            try {
              const bindings = tunnelChannel.bindings?.broadcast
              if (Array.isArray(bindings)) {
                tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
              }
            } catch (_) {}
          }

          tunnelChannel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
          tunnelChannel.on('broadcast', { event: 'sql_result' }, handleResult)

          tunnelChannel.send({
            type: 'broadcast',
            event: 'sql_query',
            payload: {
              queryId,
              table,
              tableName: table,
              schemaName: schemaToUse,
              action: 'select',
              token: secretToken || project?.secret_token || 'test-token',
              joins: [],
              filters: { [labelCol]: searchTerm },
              limit: limitNum > 0 ? limitNum : 100,
              offset: 0,
            },
          })

          setTimeout(() => {
            if (!resolved) {
              resolved = true
              cleanup()
              resolve()
            }
          }, 6000)
        })
      }

      // Caso 2: API REST / PostgreSQL direto
      try {
        const url = new URL(`/api/${table}`, window.location.origin)
        url.searchParams.set(`filter_${labelCol}`, searchTerm)
        if (limitNum > 0) {
          url.searchParams.set('limit', String(limitNum))
        }
        const res = await fetch(url.toString())
        if (res.ok) {
          const json = await res.json()
          const rows = Array.isArray(json) ? json : json.data || []
          const mapped: AutocompleteOption[] = rows.map((row: any) => {
            const val = row[valCol] ?? row[valCol.toLowerCase()] ?? row.id ?? row.ID ?? Object.values(row)[0]
            const lbl = row[labelCol] ?? row[labelCol.toLowerCase()] ?? row.display_name ?? row.name ?? String(val)
            return {
              label: String(lbl ?? ''),
              value: val,
              ...row,
            }
          })
          setDynamicResults(mapped)
        }
      } catch (err) {
        console.error('[AutocompleteInput] Erro na busca dinâmica via API:', err)
      }
    },
    [table, labelCol, valueCol, limit, projectId, project, tunnelChannel, isTunnelReady, secretToken, onSearch]
  )

  // Dispara busca dinâmica com debounce ao digitar
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < minChars) {
      setIsLoading(false)
      return
    }

    const canDynamic = Boolean(onSearch || (table && labelCol))
    if (!canDynamic) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await executeDynamicSearch(trimmed)
      } finally {
        setIsLoading(false)
      }
    }, debounceMs)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [query, minChars, debounceMs, executeDynamicSearch, onSearch, table, labelCol])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setIsOpen(true)
    setHighlightedIndex(-1)
  }

  const handleSelect = (item: AutocompleteOption) => {
    setQuery(item.label)
    setSelectedItemCache(item)
    setIsOpen(false)
    onChange(item.value, item)
    inputRef.current?.blur()
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setQuery('')
    setSelectedItemCache(null)
    setIsOpen(false)
    onChange('', null)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < filteredResults.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredResults.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const targetIdx = highlightedIndex >= 0 ? highlightedIndex : 0
      if (filteredResults[targetIdx]) {
        handleSelect(filteredResults[targetIdx])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  const hasValue = value !== undefined && value !== null && value !== ''

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        {/* Ícone de busca ou spinner */}
        <div className="absolute left-3.5 text-neutral-400 dark:text-neutral-500 pointer-events-none flex items-center justify-center">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>

        {/* Input Text */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          onChange={handleInputChange}
          onFocus={() => {
            if (!disabled) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={style}
          className={cn(
            'w-full pl-10 pr-9 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-medium outline-none transition-all',
            'focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:focus:border-emerald-400',
            disabled && 'opacity-50 cursor-not-allowed bg-neutral-100 dark:bg-neutral-900',
            className
          )}
        />

        {/* Botão de Limpar */}
        {hasValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Limpar seleção"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Popover / Dropdown de Sugestões */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl py-1 text-xs divide-y divide-neutral-100 dark:divide-neutral-800/60 animate-in fade-in-0 zoom-in-95 duration-100">
          {query.trim().length < minChars ? (
            <div className="px-4 py-3 text-center text-neutral-400 dark:text-neutral-500 italic">
              Digite pelo menos <strong className="text-neutral-600 dark:text-neutral-300 font-bold">{minChars}</strong> caracteres para buscar...
            </div>
          ) : filteredResults.length > 0 ? (
            filteredResults.map((item, idx) => {
              const isSelected = String(item.value) === String(value)
              const isHighlighted = idx === highlightedIndex

              return (
                <div
                  key={`${item.value}-${idx}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(item)
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={cn(
                    'px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors',
                    isHighlighted
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-800 dark:text-neutral-200',
                    isSelected && 'font-bold bg-emerald-50/70 dark:bg-emerald-950/30'
                  )}
                >
                  <div className="flex flex-col">
                    <span className="truncate">{item.label}</span>
                    {item.value !== item.label && (
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        ID: {String(item.value)}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />
                  )}
                </div>
              )
            })
          ) : (
            <div className="px-4 py-3 text-center text-neutral-400 dark:text-neutral-500 italic">
              {isLoading ? 'Pesquisando registros...' : `Nenhum resultado encontrado para "${query}"`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
