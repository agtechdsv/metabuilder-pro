'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Download, File as FileIcon, Loader2, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export function CliFilesClientView() {
  const [files, setFiles] = useState<any[]>([])
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
      setFiles((data || []).filter(f => f.name !== '.emptyFolderPlaceholder'))
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const handleDownload = async (fileName: string) => {
    const { data, error } = await supabase.storage.from('cli_downloads').createSignedUrl(fileName, 60 * 60) // 1 hour
    if (error || !data) {
      toast('Erro ao gerar link de download.', 'error')
    } else {
      window.open(data.signedUrl, '_blank')
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex justify-between items-start">
        <div>
          <h2 className="text-xl font-black text-neutral-900 dark:text-white">Central de Downloads</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Baixe aqui o CLI (Windows/Linux), Manuais em PDF e Templates JSON.</p>
        </div>
        <button
          onClick={() => fetchFiles()}
          disabled={isLoading}
          title="Atualizar lista"
          className="p-2 text-neutral-500 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex items-center justify-center disabled:opacity-50 group active:scale-95 duration-200"
        >
          <RefreshCw className={`w-4 h-4 transition-transform duration-500 ease-out ${isLoading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
        </button>
      </div>
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Nome do Arquivo</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Tamanho</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">Download</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="p-12 text-center">
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
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDownload(file.name)}
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
                <td colSpan={3} className="p-12 text-center">
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
    </div>
  )
}
