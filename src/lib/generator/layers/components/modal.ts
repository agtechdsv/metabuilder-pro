/**
 * components/ui/Modal.tsx do app exportado: o mesmo Modal que a plataforma oferece ao código das telas geradas por IA
 * (import Modal from '@/components/ui/Modal', ou { Modal }). Sem crases nem ${} no texto: ele entra como literal no gerador.
 */
export const MODAL_SOURCE = `'use client'

import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl' | 'full' | 'custom'
  customWidth?: string
  customHeight?: string
  zIndex?: number
  hideHeader?: boolean
  className?: string
}

export function Modal({ isOpen, onClose, title, description, children, size = 'md', customWidth, customHeight, zIndex = 200, hideHeader = false, className }: ModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = isOpen ? 'hidden' : 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  if (!mounted || !isOpen) return null

  const unit = (val?: string) => (val ? (!isNaN(Number(val)) ? val + 'px' : val) : undefined)
  const style: React.CSSProperties = {}
  if (size === 'custom') {
    if (customWidth) { style.maxWidth = unit(customWidth); style.width = '100%' }
    if (customHeight) style.height = unit(customHeight)
  } else if (size === 'full') {
    style.height = '95vh'
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
      <div className="absolute inset-0 bg-black/80 transition-opacity duration-300" onClick={onClose} />
      <div
        className={cn(
          'relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-2xl',
          size === 'lg' && 'max-w-4xl',
          size === 'xl' && 'max-w-5xl',
          size === '2xl' && 'max-w-6xl',
          size === '4xl' && 'max-w-[80vw]',
          size === '5xl' && 'max-w-[90vw]',
          size === 'full' && 'max-w-[95vw] max-h-[95vh]',
          size === 'custom' && !customWidth && 'max-w-2xl',
          className
        )}
        style={style}
      >
        {!hideHeader && (
          <div className="p-8 pb-4 shrink-0">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                {title && <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{title}</h3>}
                {description && <p className="text-sm text-neutral-500">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-neutral-500 hover:text-neutral-900 dark:hover:text-white ml-auto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        <div className={cn('overflow-y-auto', !hideHeader ? 'px-8 pb-8' : 'w-full h-full')}>{children}</div>
      </div>
    </div>
  )
}

export default Modal
`
