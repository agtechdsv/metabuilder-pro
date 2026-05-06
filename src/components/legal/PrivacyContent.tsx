import { ShieldCheck, Database, EyeOff, Lock } from 'lucide-react'

const sections = [
  {
    icon: <Database className="w-4 h-4" />,
    title: "Informações que Coletamos",
    content: "Ao utilizar o login ou preencher suas credenciais BYODB, coletamos apenas os dados essenciais (nome, e-mail e chaves de infraestrutura) para fins de autenticação e funcionamento técnico do sistema."
  },
  {
    icon: <Lock className="w-4 h-4" />,
    title: "Uso dos Dados",
    content: "Seus dados são utilizados exclusivamente para autenticar seu acesso, sincronizar seus registros de forma privada em sua própria estrutura (Supabase) e permitir a interação com a inteligência artificial da engine."
  },
  {
    icon: <EyeOff className="w-4 h-4" />,
    title: "Armazenamento Local",
    content: "Importante: Suas chaves de API e metadados sensíveis são gerenciados localmente pelo CLI Agent e nunca são enviados aos nossos servidores centrais. Isso garante soberania total sobre seus dados."
  },
  {
    icon: <ShieldCheck className="w-4 h-4" />,
    title: "Cookies e Segurança",
    content: "Utilizamos apenas cookies estritamente necessários para manter sua sessão ativa e salvar suas preferências de tema (Dark Mode). Toda comunicação é criptografada via TLS 1.3."
  }
]

export function PrivacyContent() {
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
