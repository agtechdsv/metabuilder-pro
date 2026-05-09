'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldCheck, FileText, Cpu, Shield, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/i18n/I18nContext'

interface LegalModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function LegalModal({ isOpen, onClose, title, children }: LegalModalProps) {
  const [isMounted, setIsMounted] = useState(false)
  const { language } = useI18n()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isMounted) return null

  const getIcon = () => {
    if (title.toLowerCase().includes('privacidade') || title.toLowerCase().includes('privacy')) return <ShieldCheck className="w-8 h-8 text-indigo-500" />
    if (title.toLowerCase().includes('termos') || title.toLowerCase().includes('terms')) return <FileText className="w-8 h-8 text-indigo-500" />
    return <Cpu className="w-8 h-8 text-indigo-500" />
  }

  const renderTitle = () => {
    const hasDe = title.toLowerCase().includes(' de ')
    
    return (
      <span className="flex flex-col">
        {hasDe ? (
          (() => {
            const parts = title.split(/ de /i)
            return (
              <span className="text-white font-bold">
                {parts[0]} de <span className="text-indigo-400">{parts[1]}</span>
              </span>
            )
          })()
        ) : (
          <span className="text-white font-bold">{title}</span>
        )}
        <span className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase mt-1 flex items-center gap-2">
          <span className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700">Documento Oficial</span>
          <span className="text-indigo-500">V2.0</span>
        </span>
      </span>
    )
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 md:p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl max-h-[90vh] bg-[#0A0A0F] border border-white/10 rounded-3xl shadow-2xl overflow-hidden transition-all pointer-events-auto flex flex-col"
            >
              {/* Header */}
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-b from-white/5 to-transparent">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-inner">
                    {getIcon()}
                  </div>
                  <h2 className="text-2xl tracking-tight">
                    {renderTitle()}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white transition-all flex items-center justify-center group"
                >
                  <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 md:p-10 custom-scrollbar bg-gradient-to-b from-transparent via-transparent to-black/20">
                <div className="prose prose-invert max-w-none prose-p:text-neutral-400 prose-p:leading-relaxed prose-strong:text-white prose-li:text-neutral-400">
                  {children}
                </div>
              </div>

              {/* Footer */}
              <div className="p-8 border-t border-white/5 flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center border border-white/5 group-hover:border-indigo-500/50 transition-colors">
                    <Shield className="w-5 h-5 text-neutral-500 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">MetaBuilder Pro Security</span>
                    <span className="text-[10px] font-medium text-neutral-600">Compliance & Proteção de Dados</span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2 group"
                >
                  {language === 'pt' ? 'Entendido e Aceito' : 'Understand and Accept'}
                  <CheckCircle2 className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

