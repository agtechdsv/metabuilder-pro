import { MfaChallengeForm } from '@/components/auth/MfaChallengeForm'
import { getLocale } from '@/i18n/get-locale'
import { getTranslations } from '@/i18n/get-translations'

export default async function MfaChallengePage() {
  const locale = await getLocale()
  const t = await getTranslations(locale)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-neutral-50 to-neutral-200 dark:from-neutral-900 dark:to-black text-neutral-900 dark:text-white transition-colors duration-300">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="bg-white/80 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-md transition-all">
          <MfaChallengeForm />
        </div>

        <p className="text-center text-xs text-neutral-500 font-medium">
          {t('auth.login.powered_by')}
        </p>
      </div>
    </main>
  )
}
