import { FileText, Gavel, UserCheck, AlertTriangle } from 'lucide-react'

const sections = [
  {
    icon: <FileText className="w-4 h-4" />,
    title: "Aceitação dos Termos",
    content: "Ao acessar este aplicativo, você concorda em cumprir estes termos de serviço e todas as leis aplicáveis ao exercício de desenvolvimento e proteção de dados (LGPD)."
  },
  {
    icon: <Gavel className="w-4 h-4" />,
    title: "Isenção de Responsabilidade",
    content: "O MetaBuilderPRO é uma ferramenta de automação e auxílio técnico. As decisões de arquitetura e implementação final devem ser obrigatoriamente revisadas por um desenvolvedor humano responsável."
  },
  {
    icon: <UserCheck className="w-4 h-4" />,
    title: "Uso da Conta e BYODB",
    content: "O acesso é pessoal e intransferível. O usuário é o único responsável pela segurança de suas chaves de API e credenciais de banco de dados (Bring Your Own Database)."
  },
  {
    icon: <AlertTriangle className="w-4 h-4" />,
    title: "Propriedade Intelectual",
    content: "Todo o design e marca MetaBuilderPRO são de propriedade da AGTech. O código gerado pela engine em sua infraestrutura permanece de sua posse e responsabilidade."
  }
]

export function TermsContent() {
  return (
    <div className="space-y-6">
      {sections.map((section, idx) => (
        <div key={idx} className="flex gap-4 group">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-[0_0_15px_rgba(37,99,235,0.4)] group-hover:scale-110 transition-transform">
            {idx + 1}
          </div>
          <div className="space-y-1.5">
            <h3 className="text-white font-bold text-base tracking-tight flex items-center gap-2">
              <span className="text-blue-400 opacity-50">{section.icon}</span>
              {section.title}
            </h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              {section.content}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
