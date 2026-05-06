import { Database, ShieldCheck, Layers } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { HeroActions } from '@/components/landing/HeroActions'
import Link from 'next/link'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 bg-gradient-to-b from-neutral-900 to-black text-white relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[25%] -left-[10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-[25%] -right-[10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-500/5 rounded-full blur-[100px]"></div>
      </div>

      <Navbar user={user} />

      <div className="z-10 max-w-5xl w-full flex flex-col gap-12 mt-12">
        <div className="flex flex-col gap-6 text-center md:text-left max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] uppercase tracking-wider font-bold w-fit self-center md:self-start">
            <ShieldCheck className="w-3.5 h-3.5" />
            Next-Gen Metadata Engine
          </div>
          
          <h1 className="text-5xl md:text-8xl font-extrabold tracking-tighter leading-[1] py-2">
            Build apps <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500">at DB speed.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-neutral-400 leading-relaxed max-w-2xl">
            The ultimate engine for generating dynamic, database-driven CRUD applications 
            without ever touching physical file generation. Connect your enterprise DB securely.
          </p>

          <HeroActions user={user} />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-12">
          {[
            { 
              title: "Dynamic Schemas", 
              desc: "Introspect your database and map schemas in real-time. No manual mapping required.",
              icon: <Database className="w-6 h-6 text-blue-400" />
            },
            { 
              title: "No Code Gen", 
              desc: "Run your entire CRUD via metadata engine dynamically. Changes reflect instantly.",
              icon: <Layers className="w-6 h-6 text-indigo-400" />
            },
            { 
              title: "Enterprise Ready", 
              desc: "Local CLI agents to connect to on-premise databases (Oracle, SAP) securely.",
              icon: <ShieldCheck className="w-6 h-6 text-emerald-400" />
            },
          ].map((feature, i) => (
            <div key={i} className="group p-8 border border-neutral-800 rounded-[2rem] bg-neutral-900/40 hover:bg-neutral-800/40 hover:border-neutral-700 transition-all duration-500 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="mb-6 p-4 bg-neutral-950 rounded-2xl w-fit border border-neutral-800 group-hover:border-neutral-700 group-hover:scale-110 transition-all duration-500 shadow-inner">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3 text-neutral-100 group-hover:text-white transition-colors">{feature.title}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed group-hover:text-neutral-300 transition-colors">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="mt-32 w-full max-w-7xl border-t border-neutral-800/50 pt-12 pb-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          {/* Logo Section */}
          <div className="flex items-center gap-2 group cursor-default opacity-80 hover:opacity-100 transition-opacity">
            <div className="p-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <Layers className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              MetaBuilder<span className="text-blue-500">PRO</span>
            </span>
          </div>

          {/* Development Info */}
          <div className="text-[10px] md:text-[11px] text-neutral-500 font-medium text-center tracking-wider uppercase">
            Desenvolvido por <Link href="/agtech" className="text-blue-500 hover:text-blue-400 font-bold hover:underline underline-offset-4 transition-all">AGTECH ®</Link> — | <span className="text-neutral-400">MetadataTech de Alta Performance © 2026</span> Todos os direitos reservados.
          </div>

          {/* Legal Links */}
          <div className="flex gap-8 items-center">
            <Link href="/privacy" className="text-xs font-bold text-neutral-400 hover:text-white transition-colors tracking-widest uppercase">Privacidade</Link>
            <Link href="/terms" className="text-xs font-bold text-neutral-400 hover:text-white transition-colors tracking-widest uppercase">Termos</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
