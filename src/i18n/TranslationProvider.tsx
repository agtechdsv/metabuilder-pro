import React from 'react'

/**
 * TranslationProvider (Server-side wrapper)
 * 
 * Este componente atua como um wrapper para manter a compatibilidade com a estrutura de páginas
 * que define o locale no lado do servidor. O provedor de contexto real (Client Component) 
 * é o I18nProvider localizado em I18nContext.tsx, que já envolve toda a aplicação no RootLayout.
 */
export function TranslationProvider({ children, locale }: { children: React.ReactNode, locale?: string }) {
  return <>{children}</>
}
