'use client'

import React, { useEffect, useLayoutEffect, useState } from 'react'
import { Grid3x3, Square, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Grade de cards cujo tamanho o USUÁRIO FINAL controla por um slider (preferência salva no navegador).
 *
 * - O slider (0–100) define a largura mínima do card: a grade usa `auto-fill`, então o número de colunas se ajusta sozinho.
 * - Expõe a variável CSS `--card-scale` (≈0.75–1.3, 1 = tamanho padrão da página) para os cards escalarem
 *   padding, ícone e tipografia proporcionalmente, ex.: `p-[calc(2rem*var(--card-scale,1))]`.
 */

const MIN_WIDTH = 200 // px, slider em 0
const MAX_WIDTH = 480 // px, slider em 100
const widthFor = (size: number) => Math.round(MIN_WIDTH + (size / 100) * (MAX_WIDTH - MIN_WIDTH))

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

interface ResizableCardGridProps {
  /** Chave da preferência no localStorage (uma por tela). */
  storageKey: string
  children: React.ReactNode
  /** Posição inicial do slider (0–100). Define também o "1x" da escala dos cards. */
  defaultSize?: number
  className?: string
  label?: string
  resetLabel?: string
  compactLabel?: string
  largeLabel?: string
}

export function ResizableCardGrid({
  storageKey,
  children,
  defaultSize = 50,
  className,
  label = 'Tamanho dos cards',
  resetLabel = 'Restaurar tamanho padrão',
  compactLabel = 'Cards menores',
  largeLabel = 'Cards maiores',
}: ResizableCardGridProps) {
  const [size, setSize] = useState(defaultSize)

  // Lê a preferência antes da pintura para não "pular" de tamanho depois que a tela aparece
  useIsoLayoutEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved !== null) {
        const n = Number(saved)
        if (Number.isFinite(n)) setSize(Math.min(100, Math.max(0, n)))
      }
    } catch (_) {}
  }, [storageKey])

  const update = (n: number) => {
    const v = Math.min(100, Math.max(0, n))
    setSize(v)
    try {
      localStorage.setItem(storageKey, String(v))
    } catch (_) {}
  }

  const minWidth = widthFor(size)
  const scale = Math.min(1.3, Math.max(0.75, minWidth / widthFor(defaultSize)))
  const isDefault = size === defaultSize

  return (
    <div>
      <div className="flex justify-end mb-5">
        <div
          className="group flex items-center gap-3 pl-4 pr-3 py-2 rounded-full border border-neutral-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-sm hover:shadow-md transition-shadow"
          title={label}
        >
          <button
            type="button"
            onClick={() => update(0)}
            aria-label={compactLabel}
            title={compactLabel}
            className="text-neutral-400 hover:text-indigo-500 transition-colors"
          >
            <Grid3x3 className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={size}
            onChange={(e) => update(Number(e.target.value))}
            aria-label={label}
            style={{
              background: `linear-gradient(to right, rgb(99 102 241) ${size}%, rgb(163 163 163 / 0.3) ${size}%)`,
            }}
            className={cn(
              'w-28 sm:w-36 h-1.5 rounded-full appearance-none cursor-pointer outline-none',
              'focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
              '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full',
              '[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-500',
              '[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125',
              '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white',
              '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-indigo-500 [&::-moz-range-thumb]:shadow-md'
            )}
          />

          <button
            type="button"
            onClick={() => update(100)}
            aria-label={largeLabel}
            title={largeLabel}
            className="text-neutral-400 hover:text-indigo-500 transition-colors"
          >
            <Square className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => update(defaultSize)}
            disabled={isDefault}
            aria-label={resetLabel}
            title={resetLabel}
            className={cn(
              'ml-0.5 p-1 rounded-full transition-all',
              isDefault
                ? 'opacity-0 pointer-events-none w-0 p-0 ml-0'
                : 'text-neutral-400 hover:text-indigo-500 hover:bg-indigo-500/10'
            )}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        className={cn('grid gap-6 transition-[grid-template-columns] duration-300', className)}
        style={
          {
            gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minWidth}px), 1fr))`,
            '--card-scale': scale,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </div>
  )
}
