'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderGit2, LayoutDashboard, X } from 'lucide-react'

export interface IDEMinimizedBarProps {
  isMinimized: boolean
  target: { name: string } | null
  setIsMinimized: (minimized: boolean) => void
  closeIDE: () => void
}

export function IDEMinimizedBar({
  isMinimized,
  target,
  setIsMinimized,
  closeIDE
}: IDEMinimizedBarProps) {
  if (!target) return null

  return (
    <AnimatePresence>
      {isMinimized && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-[99999] pointer-events-auto"
        >
          <div className="flex items-center gap-3 bg-neutral-900/90 backdrop-blur-xl border border-indigo-500/30 p-2 pl-4 pr-2 rounded-full shadow-2xl">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-indigo-400" />
              <div className="flex flex-col max-w-[150px] mr-2">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                  IDE Local
                </span>
                <span className="text-sm font-semibold text-white truncate">{target.name}</span>
              </div>
            </div>
            <button
              onClick={() => setIsMinimized(false)}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full text-xs font-bold transition-all shadow-lg"
            >
              <LayoutDashboard className="w-4 h-4" />
              Retornar
            </button>
            <button
              onClick={closeIDE}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors"
              title="Fechar IDE"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
