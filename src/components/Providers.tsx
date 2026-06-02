import { CustomThemeProvider } from './CustomThemeProvider'
import { I18nProvider } from '@/i18n/I18nContext'
import { ToastProvider } from '@/components/ui/Toast'
import { ProgressBarProvider } from './ProgressBarProvider'

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
          <ProgressBarProvider />
          {children}
        </ToastProvider>
      </I18nProvider>
    </CustomThemeProvider>
  )
}
