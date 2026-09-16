'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import pt from './translations/pt.json'
import en from './translations/en.json'
import es from './translations/es.json'
import { useRouter } from 'next/navigation'

type Language = 'pt' | 'en' | 'es'
type Translations = typeof pt

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (path: string, defaultValue?: string) => string
}

const translations: Record<Language, any> = { pt, en, es }

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ 
  children,
  initialLocale = 'pt' 
}: { 
  children: React.ReactNode,
  initialLocale?: Language 
}) {
  const [language, setLanguageState] = useState<Language>(initialLocale)
  const router = useRouter()

  useEffect(() => {
    // Sincroniza com localStorage se existir, mas o initialLocale manda no primeiro render
    const savedLang = localStorage.getItem('app-language') as Language
    let current = initialLocale
    if (savedLang && ['pt', 'en', 'es'].includes(savedLang) && savedLang !== initialLocale) {
      setLanguageState(savedLang)
      current = savedLang
    }

    // Sincroniza com o Tauri para que o próximo splash screen leia imediatamente este idioma
    if (typeof window !== 'undefined') {
      // @ts-ignore
      const isTauri = Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__ || window.__TAURI_IPC__)
      if (isTauri) {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('save_language', { lang: current }).catch(() => {})
        }).catch(() => {})
      }
    }
  }, [initialLocale])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('app-language', lang)
    // Persiste em cookie para o Server Side Rendering (SSR)
    document.cookie = `app-language=${lang}; path=/; max-age=31536000`
    // Atualiza o atributo lang do HTML
    document.documentElement.lang = lang

    // Sincroniza com o Tauri para que o próximo splash screen leia imediatamente este idioma
    if (typeof window !== 'undefined') {
      // @ts-ignore
      const isTauri = Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__ || window.__TAURI_IPC__)
      if (isTauri) {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('save_language', { lang }).catch((err) => console.warn('Falha ao sincronizar idioma com Tauri:', err))
        }).catch(() => {})
      }
    }
    
    // Atualiza os Server Components sem dar reload na página (mantém o estado do React)
    router.refresh()
  }

  const t = (path: string, defaultValue?: string): string => {
    const keys = path.split('.')
    let current: any = translations[language]
    
    for (const key of keys) {
      if (!current || current[key] === undefined) {
        return defaultValue || path // Retorna default ou a chave se não encontrar
      }
      current = current[key]
    }
    
    return current as string
  }

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}
