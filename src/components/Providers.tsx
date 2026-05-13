import { CustomThemeProvider } from './CustomThemeProvider'
import { I18nProvider } from '@/i18n/I18nContext'
import { ToastProvider } from '@/components/ui/Toast'

export function Providers({ 
  children,
  initialLocale = 'pt'
}: { 
  children: React.ReactNode,
  initialLocale?: 'pt' | 'en' | 'es'
}) {
  return (
    <CustomThemeProvider defaultTheme="dark" attribute="class">
      <I18nProvider initialLocale={initialLocale}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </I18nProvider>
    </CustomThemeProvider>
  )
}
