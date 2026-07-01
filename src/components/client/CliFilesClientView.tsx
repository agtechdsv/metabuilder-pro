'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Download, File as FileIcon, Loader2, RefreshCw, Filter, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Project {
  id: string
  name: string
  secret_token?: string
}

interface CliFilesClientViewProps {
  projects?: Project[]
}

export function CliFilesClientView({ projects = [] }: CliFilesClientViewProps) {
  const [files, setFiles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Tab & Filter state
  const [mainTab, setMainTab] = useState<'ide' | 'utils'>('ide')
  const [filter, setFilter] = useState<'all' | 'cli-win' | 'cli-linux' | 'template' | 'manual' | 'ide-win' | 'ide-mac' | 'ide-linux'>('all')

  // Modal state
  const [downloadModalFile, setDownloadModalFile] = useState<any | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  
  // DB config state
  const [dbType, setDbType] = useState('postgres')
  const [dbHost, setDbHost] = useState('localhost')
  const [dbPort, setDbPort] = useState('5432')
  const [dbName, setDbName] = useState('')
  const [dbUser, setDbUser] = useState('')
  const [dbPass, setDbPass] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  const fetchFiles = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('app_downloads')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      toast('Erro ao carregar arquivos disponíveis: ' + error.message, 'error')
    } else {
      setFiles(data || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const handleDownloadClick = async (file: any) => {
    if (file.category === 'template') {
      setDownloadModalFile(file)
    } else {
      // Normal download
      const { data, error } = await supabase.storage.from('releases').createSignedUrl(file.bucket_path, 60 * 60)
      if (error || !data) {
        toast('Erro ao gerar link de download.', 'error')
      } else {
        window.open(data.signedUrl, '_blank')
      }
    }
  }

  const processTemplateDownload = async () => {
    if (!downloadModalFile) return
    setIsDownloading(true)
    try {
      // 1. Get signed URL
      const { data, error } = await supabase.storage.from('releases').createSignedUrl(downloadModalFile.bucket_path, 60 * 60)
      if (error || !data) throw error

      // 2. Fetch file content
      const response = await fetch(data.signedUrl)
      const jsonContent = await response.json()

      // 3. Inject Project Data
      const selectedProject = projects.find(p => p.id === selectedProjectId)
      if (selectedProject) {
        if (jsonContent.connections && jsonContent.connections.length > 0) {
          jsonContent.connections[0].projectId = selectedProject.id
          if (selectedProject.secret_token) {
            jsonContent.connections[0].secretToken = selectedProject.secret_token
          }
        }
      }

      // 4. Inject DB Data
      if (dbName && dbUser) { // only inject if user typed something
        let connectionString = ''
        if (dbType === 'postgres') {
          const passPart = dbPass ? `:${dbPass}` : ''
          connectionString = `postgresql://${dbUser}${passPart}@${dbHost}:${dbPort}/${dbName}`
        } else if (dbType === 'mysql') {
          const passPart = dbPass ? `:${dbPass}` : ''
          connectionString = `mysql://${dbUser}${passPart}@${dbHost}:${dbPort}/${dbName}`
        } else if (dbType === 'sqlserver') {
          const passPart = dbPass ? `Password=${dbPass};` : ''
          connectionString = `Server=${dbHost},${dbPort};Database=${dbName};User Id=${dbUser};${passPart}Encrypt=True;TrustServerCertificate=True;`
        }

        if (jsonContent.connections && jsonContent.connections.length > 0) {
          if (jsonContent.connections[0].connectionsString && jsonContent.connections[0].connectionsString.length > 0) {
             jsonContent.connections[0].connectionsString[0].name = 'erp'
             jsonContent.connections[0].connectionsString[0].type = dbType
             jsonContent.connections[0].connectionsString[0].connectionString = connectionString
          }
        }
      }

      // 5. Trigger Download
      const blob = new Blob([JSON.stringify(jsonContent, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'metabuilder.config.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast('Template baixado com sucesso!', 'success')
      setDownloadModalFile(null)
    } catch (err: any) {
      console.error(err)
      toast('Erro ao processar template: ' + err.message, 'error')
    }
    setIsDownloading(false)
  }

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'cli-win': return 'CLI (Windows)'
      case 'cli-linux': return 'CLI (Linux)'
      case 'template': return 'Template JSON'
      case 'manual': return 'Manual PDF'
      case 'ide-win': return 'App (Windows)'
      case 'ide-mac': return 'App (macOS)'
      case 'ide-linux': return 'App (Linux)'
      default: return cat
    }
  }

  const filteredFiles = files.filter(f => {
    const isIde = ['ide-win', 'ide-mac', 'ide-linux'].includes(f.category);
    if (mainTab === 'ide' && !isIde) return false;
    if (mainTab === 'utils' && isIde) return false;
    
    if (filter === 'all') return true;
    return f.category === filter;
  });

  // Sync default port when dbType changes
  useEffect(() => {
    if (dbType === 'postgres') setDbPort('5432')
    else if (dbType === 'mysql') setDbPort('3306')
    else if (dbType === 'sqlserver') setDbPort('1433')
  }, [dbType])

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-neutral-900 dark:text-white">Central de Downloads</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Baixe aqui o CLI (Windows/Linux), Manuais em PDF e Templates JSON.</p>
        </div>
        <button
          onClick={() => fetchFiles()}
          disabled={isLoading}
          title="Atualizar lista"
          className="p-3 text-neutral-500 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400 bg-neutral-100 dark:bg-neutral-800 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex items-center justify-center disabled:opacity-50 group active:scale-95 duration-200"
        >
          <RefreshCw className={`w-5 h-5 transition-transform duration-500 ease-out ${isLoading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-4">
        <button
          onClick={() => { setMainTab('ide'); setFilter('all'); }}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${mainTab === 'ide' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300'}`}
        >
          App Desktop (IDE)
        </button>
        <button
          onClick={() => { setMainTab('utils'); setFilter('all'); }}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${mainTab === 'utils' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300'}`}
        >
          Utilitários (CLI & JSON)
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-500 dark:text-neutral-400">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Filtros:</span>
        </div>
        {(mainTab === 'ide' ? [
          { id: 'all', label: 'Todos' },
          { id: 'ide-win', label: 'Windows' },
          { id: 'ide-mac', label: 'macOS' },
          { id: 'ide-linux', label: 'Linux' }
        ] : [
          { id: 'all', label: 'Todos' },
          { id: 'cli-win', label: 'CLI Windows' },
          { id: 'cli-linux', label: 'CLI Linux' },
          { id: 'template', label: 'Templates' },
          { id: 'manual', label: 'Manuais' }
        ]).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              filter === f.id 
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' 
                : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Nome do Arquivo</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Categoria</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Tamanho</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">Download</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="p-12 text-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                </td>
              </tr>
            ) : filteredFiles.length > 0 ? (
              filteredFiles.map(file => (
                <tr key={file.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                      <FileIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-neutral-900 dark:text-white block">{file.name}</span>
                      <span className="text-xs font-medium text-neutral-500">v{file.version}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
                      {getCategoryLabel(file.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {(file.size_bytes / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDownloadClick(file)}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2 ml-auto"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar</span>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-12 text-center">
                  <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Download className="w-8 h-8 text-neutral-400" />
                  </div>
                  <p className="text-sm font-bold text-neutral-500">Nenhum arquivo disponível no momento.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Template Download Modal */}
      {downloadModalFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-neutral-900 dark:text-white">Configurar Template</h3>
              <button onClick={() => setDownloadModalFile(null)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">Vincular a um Projeto (Opcional)</label>
                <select 
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Baixar sem vincular</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-400">Ao selecionar, o arquivo já virá com o Project ID e Secret Token preenchidos.</p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">Conexão do Banco de Dados (Opcional)</label>
                <p className="text-[11px] text-neutral-400 mb-2">Preencha se quiser que a string de conexão já venha montada no JSON.</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={dbType}
                    onChange={(e) => setDbType(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="sqlserver">SQL Server</option>
                  </select>

                  <input 
                    type="text" placeholder="Host (ex: localhost)" 
                    value={dbHost} onChange={(e) => setDbHost(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <input 
                    type="text" placeholder="Porta (ex: 5432)" 
                    value={dbPort} onChange={(e) => setDbPort(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input 
                    type="text" placeholder="Database" 
                    className="col-span-2 w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={dbName} onChange={(e) => setDbName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="text" placeholder="Usuário" 
                    value={dbUser} onChange={(e) => setDbUser(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input 
                    type="password" placeholder="Senha" 
                    value={dbPass} onChange={(e) => setDbPass(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <button 
                onClick={processTemplateDownload}
                disabled={isDownloading}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {isDownloading ? 'Processando...' : 'Baixar Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
