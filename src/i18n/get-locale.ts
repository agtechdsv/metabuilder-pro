import { cookies } from 'next/headers'

export async function getLocale() {
  try {
    const cookieStore = await cookies()
    const locale = cookieStore.get('app-language')?.value || 'pt'
    return (['pt', 'en', 'es'].includes(locale) ? locale : 'pt') as 'pt' | 'en' | 'es'
  } catch (e) {
    return 'pt'
  }
}
