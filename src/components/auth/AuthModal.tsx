'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function AuthModal({ isOpen, onClose, children }: AuthModalProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay - Z-40 (below Navbar Z-50) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[40]"
          />

          {/* Modal Container - Z-60 (above Navbar Z-50) */}
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              className="relative w-full max-w-[450px] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[3rem] shadow-[0_30px_100px_rgba(0,0,0,0.2)] dark:shadow-[0_30px_100px_rgba(0,0,0,0.6)] overflow-hidden transition-all pointer-events-auto"
            >
              {/* Close Button */}
              <div className="absolute top-6 right-6 z-50">
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-all hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="relative z-10 p-6 md:p-10">
                {children}
              </div>

              {/* Decorative Glows */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/30 rounded-full blur-[100px] pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-600/30 rounded-full blur-[100px] pointer-events-none" />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
