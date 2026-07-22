import { CustomThemeProvider } from './CustomThemeProvider'
import { I18nProvider } from '@/i18n/I18nContext'
import { ToastProvider } from '@/components/ui/Toast'
import { ProgressBarProvider } from './ProgressBarProvider'
import { AutoUpdater } from '@/components/tauri/AutoUpdater'
import { GlobalDesktopListener } from './layout/GlobalDesktopListener'
import { UpgradeModalProvider } from '@/context/UpgradeModalContext'
import { PreviewProvider } from '@/contexts/PreviewContext'

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
          <UpgradeModalProvider>
            <PreviewProvider>
              <ProgressBarProvider />
              <AutoUpdater />
              <GlobalDesktopListener />
              {children}
            </PreviewProvider>
          </UpgradeModalProvider>
        </ToastProvider>
      </I18nProvider>
    </CustomThemeProvider>
  )
}
