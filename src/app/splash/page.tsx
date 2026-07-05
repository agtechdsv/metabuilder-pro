'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Rocket, Loader2 } from 'lucide-react'

export default function SplashPage() {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Iniciando módulos core...')

  useEffect(() => {
    // Force transparent background on body to allow rounded corners in Tauri
    document.body.style.backgroundColor = 'transparent'
    document.documentElement.style.backgroundColor = 'transparent'
    
    // Simulate loading steps for the splash screen
    const steps = [
      { p: 15, msg: 'Carregando ambiente de execução...' },
      { p: 35, msg: 'Verificando atualizações...' },
      { p: 60, msg: 'Iniciando MetaBuilder Engine...' },
      { p: 85, msg: 'Carregando interface...' },
      { p: 100, msg: 'Pronto!' }
    ]

    let currentStep = 0
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setProgress(steps[currentStep].p)
        setStatus(steps[currentStep].msg)
        currentStep++
      } else {
        clearInterval(interval)
        
        // Ensure we are in Tauri before calling API
        // @ts-ignore
        if (typeof window !== 'undefined' && (window.__TAURI_INTERNALS__ || window.__TAURI__ || window.__TAURI_IPC__)) {
          setTimeout(() => {
            import('@tauri-apps/api/window').then(async ({ Window, getCurrentWindow }) => {
              try {
                const main = await Window.getByLabel('main')
                if (main) {
                  await main.show()
                  await main.setFocus()
                }
                await getCurrentWindow().close()
              } catch (e) {
                console.error('Error transitioning from splash:', e)
              }
            }).catch(console.error)
          }, 300) // Small delay after reaching 100%
        }
      }
    }, 400) // Each step takes 400ms

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full h-screen flex items-center justify-center p-4 bg-transparent overflow-hidden select-none" data-tauri-drag-region>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full h-full bg-neutral-900/90 dark:bg-black/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col justify-between"
      >
        {/* Background glow effects */}
        <div className="absolute top-[-30%] left-[-20%] w-[70%] h-[70%] bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[-30%] right-[-20%] w-[70%] h-[70%] bg-purple-500/20 rounded-full blur-[80px] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full pt-8" data-tauri-drag-region>
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg mb-6 backdrop-blur-md">
            <img src="/logo-transparent.png" alt="MetaBuilder PRO Logo" className="w-12 h-12 object-contain drop-shadow-md" />
          </div>
          
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">
            MetaBuilder<span className="text-indigo-400">PRO</span>
          </h1>
          <p className="text-sm font-medium text-indigo-200/60 uppercase tracking-widest">
            IDE Engine v1.0
          </p>
        </div>

        {/* Footer & Progress */}
        <div className="relative z-10 p-8 pb-10 w-full" data-tauri-drag-region>
          <div className="flex justify-between items-end mb-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="text-xs font-medium text-neutral-400">{status}</span>
            </div>
            <span className="text-xs font-bold text-indigo-400">{progress}%</span>
          </div>
          
          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
