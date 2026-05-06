'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface AuthDrawerProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function AuthDrawer({ isOpen, onClose, children }: AuthDrawerProps) {
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
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0a0a0a] border-l border-neutral-800/50 z-[160] shadow-[ -10px_0_50px_rgba(0,0,0,0.5) ] flex flex-col"
          >
            {/* Header / Close Button */}
            <div className="absolute top-6 right-6 z-[170]">
              <button
                onClick={onClose}
                className="p-2.5 rounded-xl bg-neutral-900/50 border border-neutral-800 text-neutral-500 hover:text-white transition-all hover:bg-neutral-800 active:scale-95 group"
              >
                <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pt-24 pb-12 px-6 md:px-10">
              <div className="relative z-10 h-full">
                {children}
              </div>
            </div>
            
            {/* Ambient Glows */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
