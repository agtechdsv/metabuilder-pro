'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { LoginForm } from '@/components/auth/LoginForm'
import { Zap, Code2, Info, X, FileText } from 'lucide-react'

export function IDELanding({ user }: { user: any }) {
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const [releaseNotes, setReleaseNotes] = useState<{ version: string, body: string, published_at: string } | null>(null)

  useEffect(() => {
    fetch('/api/releases/latest')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setReleaseNotes(data)
        }
      })
      .catch(console.error)
  }, [])
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black text-neutral-900 dark:text-white flex flex-col relative overflow-hidden font-sans transition-colors duration-500">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Header */}
      <header className="w-full px-8 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <img src="/logo-crystal.png" alt="MetaBuilder PRO" className="w-10 h-10 object-contain drop-shadow-md" />
          <h1 className="text-xl font-bold tracking-tight">
            MetaBuilder<span className="text-indigo-600 dark:text-indigo-500">PRO</span>
          </h1>
        </div>
        <HeaderActions hideUser={true} />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 px-8 py-12 max-w-7xl mx-auto w-full relative z-10">
        
        {/* Left Side: Welcome & Features */}
        <div className="flex-1 flex flex-col items-start max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                IDE Engine {releaseNotes ? releaseNotes.version : 'v0.1.2'}
              </div>
              
              <button 
                onClick={() => setShowReleaseNotes(true)}
                title="Ver Release Notes"
                className="p-1.5 rounded-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight mb-6">
              O futuro do <br />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 dark:from-indigo-400 dark:via-purple-400 dark:to-emerald-400 bg-clip-text text-transparent">
                desenvolvimento
              </span>
            </h2>
            <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-10 leading-relaxed">
              Bem-vindo ao MetaBuilder PRO IDE. Estruture interfaces premium, conecte bancos de dados e gere código de alta qualidade em tempo recorde.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 shadow-sm flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h4 className="font-bold">Performance Nativa</h4>
                  <p className="text-sm text-neutral-600 dark:text-neutral-500 mt-1">Acesso direto ao sistema de arquivos local para geração ultra-rápida de código.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 shadow-sm flex items-center justify-center shrink-0">
                  <Code2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-bold">Editor Avançado</h4>
                  <p className="text-sm text-neutral-600 dark:text-neutral-500 mt-1">Inteligência de metadados integrada diretamente no seu ambiente de trabalho.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Side: Login Box */}
        <motion.div 
          className="w-full max-w-md"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="bg-white/80 dark:bg-neutral-900/50 backdrop-blur-xl border border-neutral-200 dark:border-white/10 p-8 rounded-[2rem] shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-center">Acesse sua conta</h3>
            <LoginForm />
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-xs text-neutral-500 dark:text-neutral-600 relative z-10">
        &copy; {new Date().getFullYear()} AgTech Development. Todos os direitos reservados.
      </footer>

      {/* Release Notes Modal */}
      <AnimatePresence>
        {showReleaseNotes && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <Rocket className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">O que há de novo?</h3>
                    <p className="text-xs text-neutral-500">Versão {releaseNotes?.version || 'v0.1.2'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowReleaseNotes(false)}
                  className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                {releaseNotes ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-700 dark:text-neutral-300 bg-transparent border-0 p-0 m-0 leading-relaxed">
                      {releaseNotes.body || 'Sem detalhes fornecidos para esta versão.'}
                    </pre>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-sm">Buscando notas da versão...</p>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex justify-end">
                <button 
                  onClick={() => setShowReleaseNotes(false)}
                  className="px-6 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
