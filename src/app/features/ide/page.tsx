import { Server, Database, Key, CheckCircle2, ShieldCheck, Network, Cpu, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { TranslationProvider } from '@/i18n/TranslationProvider'
import { getTranslations } from '@/i18n/get-translations'
import { getLocale } from '@/i18n/get-locale'

export default async function IDEFeaturePage() {
  const locale = await getLocale()
  const t = await getTranslations(locale)

  const features = [
    {
      title: t('ide_landing.features.tunnel.title'),
      desc: t('ide_landing.features.tunnel.desc'),
      icon: <Network className="w-6 h-6 text-indigo-500" />
    },
    {
      title: t('ide_landing.features.config.title'),
      desc: t('ide_landing.features.config.desc'),
      icon: <Server className="w-6 h-6 text-emerald-500" />
    },
    {
      title: t('ide_landing.features.ldap.title'),
      desc: t('ide_landing.features.ldap.desc'),
      icon: <Key className="w-6 h-6 text-purple-500" />
    }
  ]

  return (
    <TranslationProvider>
      <main className="flex-grow flex flex-col items-center relative z-10 w-full max-w-7xl mx-auto px-6 py-20">
        {/* Background Glow */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[140px]"></div>
          <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-purple-500/20 rounded-full blur-[140px]"></div>
        </div>

        <div className="text-center max-w-4xl mx-auto mb-20 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold text-sm mb-6 border border-indigo-200 dark:border-indigo-800">
            <Cpu className="w-4 h-4" />
            MetaBuilderPRO IDE
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black mb-8 leading-tight tracking-tight text-neutral-900 dark:text-white">
            {t('ide_landing.hero.title')}
          </h1>
          
          <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('ide_landing.hero.subtitle')}
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link 
              href="/login" 
              className="group relative px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl hover:shadow-indigo-500/30 transition-all flex items-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
              Criar Workspace Grátis
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          {features.map((feature, idx) => (
            <div 
              key={idx} 
              className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 hover:scale-[1.02] hover:shadow-2xl transition-all duration-300 relative group overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
              
              <div className="w-14 h-14 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Product Preview Image / Mockup area */}
        <div className="mt-32 w-full flex flex-col items-center">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-black mb-4">Painel de Controle Visual</h2>
            <p className="text-neutral-500">Esqueça edições de arquivos perigosas e servidores invisíveis.</p>
          </div>
          
          <div className="w-full max-w-5xl aspect-video bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl relative overflow-hidden flex items-center justify-center group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 z-0" />
            
            {/* The actual screenshot the user will place in public/ */}
            <img 
              src="/ide-tunnel-preview.png" 
              alt="MetaBuilder IDE Tunnel Control Panel" 
              className="w-full h-full object-cover relative z-10 group-hover:scale-[1.02] transition-transform duration-700 ease-out"
              onError={(e) => {
                // Fallback to Network icon if image not found
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
              }}
            />
            
            <div className="fallback-icon hidden absolute z-0 flex items-center justify-center">
              <Network className="w-20 h-20 text-neutral-300 dark:text-neutral-700 group-hover:scale-110 transition-transform duration-500" />
            </div>
          </div>
        </div>
      </main>
    </TranslationProvider>
  )
}
