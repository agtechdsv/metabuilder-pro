'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Download, Upload, Trash2, File as FileIcon, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export function CliFilesAdminView() {
  const [files, setFiles] = useState<any[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const { toast } = useToast()

  const fetchFiles = async () => {
    setIsLoading(true)
    const { data, error } = await supabase.storage.from('cli_downloads').list()
    if (error) {
      console.error(error)
      toast('Erro ao carregar arquivos: ' + error.message, 'error')
    } else {
      // Filtrar a pasta vazia padrão que o supabase retorna as vezes (.emptyFolderPlaceholder)
      setFiles((data || []).filter(f => f.name !== '.emptyFolderPlaceholder'))
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const { data, error } = await supabase.storage
      .from('cli_downloads')
      .upload(file.name, file, {
        upsert: true
      })

    if (error) {
      toast('Erro ao fazer upload: ' + error.message, 'error')
    } else {
      toast('Arquivo enviado com sucesso!', 'success')
      fetchFiles()
    }
    setIsUploading(false)
    e.target.value = ''
  }

  const handleDelete = async (fileName: string) => {
    if (!confirm(`Deseja mesmo excluir ${fileName}?`)) return
    
    const { error } = await supabase.storage.from('cli_downloads').remove([fileName])
    if (error) {
      toast('Erro ao excluir arquivo: ' + error.message, 'error')
    } else {
      toast('Arquivo excluído com sucesso.', 'success')
      fetchFiles()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-neutral-900 dark:text-white">Arquivos CLI & Manuais</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Faça o upload do CLI (Windows/Linux), Manuais em PDF e Templates JSON para seus clientes baixarem.</p>
        </div>
        <div>
          <label className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold cursor-pointer transition-all shadow-lg active:scale-95 text-sm">
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            {isUploading ? 'Enviando...' : 'Enviar Arquivo'}
            <input type="file" className="hidden" onChange={handleUpload} disabled={isUploading} />
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Nome do Arquivo</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Tamanho</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Última Modificação</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="p-12 text-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                </td>
              </tr>
            ) : files.length > 0 ? (
              files.map(file => (
                <tr key={file.id || file.name} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                      <FileIcon className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">{file.name}</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {(file.metadata?.size / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {new Date(file.created_at || file.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDelete(file.name)}
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
                <td colSpan={4} className="p-12 text-center">
                  <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Download className="w-8 h-8 text-neutral-400" />
                  </div>
                  <p className="text-sm font-bold text-neutral-500">Nenhum arquivo no repositório.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
