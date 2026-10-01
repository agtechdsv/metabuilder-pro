'use client'

import React, { useEffect, useLayoutEffect, useState } from 'react'
import { Grid3x3, Square, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Grade de cards cujo tamanho o USUÁRIO FINAL escolhe num slider de pontos fixos (preferência salva no navegador).
 *
 * São 5 níveis. Cada nível define DE UMA VEZ a largura mínima do card e a escala do conteúdo
 * (`--card-scale`, usada pelos cards em `calc(... * var(--card-scale,1))`), então card e texto mudam juntos,
 * sem "saltos" no meio do arraste (o número de colunas é inteiro, por isso o tamanho não pode ser contínuo).
 */

// Fator da largura (relativo ao `baseWidth`) e escala do conteúdo de cada nível
const STEPS = [
  { width: 0.65, scale: 0.8 },
  { width: 0.82, scale: 0.9 },
  { width: 1, scale: 1 }, // Normal
  { width: 1.22, scale: 1.12 },
  { width: 1.5, scale: 1.25 },
] as const
const NORMAL_STEP = 2
const LAST_STEP = STEPS.length - 1

const DEFAULT_LABELS = ['Compacto', 'Pequeno', 'Normal', 'Grande', 'Extra grande']

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

interface ResizableCardGridProps {
  /** Chave da preferência no localStorage (uma por tela). */
  storageKey: string
  children: React.ReactNode
  /** Largura mínima (px) do card no nível "Normal". */
  baseWidth?: number
  className?: string
  label?: string
  resetLabel?: string
  /** Nomes dos 5 níveis, do menor para o maior. */
  stepLabels?: string[]
}

export function ResizableCardGrid({
  storageKey,
  children,
  baseWidth = 340,
  className,
  label = 'Tamanho dos cards',
  resetLabel = 'Restaurar tamanho padrão',
  stepLabels = DEFAULT_LABELS,
}: ResizableCardGridProps) {
  const [step, setStep] = useState(NORMAL_STEP)

  // Lê a preferência antes da pintura para não "pular" de tamanho depois que a tela aparece
  useIsoLayoutEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved !== null) {
        const n = Number(saved)
        if (Number.isFinite(n)) {
          // Versões anteriores guardavam 0–100 (slider contínuo): converte para o nível mais próximo
          const idx = n > LAST_STEP ? Math.round(n / (100 / LAST_STEP)) : Math.round(n)
          setStep(Math.min(LAST_STEP, Math.max(0, idx)))
        }
      }
    } catch (_) {}
  }, [storageKey])

  const update = (n: number) => {
    const v = Math.min(LAST_STEP, Math.max(0, Math.round(n)))
    setStep(v)
    try {
      localStorage.setItem(storageKey, String(v))
    } catch (_) {}
  }

  const { width, scale } = STEPS[step]
  const minWidth = Math.round(baseWidth * width)
  const fill = (step / LAST_STEP) * 100
  const currentLabel = stepLabels[step] ?? DEFAULT_LABELS[step]

  return (
    <div>
      <div className="flex justify-end mb-5">
        <div
          className="flex items-center gap-3 pl-4 pr-3 py-2 rounded-full border border-neutral-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-sm hover:shadow-md transition-shadow"
          title={label}
        >
          <button
            type="button"
            onClick={() => update(0)}
            aria-label={stepLabels[0]}
            title={stepLabels[0]}
            className="text-neutral-400 hover:text-indigo-500 transition-colors"
          >
            <Grid3x3 className="w-3.5 h-3.5" />
          </button>

          <div className="relative w-28 sm:w-40 h-5 flex items-center">
            {/* Trilha preenchida + marcas dos pontos fixos */}
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-neutral-300/40 dark:bg-white/10" />
            <div className="absolute left-0 h-1.5 rounded-full bg-indigo-500 transition-[width] duration-200" style={{ width: `${fill}%` }} />
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 pointer-events-none transition-colors',
                  i <= step ? 'bg-white/90' : 'bg-neutral-400/60 dark:bg-white/30'
                )}
                style={{ left: `${(i / LAST_STEP) * 100}%` }}
              />
            ))}
            <input
              type="range"
              min={0}
              max={LAST_STEP}
              step={1}
              value={step}
              onChange={(e) => update(Number(e.target.value))}
              aria-label={label}
              aria-valuetext={currentLabel}
              className={cn(
                'absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer outline-none',
                'focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-indigo-500/50',
                '[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent',
                '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full',
                '[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-500',
                '[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125',
                '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white',
                '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-indigo-500 [&::-moz-range-thumb]:shadow-md'
              )}
            />
          </div>

          <button
            type="button"
            onClick={() => update(LAST_STEP)}
            aria-label={stepLabels[LAST_STEP]}
            title={stepLabels[LAST_STEP]}
            className="text-neutral-400 hover:text-indigo-500 transition-colors"
          >
            <Square className="w-4 h-4" />
          </button>

          <span className="w-[5.5rem] text-[11px] font-bold text-neutral-500 dark:text-neutral-400 select-none text-left truncate">
            {currentLabel}
          </span>

          <button
            type="button"
            onClick={() => update(NORMAL_STEP)}
            disabled={step === NORMAL_STEP}
            aria-label={resetLabel}
            title={resetLabel}
            className={cn(
              'p-1 rounded-full transition-all',
              step === NORMAL_STEP
                ? 'opacity-0 pointer-events-none'
                : 'text-neutral-400 hover:text-indigo-500 hover:bg-indigo-500/10'
            )}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        className={cn('grid gap-6', className)}
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
