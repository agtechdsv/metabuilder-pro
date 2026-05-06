import { PrivacyContent } from '@/components/legal/PrivacyContent'
import { Layers } from 'lucide-react'
import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white p-8 md:p-24 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="max-w-3xl mx-auto space-y-12 relative z-10">
        <Link href="/" className="flex items-center gap-2 w-fit group">
          <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 group-hover:bg-blue-500/20 transition-all">
            <Layers className="w-6 h-6 text-blue-500" />
          </div>
          <span className="text-xl font-bold tracking-tight">MetaBuilder<span className="text-blue-500">PRO</span></span>
        </Link>
        
        <div className="space-y-4">
          <h1 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500">Política de Privacidade</h1>
          <p className="text-neutral-500 font-medium">Documento Oficial v2.0 • Última atualização: Maio 2026</p>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-[2.5rem] backdrop-blur-sm shadow-2xl">
          <PrivacyContent />
        </div>

        <div className="flex justify-center pt-8">
           <Link href="/" className="bg-neutral-800 hover:bg-neutral-700 text-white px-8 py-3 rounded-xl font-bold transition-all border border-neutral-700">
             Voltar para Início
           </Link>
        </div>
      </div>
    </main>
  )
}
