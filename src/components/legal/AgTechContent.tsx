'use client'

import { Mail, Zap } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

export function AgTechContent() {
  const { t } = useI18n()

  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <p className="text-sm text-neutral-400 leading-relaxed">
          A <span className="text-white font-bold">AGTech</span> é um laboratório de inovação e engenharia de software focado no desenvolvimento de <span className="text-indigo-400 font-bold">MetadataTechs</span> de alta performance.
        </p>
        
        <p className="text-sm text-neutral-400 leading-relaxed">
          Nossa missão é construir a infraestrutura tecnológica invisível que permite aos grandes projetos operarem com máxima eficiência, segurança e inteligência de dados.
        </p>
        
        <p className="text-sm text-neutral-400 leading-relaxed">
          Combinamos arquiteturas robustas com um design centrado na experiência do usuário para entregar ferramentas que realmente transformam a rotina tecnológica.
        </p>
      </div>

      <div className="space-y-6">
        <div className="text-center space-y-2">
          <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block">
            Quer elevar o nível tecnológico do seu projeto?
          </span>
          <div className="h-px w-12 bg-indigo-500/30 mx-auto" />
        </div>
        
        <a 
          href="mailto:engenharia@agtech.com"
          className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-2xl shadow-indigo-600/30 active:scale-[0.98] group"
        >
          <Mail className="w-4 h-4 group-hover:scale-110 transition-transform" />
          Fale com nossos engenheiros
        </a>
      </div>
    </div>
  )
}

