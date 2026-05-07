'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  ShieldCheck, 
  Database, 
  Users, 
  Save, 
  Network,
  Fingerprint
} from 'lucide-react'
import Link from 'next/link'

export default function AuthSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const { workspace_slug, project_slug } = params

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [project, setProject] = useState<any>(null)
  const [models, setModels] = useState<any[]>([])
  
  const [authConfig, setAuthConfig] = useState({
    auth_type: 'managed',
    db_table_name: '',
    db_email_column: '',
    db_password_column: '',
    db_password_hash_type: 'bcrypt',
    ldap_server_url: '',
    ldap_base_dn: ''
  })

  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      // Resolve Project
      const { data: proj } = await supabase
        .from('projects')
        .select('id')
        .eq('slug', project_slug)
        .single()
      
      if (proj) {
        setProject(proj)

        // Load existing config
        const { data: config } = await supabase
          .from('project_auth_config')
          .select('*')
          .eq('project_id', proj.id)
          .single()

        if (config) {
          setAuthConfig(config)
        }

        // Load models for the "Database" option dropdowns
        const { data: modelsData } = await supabase
          .from('models')
          .select('*, fields(*)')
          .eq('project_id', proj.id)
        
        if (modelsData) setModels(modelsData)
      }
      setIsLoading(false)
    }

    loadData()
  }, [project_slug, supabase])

  const handleSave = async () => {
    if (!project) return
    setIsSaving(true)
    
    try {
      const { error } = await supabase
        .from('project_auth_config')
        .upsert({
          project_id: project.id,
          ...authConfig
        })

      if (error) throw error
      setIsSuccess(true)
      setTimeout(() => setIsSuccess(false), 2500)
    } catch (err: any) {
      console.error(err)
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Carregando Configurações...</div>

  // Helper to get fields of selected table
  const selectedModel = models.find(m => m.db_table_name === authConfig.db_table_name)
  const fields = selectedModel?.fields || []

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      
      <nav className="h-16 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link href={`/admin/${workspace_slug}/${project_slug}/studio`} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-neutral-800 mx-1"></div>
          <div>
            <h1 className="text-sm font-bold text-white">Identidade e Acesso (Consumidores)</h1>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving || isSuccess}
          className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold transition-all ${isSuccess ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]'}`}
        >
          {isSaving ? 'Salvando...' : isSuccess ? 'Salvo com sucesso!' : <><Save className="w-4 h-4" /> Salvar Configurações</>}
        </button>
      </nav>

      <main className="max-w-5xl mx-auto p-10 space-y-12">
        
        <section className="space-y-4">
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Fingerprint className="w-8 h-8 text-indigo-500" />
            Estratégia de Autenticação
          </h2>
          <p className="text-neutral-500">Escolha como os usuários finais farão login na sua aplicação.</p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={() => setAuthConfig({...authConfig, auth_type: 'managed'})}
            className={`p-6 border rounded-3xl text-left transition-all ${authConfig.auth_type === 'managed' ? 'bg-indigo-600/10 border-indigo-500' : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'}`}
          >
            <Users className={`w-8 h-8 mb-4 ${authConfig.auth_type === 'managed' ? 'text-indigo-400' : 'text-neutral-500'}`} />
            <h3 className="font-bold text-lg">Managed Auth</h3>
            <p className="text-sm text-neutral-500 mt-2">O MetaBuilder gerencia os usuários em um banco isolado. Rápido e fácil.</p>
          </button>

          <button 
            onClick={() => setAuthConfig({...authConfig, auth_type: 'database'})}
            className={`p-6 border rounded-3xl text-left transition-all ${authConfig.auth_type === 'database' ? 'bg-indigo-600/10 border-indigo-500' : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'}`}
          >
            <Database className={`w-8 h-8 mb-4 ${authConfig.auth_type === 'database' ? 'text-indigo-400' : 'text-neutral-500'}`} />
            <h3 className="font-bold text-lg">Via Banco Legado</h3>
            <p className="text-sm text-neutral-500 mt-2">O Agente CLI valida o login batendo na SUA tabela de usuários sincronizada.</p>
          </button>

          <button 
            onClick={() => setAuthConfig({...authConfig, auth_type: 'ldap'})}
            className={`p-6 border rounded-3xl text-left transition-all ${authConfig.auth_type === 'ldap' ? 'bg-indigo-600/10 border-indigo-500' : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'}`}
          >
            <Network className={`w-8 h-8 mb-4 ${authConfig.auth_type === 'ldap' ? 'text-indigo-400' : 'text-neutral-500'}`} />
            <h3 className="font-bold text-lg">LDAP / AD</h3>
            <p className="text-sm text-neutral-500 mt-2">Integração corporativa nativa. Validação via Active Directory do cliente.</p>
          </button>
        </div>

        {/* Formulário Dinâmico dependendo do Tipo de Auth */}
        <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl mt-8">
          
          {authConfig.auth_type === 'managed' && (
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
              <ShieldCheck className="w-16 h-16 text-indigo-500/50" />
              <div>
                <h3 className="text-xl font-bold">Banco de Usuários Pronto!</h3>
                <p className="text-neutral-500 max-w-md mt-2">Nós criaremos automaticamente a tabela e as APIs de login e cadastro. Nenhuma configuração adicional é necessária.</p>
              </div>
            </div>
          )}

          {authConfig.auth_type === 'database' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold border-b border-neutral-800 pb-4">Mapeamento de Banco Legado</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-neutral-500 uppercase">Tabela de Usuários</label>
                  <select 
                    value={authConfig.db_table_name || ''}
                    onChange={(e) => setAuthConfig({...authConfig, db_table_name: e.target.value})}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 mt-1 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="">Selecione a tabela...</option>
                    {models.map(m => (
                      <option key={m.id} value={m.db_table_name}>{m.db_table_name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase">Coluna de Login (Email/Usuário)</label>
                    <select 
                      value={authConfig.db_email_column || ''}
                      onChange={(e) => setAuthConfig({...authConfig, db_email_column: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 mt-1 text-sm outline-none focus:border-indigo-500"
                    >
                      <option value="">Selecione o campo...</option>
                      {fields.map((f: any) => (
                        <option key={f.id} value={f.db_column_name}>{f.db_column_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase">Coluna de Senha</label>
                    <select 
                      value={authConfig.db_password_column || ''}
                      onChange={(e) => setAuthConfig({...authConfig, db_password_column: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 mt-1 text-sm outline-none focus:border-indigo-500"
                    >
                      <option value="">Selecione o campo...</option>
                      {fields.map((f: any) => (
                        <option key={f.id} value={f.db_column_name}>{f.db_column_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-neutral-500 uppercase">Formato do Hash da Senha</label>
                  <select 
                    value={authConfig.db_password_hash_type || 'bcrypt'}
                    onChange={(e) => setAuthConfig({...authConfig, db_password_hash_type: e.target.value})}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 mt-1 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="bcrypt">Bcrypt (Recomendado)</option>
                    <option value="md5">MD5 (Legado)</option>
                    <option value="sha256">SHA-256</option>
                    <option value="plain">Texto Plano (Não recomendado)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {authConfig.auth_type === 'ldap' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold border-b border-neutral-800 pb-4">Conexão LDAP</h3>
              <p className="text-sm text-neutral-500">O Agente CLI usará essas credenciais para tentar autenticar na rede local da empresa.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-neutral-500 uppercase">Servidor LDAP (URL)</label>
                  <input 
                    type="text"
                    placeholder="ldap://servidor.empresa.local:389"
                    value={authConfig.ldap_server_url || ''}
                    onChange={(e) => setAuthConfig({...authConfig, ldap_server_url: e.target.value})}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 mt-1 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-500 uppercase">Base DN</label>
                  <input 
                    type="text"
                    placeholder="dc=empresa,dc=local"
                    value={authConfig.ldap_base_dn || ''}
                    onChange={(e) => setAuthConfig({...authConfig, ldap_base_dn: e.target.value})}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 mt-1 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
