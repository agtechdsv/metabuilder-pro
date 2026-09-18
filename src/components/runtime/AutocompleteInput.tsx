'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

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
}

export function AutocompleteInput({
  value,
  onChange,
  options = [],
  minChars = 2,
  debounceMs = 300,
  limit,
  placeholder = 'Digite para pesquisar...',
  disabled = false,
  className,
  style,
}: AutocompleteInputProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Encontra o item selecionado inicialmente a partir do value
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null || value === '') return null
    return options.find((opt) => String(opt.value) === String(value)) || null
  }, [value, options])

  // Sincroniza o texto do input com o item selecionado
  useEffect(() => {
    if (selectedOption) {
      setQuery(selectedOption.label)
    } else if (!value) {
      setQuery('')
    }
  }, [selectedOption, value])

  // Fecha o dropdown ao clicar fora do container
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        // Se o usuário digitou mas não selecionou, restaura para o item selecionado anteriormente
        if (selectedOption) {
          setQuery(selectedOption.label)
        } else if (!value) {
          setQuery('')
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectedOption, value])

  // Filtra as opções localmente com base na query
  const filteredResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (trimmed.length < minChars) return []

    let matches = options.filter((opt) => {
      const label = String(opt.label || '').toLowerCase()
      const val = String(opt.value || '').toLowerCase()
      return label.includes(trimmed) || val.includes(trimmed)
    })

    // Se houver limite configurado (> 0), aplica o corte. Se vazio ou 0, retorna 100% dos resultados
    const numLimit = limit ? Number(limit) : 0
    if (numLimit > 0) {
      matches = matches.slice(0, numLimit)
    }

    return matches
  }, [query, options, minChars, limit])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setIsOpen(true)
    setHighlightedIndex(-1)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    setIsLoading(true)
    debounceTimerRef.current = setTimeout(() => {
      setIsLoading(false)
    }, debounceMs)
  }

  const handleSelect = (item: AutocompleteOption) => {
    setQuery(item.label)
    setIsOpen(false)
    onChange(item.value, item)
    inputRef.current?.blur()
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setQuery('')
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
      if (highlightedIndex >= 0 && highlightedIndex < filteredResults.length) {
        handleSelect(filteredResults[highlightedIndex])
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
        {/* Ícone de busca */}
        <div className="absolute left-3.5 text-neutral-400 dark:text-neutral-500 pointer-events-none flex items-center justify-center">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>

        {/* Input */}
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
                  onClick={() => handleSelect(item)}
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
              Nenhum resultado encontrado para &quot;{query}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  )
}
