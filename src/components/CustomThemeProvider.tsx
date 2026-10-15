'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme | undefined
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function CustomThemeProvider({ 
  children,
  defaultTheme = 'dark',
  attribute = 'class',
  forcedTheme
}: { 
  children: React.ReactNode
  defaultTheme?: Theme
  attribute?: string
  forcedTheme?: Theme
}) {
  const [theme, setThemeState] = useState<Theme | undefined>(undefined)

  useEffect(() => {
    if (forcedTheme) {
      setThemeState(forcedTheme)
      applyTheme(forcedTheme)
      return
    }

    // 1. Verificar localStorage ou preferência do sistema
    const savedTheme = localStorage.getItem('theme') as Theme
    const initialTheme = savedTheme || defaultTheme
    
    setThemeState(initialTheme)
    applyTheme(initialTheme)
  }, [defaultTheme, forcedTheme])

  // outra janela do app (ex.: IDE Local) trocou o tema: acompanha
  useEffect(() => {
    if (forcedTheme) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'theme' || (e.newValue !== 'light' && e.newValue !== 'dark')) return
      setThemeState(e.newValue as Theme)
      applyTheme(e.newValue as Theme)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedTheme, attribute])

  const applyTheme = (t: Theme) => {
    const root = window.document.documentElement
    if (attribute === 'class') {
      root.classList.remove('light', 'dark')
      root.classList.add(t)
    } else {
      root.setAttribute(attribute, t)
    }
  }

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('theme', t)
    applyTheme(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a CustomThemeProvider')
  }
  return context
}
