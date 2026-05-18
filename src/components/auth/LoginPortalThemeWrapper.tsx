import { CustomThemeProvider } from '../CustomThemeProvider'
import React from 'react'

type Theme = 'light' | 'dark'

export function LoginPortalThemeWrapper({ 
  children, 
  theme 
}: { 
  children: React.ReactNode, 
  theme: string
}) {
  const isFixed = theme === 'light' || theme === 'dark'
  
  return (
    <CustomThemeProvider 
      attribute="class" 
      defaultTheme={isFixed ? (theme as Theme) : 'dark'}
      forcedTheme={isFixed ? (theme as Theme) : undefined}
    >
      {children}
    </CustomThemeProvider>
  )
}
