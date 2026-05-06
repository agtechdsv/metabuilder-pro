import { Cpu, Mail, ExternalLink } from 'lucide-react'

export function AgTechContent() {
  return (
    <div className="space-y-8 text-neutral-300">
      <div className="space-y-6">
        <p className="text-base leading-relaxed">
          A <strong className="text-blue-400">AGTech</strong> é um laboratório de inovação e engenharia de software focado no desenvolvimento de <strong className="text-white">MetadataTechs de alta performance</strong>.
        </p>
        
        <p className="text-base leading-relaxed">
          Nossa missão é construir a <strong className="text-white">infraestrutura tecnológica invisível</strong> que permite a <strong className="text-white">ecossistemas complexos</strong> operarem com máxima eficiência, segurança e inteligência de dados.
        </p>
        
        <p className="text-base leading-relaxed">
          Combinamos arquiteturas robustas com um design centrado na experiência do usuário para entregar ferramentas que realmente transformam a rotina operacional.
        </p>
      </div>

      <div className="pt-6 border-t border-neutral-800 space-y-4">
        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] text-center">
          Quer elevar o nível tecnológico do seu projeto?
        </p>
        
        <a 
          href="mailto:contato@agtech.com"
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-900/20 active:scale-[0.98] group"
        >
          <Mail className="w-5 h-5 group-hover:scale-110 transition-transform" />
          FALE COM NOSSOS ENGENHEIROS
        </a>
      </div>
    </div>
  )
}
