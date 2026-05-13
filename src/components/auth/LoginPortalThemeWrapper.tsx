import { CustomThemeProvider } from '../CustomThemeProvider'
import React from 'react'

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
      defaultTheme={isFixed ? theme : 'system'}
      enableSystem={!isFixed}
      forcedTheme={isFixed ? theme : undefined}
    >
      {children}
    </CustomThemeProvider>
  )
}
