'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: string
  message: string
  type: ToastType
  action?: ToastAction
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, action?: ToastAction) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info', action?: ToastAction) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type, action }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-8 right-8 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`
                pointer-events-auto min-w-[320px] max-w-[420px] p-4 rounded-2xl shadow-2xl border flex items-start gap-4 backdrop-blur-xl
                ${t.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-450' : 
                  t.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' : 
                  'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-450'}
              `}
            >
              <div className={`
                p-2 rounded-xl
                ${t.type === 'success' ? 'bg-emerald-500 text-white' : 
                  t.type === 'error' ? 'bg-red-500 text-white' : 
                  'bg-indigo-500 text-white'}
              `}>
                {t.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
                {t.type === 'error' && <AlertCircle className="w-4 h-4" />}
                {t.type === 'info' && <Info className="w-4 h-4" />}
              </div>
              <div className="flex-1 pt-0.5">
                <p className="text-sm font-bold leading-tight">{t.message}</p>
                {t.action && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      t.action?.onClick()
                      setToasts((prev) => prev.filter((item) => item.id !== t.id))
                    }}
                    className="mt-2.5 px-3 py-1.5 bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all border border-neutral-200 dark:border-neutral-700 shadow-sm cursor-pointer"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button 
                onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 opacity-50" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
