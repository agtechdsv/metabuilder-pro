'use client'

import { ThemeProvider } from 'next-themes'
import React from 'react'

export function LoginPortalThemeWrapper({ 
  children, 
  theme 
}: { 
  children: React.ReactNode, 
  theme: 'light' | 'dark' 
}) {
  return (
    <ThemeProvider 
      attribute="class" 
      forcedTheme={theme}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  )
}
