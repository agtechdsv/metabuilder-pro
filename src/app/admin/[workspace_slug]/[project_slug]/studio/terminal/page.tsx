import { TerminalView } from '@/components/studio/TerminalView'
import { getLocale } from '@/i18n/get-locale'
import { getTranslations } from '@/i18n/get-translations'

export default async function TerminalPage() {
  const locale = await getLocale()
  const t = await getTranslations(locale)

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] w-full bg-white dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex-none p-6 border-b border-neutral-200 dark:border-neutral-800">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{t('studio.terminal.title')}</h1>
        <p className="text-neutral-500 mt-1">{t('studio.terminal.desc')}</p>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <TerminalView />
      </div>
    </div>
  )
}
