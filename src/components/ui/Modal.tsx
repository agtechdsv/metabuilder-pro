'use client'

import React, { useEffect, useState } from 'react'
import { X, AlertCircle } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, description, children }: ModalProps) {
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{title}</h3>
              {description && <p className="text-sm text-neutral-500">{description}</p>}
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="py-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
