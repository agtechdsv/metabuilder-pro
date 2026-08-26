import React from 'react'
import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { MindMapNode } from './useMindMapData'

// Componente interno para Tooltip Estilizada (Pode ser abstraído futuramente)
import { motion, AnimatePresence } from 'framer-motion'
const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => {
  const [show, setShow] = React.useState(false)
  return (
    <div className="relative flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 5, scale: 0.95 }}
            className="absolute right-full mr-3 px-3 py-1.5 bg-white/90 dark:bg-slate-900/90 border border-neutral-200 dark:border-white/10 rounded-lg backdrop-blur-xl shadow-2xl pointer-events-none whitespace-nowrap z-[100]"
          >
            <span className="text-[10px] font-bold text-neutral-800 dark:text-white uppercase tracking-wider">{text}</span>
            <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 rotate-45 bg-white dark:bg-slate-900 border-r border-t border-neutral-200 dark:border-white/10" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface MindMapControlsProps {
  currentPath: number[]
  currentNode: MindMapNode
  isRelational: boolean
  setZoom: React.Dispatch<React.SetStateAction<number>>
  handleGoBack: () => void
  handleReset: () => void
  handleCenterView: () => void
}

export function MindMapControls({
  currentPath,
  currentNode,
  isRelational,
  setZoom,
  handleGoBack,
  handleReset,
  handleCenterView
}: MindMapControlsProps) {
  const { t } = useI18n()

  return (
    <>
      {/* Toolbar Superior */}
      <div className="absolute top-8 left-8 z-50 flex items-center gap-4">
        {currentPath.length > 0 && (
          <Tooltip text={t('runtime.back_level', 'Voltar Nível')}>
            <button onClick={handleGoBack} className="p-4 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl transition-all active:scale-95 shadow-xl pointer-events-auto group">
              <ArrowLeft className="w-5 h-5 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white" />
            </button>
          </Tooltip>
        )}
        <div className="px-6 py-4 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-black text-neutral-700 dark:text-white uppercase tracking-[0.3em] opacity-80">
              {currentPath.length === 0 ? 'Workspace' : (isRelational ? `${t('runtime.level', 'Nível')} ${currentNode.level + 1}` : (currentNode.field?.display_name || 'Level'))}
            </span>
          </div>
        </div>
      </div>

      {/* Controles Laterais */}
      <div className="absolute top-8 right-8 z-50 flex flex-col gap-2">
        <Tooltip text="Aumentar Zoom">
          <button onClick={() => setZoom(z => Math.min(z + 0.2, 2))} className="p-3 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all pointer-events-auto shadow-xl"><ZoomIn className="w-5 h-5" /></button>
        </Tooltip>
        <Tooltip text="Diminuir Zoom">
          <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} className="p-3 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all pointer-events-auto shadow-xl"><ZoomOut className="w-5 h-5" /></button>
        </Tooltip>
        <div className="w-full h-px bg-neutral-200 dark:bg-white/5 my-1" />
        <Tooltip text="Resetar Tudo">
          <button onClick={handleReset} className="p-3 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all pointer-events-auto shadow-xl"><RotateCcw className="w-5 h-5" /></button>
        </Tooltip>
        <Tooltip text="Centralizar Vista">
          <button onClick={handleCenterView} className="p-3 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all pointer-events-auto shadow-xl"><Maximize2 className="w-5 h-5" /></button>
        </Tooltip>
      </div>

      {/* Barra de Status Inferior */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-8 py-3 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-full backdrop-blur-3xl flex items-center gap-6 shadow-2xl z-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[9px] font-black text-neutral-600 dark:text-white uppercase tracking-[0.3em] opacity-60">Nexo Engine Active</span>
        </div>
        <div className="w-px h-3 bg-neutral-200 dark:bg-white/10" />
        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{currentNode.children?.length || 0} Orbitals</span>
      </div>
    </>
  )
}
