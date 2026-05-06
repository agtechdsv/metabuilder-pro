'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import pt from './translations/pt.json'
import en from './translations/en.json'
import es from './translations/es.json'

type Language = 'pt' | 'en' | 'es'
type Translations = typeof pt

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (path: string) => string
}

const translations: Record<Language, any> = { pt, en, es }

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('pt')

  useEffect(() => {
    const savedLang = localStorage.getItem('app-language') as Language
    if (savedLang && ['pt', 'en', 'es'].includes(savedLang)) {
      setLanguageState(savedLang)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('app-language', lang)
    // Atualiza o atributo lang do HTML
    document.documentElement.lang = lang
  }

  const t = (path: string): string => {
    const keys = path.split('.')
    let current: any = translations[language]
    
    for (const key of keys) {
      if (current[key] === undefined) {
        return path // Retorna a chave se não encontrar
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
