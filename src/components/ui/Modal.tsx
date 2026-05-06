'use client'

import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldCheck, FileText, Cpu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n/I18nContext'

interface ModalProps {
  children: React.ReactNode
  title: string
  type?: 'privacy' | 'terms' | 'agtech'
}

export function Modal({ children, title, type = 'privacy' }: ModalProps) {
  const router = useRouter()
  const { t } = useI18n()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  const handleClose = () => {
    router.back()
  }

  if (!isMounted) return null

  const icons = {
    privacy: ShieldCheck,
    terms: FileText,
    agtech: Cpu
  }
  const Icon = icons[type] || ShieldCheck

  // Tradução do título dinâmico se for uma chave, senão usa o original
  const translatedTitle = t(`${type}.title`) || title

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="fixed inset-0 bg-neutral-950/40 dark:bg-black/90 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 40 }}
        className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.2)] dark:shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] overflow-hidden flex flex-col z-[201]"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1/2 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="p-8 pb-4 flex justify-between items-start relative z-10">
          <div className="flex gap-4 items-center">
            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <Icon className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight leading-tight">
                {translatedTitle}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                  {type === 'agtech' ? t('agtech.lab') : t(`${type}.version`)}
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-all border border-neutral-200 dark:border-neutral-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-8 py-4 overflow-y-auto max-h-[60vh] custom-scrollbar relative z-10">
          {children}
        </div>

        <div className="p-8 pt-4 flex flex-col gap-6 relative z-10">
          <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-950/50 rounded-2xl border border-neutral-100 dark:border-neutral-800/50">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-neutral-400 dark:text-neutral-600" />
              <div>
                <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-400 uppercase tracking-wider">{t('agtech.security')}</p>
                <p className="text-[9px] text-neutral-500 dark:text-neutral-600 uppercase tracking-widest text-wrap">{t('agtech.compliance')}</p>
              </div>
            </div>
            {type !== 'agtech' && (
              <button
                onClick={handleClose}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20 active:scale-95 border border-blue-400/20 uppercase tracking-wider"
              >
                {t(`${type}.button`)}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
