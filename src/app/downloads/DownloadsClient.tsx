'use client'

import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Download, Monitor, Apple, Terminal } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

interface DownloadsClientProps {
  release: {
    version: string
    name: string
    published_at: string
    assets: Array<{
      name: string
      browser_download_url: string
      size: number
    }>
  } | null
}

export function DownloadsClient({ release }: DownloadsClientProps) {
  const { t } = useI18n()
  const assets = release?.assets || []

  const winAsset = assets.find((a: any) => a.name.endsWith('.exe'))
  const macAsset = assets.find((a: any) => a.name.endsWith('.dmg'))
  const linuxAsset = assets.find((a: any) => a.name.endsWith('.AppImage') || a.name.endsWith('.deb'))

  const formatSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
      <Navbar user={null} profile={null} />

      <main className="flex-grow flex flex-col items-center relative z-10 w-full pt-32 pb-20">
        {/* Background Glow */}
        <div className="absolute top-0 left-0 w-full h-[80vh] overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[20%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[150px]"></div>
          <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[150px]"></div>
        </div>

        <div className="w-full max-w-5xl mx-auto px-6">
          <div className="text-center mb-16 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-black text-xs uppercase tracking-widest mb-8 border border-indigo-500/20 shadow-sm">
              <Download className="w-4 h-4" />
              {t('downloads_page.badge', 'Downloads')}
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight text-neutral-900 dark:text-white">
              {t('downloads_page.title', 'Baixe a MetaBuilder IDE')}
            </h1>
            
            <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed font-medium">
              {t('downloads_page.desc', 'Acesse a infraestrutura da sua máquina localmente com todo o poder da nuvem. Crie sua conta gratuitamente pelo próprio aplicativo.')}
            </p>
            
            {release && (
              <p className="mt-6 text-sm text-neutral-500 font-medium bg-neutral-100 dark:bg-neutral-900 inline-block px-4 py-2 rounded-full border border-neutral-200 dark:border-neutral-800">
                {t('downloads_page.current_version', 'Versão atual:')} <span className="font-bold">{release.version}</span> • {new Date(release.published_at).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Windows */}
            <div className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 flex flex-col items-center text-center hover:border-indigo-500/30 transition-colors shadow-sm relative group">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                <Monitor className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Windows</h3>
              <p className="text-sm text-neutral-500 mb-8">{t('downloads_page.win_desc', 'Windows 10 ou superior (64-bit)')}</p>
              
              {winAsset ? (
                <a href={winAsset.browser_download_url} className="mt-auto w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 text-sm uppercase tracking-widest">
                  {t('downloads_page.download_win', 'Baixar para Windows')}
                </a>
              ) : (
                <button disabled className="mt-auto w-full py-4 bg-neutral-200 dark:bg-neutral-800 text-neutral-400 font-bold rounded-2xl cursor-not-allowed text-sm uppercase tracking-widest">
                  {t('downloads_page.unavailable', 'Indisponível')}
                </button>
              )}
              {winAsset && <p className="text-xs text-neutral-400 mt-4 font-mono">{formatSize(winAsset.size)}</p>}
            </div>

            {/* Mac */}
            <div className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 flex flex-col items-center text-center hover:border-indigo-500/30 transition-colors shadow-sm relative group">
              <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-2xl flex items-center justify-center mb-6">
                <Apple className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">macOS</h3>
              <p className="text-sm text-neutral-500 mb-8">{t('downloads_page.mac_desc', 'macOS 11+ (Intel & Apple Silicon)')}</p>
              
              {macAsset ? (
                <a href={macAsset.browser_download_url} className="mt-auto w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 text-sm uppercase tracking-widest">
                  {t('downloads_page.download_mac', 'Baixar para Mac')}
                </a>
              ) : (
                <button disabled className="mt-auto w-full py-4 bg-neutral-200 dark:bg-neutral-800 text-neutral-400 font-bold rounded-2xl cursor-not-allowed text-sm uppercase tracking-widest">
                  {t('downloads_page.unavailable', 'Indisponível')}
                </button>
              )}
              {macAsset && <p className="text-xs text-neutral-400 mt-4 font-mono">{formatSize(macAsset.size)}</p>}
            </div>

            {/* Linux */}
            <div className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 flex flex-col items-center text-center hover:border-indigo-500/30 transition-colors shadow-sm relative group">
              <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center mb-6">
                <Terminal className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Linux</h3>
              <p className="text-sm text-neutral-500 mb-8">{t('downloads_page.linux_desc', 'Ubuntu, Debian, Linux Mint (.deb)')}</p>
              
              {linuxAsset ? (
                <a href={linuxAsset.browser_download_url} className="mt-auto w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 text-sm uppercase tracking-widest">
                  {t('downloads_page.download_linux', 'Baixar para Linux')}
                </a>
              ) : (
                <button disabled className="mt-auto w-full py-4 bg-neutral-200 dark:bg-neutral-800 text-neutral-400 font-bold rounded-2xl cursor-not-allowed text-sm uppercase tracking-widest">
                  {t('downloads_page.unavailable', 'Indisponível')}
                </button>
              )}
              {linuxAsset && <p className="text-xs text-neutral-400 mt-4 font-mono">{formatSize(linuxAsset.size)}</p>}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
