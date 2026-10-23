import React from 'react'

export function LoginPortalThemeWrapper({ 
  children, 
}: { 
  children: React.ReactNode, 
  theme?: string
}) {
  return <>{children}</>
}
