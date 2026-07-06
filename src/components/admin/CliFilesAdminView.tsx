'use client'

import { useState, useEffect } from 'react'
import { IdeUpdaterButton } from '@/components/runtime/IdeUpdaterButton'
import { createClient } from '@/utils/supabase/client'
import { Download, Upload, Trash2, File as FileIcon, Loader2, X, Check, Filter } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export function CliFilesAdminView() {
  const [files, setFiles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showOlderReleases, setShowOlderReleases] = useState(false)
  const [localVersion, setLocalVersion] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [releaseNotesList, setReleaseNotesList] = useState<any[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, bucketPath: string, name: string, category: string } | null>(null)

  // Filter state
  const [filter, setFilter] = useState<'all' | 'cli-win' | 'cli-linux' | 'template' | 'manual' | 'ide-win' | 'ide-mac' | 'ide-linux'>('all')

  // Form state
  const [uploadForm, setUploadForm] = useState({
    name: '',
    category: 'cli-win',
    version: '',
    isActive: true,
    file: null as File | null
  })

  const supabase = createClient()
  const { toast } = useToast()

  const fetchFiles = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('app_downloads')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      toast('Erro ao carregar arquivos: ' + error.message, 'error')
    } else {
      setFiles(data || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchFiles()
    
    // Fetch release notes and local version for Auto Updater
    fetch('/api/releases')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setReleaseNotesList(data)
      })

    const checkVersion = async () => {
      const { isTauri } = await import('@tauri-apps/api/core')
      if (!isTauri()) {
        setLocalVersion('Web App Edition')
        return
      }
      try {
        const { getVersion } = await import('@tauri-apps/api/app')
        const v = await getVersion()
        setLocalVersion(`IDE Engine v${v}`)
      } catch (e: any) {
        setLocalVersion(`Erro: ${e.message || String(e)}`)
      }
    }
    checkVersion()
  }, [])

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadForm.file || !uploadForm.name || !uploadForm.version) {
      toast('Preencha todos os campos e selecione um arquivo.', 'error')
      return
    }

    setIsUploading(true)

    // 1. Upload to Storage
    // Format path: cli/v1.0.0/filename or template/v1.0.0/filename
    const folderName = uploadForm.category.startsWith('cli') ? 'cli' : uploadForm.category
    const bucketPath = `${folderName}/v${uploadForm.version}/${uploadForm.file.name}`

    const { error: uploadError } = await supabase.storage
      .from('releases')
      .upload(bucketPath, uploadForm.file, {
        upsert: true
      })

    if (uploadError) {
      toast('Erro ao fazer upload no bucket: ' + uploadError.message, 'error')
      setIsUploading(false)
      return
    }

    // 2. Insert into Database
    const { error: dbError } = await supabase
      .from('app_downloads')
      .insert([{
        name: uploadForm.name,
        category: uploadForm.category,
        version: uploadForm.version,
        bucket_path: bucketPath,
        size_bytes: uploadForm.file.size,
        is_active: uploadForm.isActive
      }])

    if (dbError) {
      toast('Erro ao salvar no banco de dados: ' + dbError.message, 'error')
    } else {
      toast('Arquivo enviado e cadastrado com sucesso!', 'success')
      setShowModal(false)
      setUploadForm({ name: '', category: 'cli-win', version: '', isActive: true, file: null })
      fetchFiles()
    }
    setIsUploading(false)
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('app_downloads')
      .update({ is_active: !currentStatus })
      .eq('id', id)

    if (error) {
      toast('Erro ao atualizar status: ' + error.message, 'error')
    } else {
      toast('Status atualizado com sucesso.', 'success')
      setFiles(files.map(f => f.id === id ? { ...f, is_active: !currentStatus } : f))
    }
  }

  const handleDeleteClick = (id: string, bucketPath: string, name: string, category: string) => {
    setDeleteConfirm({ id, bucketPath, name, category })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    setIsLoading(true)
    const { id, bucketPath, category } = deleteConfirm
    setDeleteConfirm(null)

    // 1. Delete from storage
    await supabase.storage.from('releases').remove([bucketPath])

    // 2. Delete from DB
    const { error } = await supabase.from('app_downloads').delete().eq('id', id)

    if (!error && category.startsWith('ide-')) {
      try {
        toast('Excluindo assets do GitHub...', 'info')
        await fetch(`/api/admin/release/assets?category=${category}`, { method: 'DELETE' })
      } catch (e) {
        console.error('Failed to delete github assets', e)
      }
    }

    if (error) {
      toast('Erro ao excluir do banco de dados: ' + error.message, 'error')
    } else {
      toast('Arquivo excluído com sucesso.', 'success')
      fetchFiles()
    }
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

  const filteredFiles = files.filter(f => filter === 'all' || f.category === filter)

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-black p-8 pt-10">
      <div className="max-w-5xl mx-auto w-full space-y-6">

        {releaseNotesList.length > 0 && localVersion && (
          (() => {
            const installed = localVersion.replace('IDE Engine v', '').trim()
            const latest = releaseNotesList[0].version.replace('v', '')
            const isOutdated = localVersion.startsWith('IDE Engine') && installed !== latest && installed !== 'Erro:' && !localVersion.includes('Erro')
            
            if (isOutdated) {
              return (
                <div className="relative flex items-center justify-center mb-10 z-10">
                  <button 
                    onClick={async () => {
                      try {
                        setIsUpdating(true)
                        const { check } = await import('@tauri-apps/plugin-updater')
                        const update = await check()
                        if (update) {
                          await update.downloadAndInstall()
                        }
                      } catch (e) {
                        console.error('Update failed', e)
                      } finally {
                        setIsUpdating(false)
                      }
                    }}
                    disabled={isUpdating}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-full shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
                  >
                    {isUpdating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Atualizar para a versão {latest}
                      </>
                    )}
                  </button>
                </div>
              )
            }
            return null
          })()
        )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-black text-neutral-900 dark:text-white">IDEs, Arquivos CLI & Manuais</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Gerencie os arquivos que seus clientes podem baixar na Central de Downloads.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 text-sm"
        >
          <Upload className="w-5 h-5" />
          Enviar Arquivo
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-500 dark:text-neutral-400">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Filtros:</span>
        </div>
        {[
          { id: 'all', label: 'Todos' },
          { id: 'ide-win', label: 'App (Windows)' },
          { id: 'ide-mac', label: 'App (macOS)' },
          { id: 'ide-linux', label: 'App (Linux)' },
          { id: 'cli-win', label: 'CLI Windows' },
          { id: 'cli-linux', label: 'CLI Linux' },
          { id: 'template', label: 'Templates' },
          { id: 'manual', label: 'Manuais' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === f.id
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
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Arquivo</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Categoria</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Versão</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Tamanho</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-center">Ativo?</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                </td>
              </tr>
            ) : filteredFiles.length > 0 ? (
              filteredFiles.map(file => (
                <tr key={file.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                      <FileIcon className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">{file.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
                      {getCategoryLabel(file.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    v{file.version}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {(file.size_bytes / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleToggleActive(file.id, file.is_active)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${file.is_active ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${file.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeleteClick(file.id, file.bucket_path, file.name, file.category)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-neutral-400 hover:text-red-500 rounded-lg transition-colors"
                      title="Excluir Arquivo"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Download className="w-8 h-8 text-neutral-400" />
                  </div>
                  <p className="text-sm font-bold text-neutral-500">Nenhum arquivo encontrado.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-xl font-black text-neutral-900 dark:text-white">Enviar Novo Arquivo</h3>
              <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">Nome do Arquivo (Exibição)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: CLI Windows - MetaBuilder"
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-white"
                  value={uploadForm.name}
                  onChange={e => setUploadForm({ ...uploadForm, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">Categoria</label>
                  <select
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-white"
                    value={uploadForm.category}
                    onChange={e => setUploadForm({ ...uploadForm, category: e.target.value })}
                  >
                    <option value="cli-win">CLI (Windows)</option>
                    <option value="cli-linux">CLI (Linux)</option>
                    <option value="template">Template JSON</option>
                    <option value="manual">Manual PDF</option>
                    <option value="ide-win">App Desktop (Windows)</option>
                    <option value="ide-mac">App Desktop (macOS)</option>
                    <option value="ide-linux">App Desktop (Linux)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">Versão</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 1.0.0"
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-white"
                    value={uploadForm.version}
                    onChange={e => setUploadForm({ ...uploadForm, version: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">Selecione o Arquivo</label>
                <input
                  type="file"
                  required
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  onChange={e => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                />
              </div>

              <label className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl cursor-pointer">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    className="peer w-6 h-6 rounded-md border-2 border-neutral-300 dark:border-neutral-600 appearance-none checked:bg-indigo-500 checked:border-indigo-500 transition-colors"
                    checked={uploadForm.isActive}
                    onChange={e => setUploadForm({ ...uploadForm, isActive: e.target.checked })}
                  />
                  <Check className="w-4 h-4 text-white absolute left-1 pointer-events-none opacity-0 peer-checked:opacity-100" />
                </div>
                <div>
                  <div className="text-sm font-bold text-neutral-900 dark:text-white">Deixar arquivo Ativo?</div>
                  <div className="text-xs text-neutral-500">Se marcado, aparecerá imediatamente para os clientes.</div>
                </div>
              </label>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-bold transition-all text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all text-sm disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  {isUploading ? 'Enviando...' : 'Salvar e Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-neutral-900 dark:text-white mb-2">Excluir Arquivo</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
              Tem certeza que deseja excluir <strong>{deleteConfirm.name}</strong>?<br />
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-6 py-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-bold transition-all text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all text-sm"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
