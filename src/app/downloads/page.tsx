import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Download, Monitor, Apple, Terminal } from 'lucide-react'
import Link from 'next/link'

const OWNER = 'agtechdsv'
const REPO = 'metabuilder-pro'

async function getLatestRelease() {
  try {
    const token = process.env.GITHUB_PAT
    if (!token) return null

    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      next: { revalidate: 60 }
    })

    if (!res.ok) return null

    const data = await res.json()
    return {
      version: data.tag_name,
      name: data.name,
      published_at: data.published_at,
      assets: data.assets?.map((a: any) => ({
        name: a.name,
        browser_download_url: a.browser_download_url,
        size: a.size
      })) || []
    }
  } catch (error) {
    console.error('Error fetching latest release:', error)
    return null
  }
}

export default async function DownloadsPage() {
  const release = await getLatestRelease()
  const assets = release?.assets || []

  const winAsset = assets.find((a: any) => a.name.endsWith('.exe'))
  const macAsset = assets.find((a: any) => a.name.endsWith('.dmg'))
  const linuxAsset = assets.find((a: any) => a.name.endsWith('.AppImage'))

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
              Downloads
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight text-neutral-900 dark:text-white">
              Baixe a MetaBuilder IDE
            </h1>
            
            <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed font-medium">
              Acesse a infraestrutura da sua máquina localmente com todo o poder da nuvem. Crie sua conta gratuitamente pelo próprio aplicativo.
            </p>
            
            {release && (
              <p className="mt-6 text-sm text-neutral-500 font-medium bg-neutral-100 dark:bg-neutral-900 inline-block px-4 py-2 rounded-full border border-neutral-200 dark:border-neutral-800">
                Versão atual: <span className="font-bold">{release.version}</span> • {new Date(release.published_at).toLocaleDateString()}
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
              <p className="text-sm text-neutral-500 mb-8">Windows 10 ou superior (64-bit)</p>
              
              {winAsset ? (
                <a href={winAsset.browser_download_url} className="mt-auto w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 text-sm uppercase tracking-widest">
                  Baixar para Windows
                </a>
              ) : (
                <button disabled className="mt-auto w-full py-4 bg-neutral-200 dark:bg-neutral-800 text-neutral-400 font-bold rounded-2xl cursor-not-allowed text-sm uppercase tracking-widest">
                  Indisponível
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
              <p className="text-sm text-neutral-500 mb-8">macOS 11+ (Intel & Apple Silicon)</p>
              
              {macAsset ? (
                <a href={macAsset.browser_download_url} className="mt-auto w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 text-sm uppercase tracking-widest">
                  Baixar para Mac
                </a>
              ) : (
                <button disabled className="mt-auto w-full py-4 bg-neutral-200 dark:bg-neutral-800 text-neutral-400 font-bold rounded-2xl cursor-not-allowed text-sm uppercase tracking-widest">
                  Indisponível
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
              <p className="text-sm text-neutral-500 mb-8">Ubuntu, Debian, Fedora (AppImage)</p>
              
              {linuxAsset ? (
                <a href={linuxAsset.browser_download_url} className="mt-auto w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 text-sm uppercase tracking-widest">
                  Baixar para Linux
                </a>
              ) : (
                <button disabled className="mt-auto w-full py-4 bg-neutral-200 dark:bg-neutral-800 text-neutral-400 font-bold rounded-2xl cursor-not-allowed text-sm uppercase tracking-widest">
                  Indisponível
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
