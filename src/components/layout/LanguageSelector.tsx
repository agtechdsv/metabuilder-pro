'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'

const languages = [
  { 
    code: 'pt', 
    label: 'Português', 
    flag: 'https://flagcdn.com/w80/br.png', 
    short: 'PT' 
  },
  { 
    code: 'en', 
    label: 'English', 
    flag: 'https://flagcdn.com/w80/us.png', 
    short: 'EN' 
  },
  { 
    code: 'es', 
    label: 'Español', 
    flag: 'https://flagcdn.com/w80/es.png', 
    short: 'ES' 
  },
] as const

export function LanguageSelector() {
  const { language, setLanguage } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentLang = languages.find(l => l.code === language) || languages[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div 
      className="relative" 
      ref={dropdownRef}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-blue-500 dark:hover:text-blue-400 transition-all hover:bg-neutral-200 dark:hover:bg-neutral-800 active:scale-95 group"
      >
        <div className="w-6 h-6 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700 shadow-sm flex-shrink-0">
          <img src={currentLang.flag} alt={currentLang.label} className="w-full h-full object-cover scale-125" />
        </div>
        <span className="text-xs font-bold tracking-wider">{currentLang.short}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-neutral-400 group-hover:text-current transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 pt-2 w-56 z-[100]"
          >
            <div className="bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.3)] overflow-hidden">
              <div className="p-2">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-4 py-3">Selecionar Idioma</p>
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code as any)
                      setIsOpen(false)
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all group",
                      language === lang.code 
                        ? "bg-blue-500/10 text-blue-500 font-bold" 
                        : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700 shadow-sm">
                        <img src={lang.flag} alt={lang.label} className="w-full h-full object-cover scale-125" />
                      </div>
                      <span>{lang.label}</span>
                    </div>
                    {language === lang.code && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
