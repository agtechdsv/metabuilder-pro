'use client'

import React, { useEffect, useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
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
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!mounted || !isOpen) return null

  // Ensure default unit is px if only a number is provided
  const formatUnit = (val?: string) => {
    if (!val) return undefined;
    if (!isNaN(Number(val))) return `${val}px`;
    return val;
  }

  const customStyle: React.CSSProperties = {};
  if (size === 'custom') {
    if (customWidth) customStyle.maxWidth = formatUnit(customWidth);
    if (customWidth) customStyle.width = '100%';
    if (customHeight) customStyle.height = formatUnit(customHeight);
  } else if (size === 'full') {
    customStyle.height = '95vh';
  }

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className={cn(
        "relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300",
        size === 'sm' && "max-w-sm",
        size === 'md' && "max-w-2xl", // Padrão MD = max-w-2xl para forms
        size === 'lg' && "max-w-4xl",
        size === 'xl' && "max-w-5xl",
        size === '2xl' && "max-w-6xl",
        size === '4xl' && "max-w-[80vw]",
        size === '5xl' && "max-w-[90vw]",
        size === 'full' && "max-w-[95vw] max-h-[95vh]",
        size === 'custom' && !customWidth && "max-w-2xl", // fallback
        className
      )}
      style={customStyle}
      >
        {!hideHeader && (
          <div className="p-8 pb-4 shrink-0">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                {title && <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{title}</h3>}
                {description && <p className="text-sm text-neutral-500">{description}</p>}
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-neutral-500 hover:text-neutral-900 dark:hover:text-white ml-auto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <div className={cn("overflow-y-auto custom-scrollbar", !hideHeader ? "px-8 pb-8" : "w-full h-full")}>
          {children}
        </div>
      </div>
    </div>
  )
}
