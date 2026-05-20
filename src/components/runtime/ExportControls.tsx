'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  FileJson, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ChevronDown,
  Minimize2,
  Maximize2,
  ExternalLink,
  File,
  Activity
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'

interface ExportDropdownProps {
  projectId: string
  workspaceSlug: string
  viewName: string
  modelName: string
  displayFields: any[]
  joins: any[]
  filters: Record<string, string>
  exportFormats?: string[]
  selectedRecord?: any
}

export function ExportDropdown({
  projectId,
  workspaceSlug,
  viewName,
  modelName,
  displayFields,
  joins,
  filters,
  exportFormats = ['xlsx', 'csv', 'json'],
  selectedRecord
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExport = async (fileType: 'xlsx' | 'csv' | 'json' | 'pdf' | 'ofx') => {
    setIsOpen(false)

    // LOCAL JSON EXPORT (Full Tree) when editing a record
    if (selectedRecord && fileType === 'json') {
      try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedRecord, null, 2))
        const downloadAnchorNode = document.createElement('a')
        downloadAnchorNode.setAttribute("href", dataStr)
        const cleanName = viewName.toLowerCase().replace(/[^a-z0-9]/g, '_')
        const recId = selectedRecord.id || selectedRecord.ID || 'record'
        downloadAnchorNode.setAttribute("download", `${cleanName}_${recId}.json`)
        document.body.appendChild(downloadAnchorNode)
        downloadAnchorNode.click()
        downloadAnchorNode.remove()
        toast('Árvore JSON do registro exportada com sucesso!', 'success')
      } catch (err) {
        toast('Erro ao exportar JSON da árvore de dados.', 'error')
      }
      return
    }

    setIsInitializing(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast('Você precisa estar logado para realizar exportações.', 'error')
        setIsInitializing(false)
        return
      }

      // Columns list mapped exactly as the SQL query generator
      const columnsList = displayFields.map(f => f.sql_expression || f.db_column_name)

      console.log('[Export] Triggering background export for type:', fileType)

      // Se estiver editando um registro específico, forçar o filtro no ID para o export do background (PDF, Excel, etc)
      let finalFilters = { ...filters }
      if (selectedRecord) {
        const pkName = selectedRecord.id ? 'id' : selectedRecord.ID ? 'ID' : null
        if (pkName) {
           finalFilters[pkName] = String(selectedRecord[pkName])
        }
      }

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          userId: user.id,
          workspaceSlug,
          viewName,
          modelName,
          fileType,
          columnsList,
          joins,
          filters: finalFilters
        })
      })

      const data = await response.json()

      if (response.status === 202 && data.success) {
        toast(`Os dados de "${viewName}" estão sendo processados em segundo plano.`, 'success')
      } else {
        throw new Error(data.error || 'Erro desconhecido ao iniciar exportação.')
      }

    } catch (err: any) {
      console.error('[Export] Client trigger failed:', err)
      toast(err.message || 'Não foi possível iniciar o processamento dos dados.', 'error')
    } finally {
      setIsInitializing(false)
    }
  }

  return (
    <div 
      className="relative" 
      ref={dropdownRef}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isInitializing}
        className="flex items-center gap-2 px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-full transition-all font-bold text-xs active:scale-95 disabled:opacity-50"
      >
        {isInitializing ? (
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
        ) : (
          <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        )}
        Exportar
        <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full pt-2 w-64 z-[150] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-white/80 dark:bg-neutral-900/90 backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl shadow-2xl overflow-hidden p-2">
            <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800/80 mb-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
                Selecione o Formato
              </span>
            </div>
            
            {exportFormats.includes('xlsx') && (
              <button
                onClick={() => handleExport('xlsx')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all"
              >
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span>Planilha Excel (.xlsx)</span>
                  <span className="text-[9px] font-medium text-neutral-400">Ideal para relatórios e análises</span>
                </div>
              </button>
            )}

            {exportFormats.includes('csv') && (
              <button
                onClick={() => handleExport('csv')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all"
              >
                <div className="p-1.5 bg-blue-100 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span>Arquivo CSV (.csv)</span>
                  <span className="text-[9px] font-medium text-neutral-400">Ideal para sistemas e integrações</span>
                </div>
              </button>
            )}

            {exportFormats.includes('json') && (
              <button
                onClick={() => handleExport('json')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all"
              >
                <div className="p-1.5 bg-amber-100 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400">
                  <FileJson className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span>Formato JSON (.json)</span>
                  <span className="text-[9px] font-medium text-neutral-400">Exportação de dados estruturados</span>
                </div>
              </button>
            )}

            {exportFormats.includes('pdf') && (
              <button
                onClick={() => handleExport('pdf')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all"
              >
                <div className="p-1.5 bg-red-100 dark:bg-red-950/40 rounded-lg text-red-600 dark:text-red-400">
                  <File className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span>Documento PDF (.pdf)</span>
                  <span className="text-[9px] font-medium text-neutral-400">Ideal para impressão e compartilhamento</span>
                </div>
              </button>
            )}

            {exportFormats.includes('ofx') && (
              <button
                onClick={() => handleExport('ofx')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all"
              >
                <div className="p-1.5 bg-blue-100 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span>Arquivo OFX (.ofx)</span>
                  <span className="text-[9px] font-medium text-neutral-400">Padrão para sistemas financeiros</span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export interface ActiveDownload {
  jobId: string
  progress: number
  status: string
  fileName?: string
  viewName: string
  fileUrl?: string
  recordCount?: number
  error?: string
}

interface ActiveDownloadsWidgetProps {
  downloads: ActiveDownload[]
  onRemove: (jobId: string) => void
  workspaceSlug?: string
  projectSlug?: string
}

export function ActiveDownloadsWidget({ 
  downloads, 
  onRemove,
  workspaceSlug,
  projectSlug
}: ActiveDownloadsWidgetProps) {
  const [isMinimized, setIsMinimized] = useState(false)

  if (downloads.length === 0) return null

  const activeCount = downloads.filter(d => d.status === 'pending' || d.status === 'processing').length

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-white/80 dark:bg-neutral-900/90 backdrop-blur-2xl border border-neutral-200/50 dark:border-neutral-800/50 rounded-3xl shadow-2xl z-[999] overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300 select-none">
      {/* Header */}
      <div className="px-5 py-4 bg-indigo-600 dark:bg-indigo-900 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white/20 rounded-xl animate-pulse">
            <Download className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-widest">
              Gerenciador de Downloads
            </span>
            <span className="text-[9px] text-indigo-200 font-bold uppercase tracking-wider">
              {activeCount > 0 
                ? `${activeCount} exportações ativas` 
                : 'Processamentos concluídos'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {workspaceSlug && projectSlug && (
            <Link
              href={`/${workspaceSlug}/${projectSlug}/downloads`}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-indigo-100 hover:text-white"
              title="Ir para a Central de Downloads"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-indigo-100 hover:text-white"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body List */}
      {!isMinimized && (
        <div className="max-h-80 overflow-y-auto p-4 space-y-3 divide-y divide-neutral-100 dark:divide-neutral-800/50 flex flex-col">
          <div className="space-y-3 divide-y divide-neutral-100 dark:divide-neutral-800/50">
            {downloads.map((d, index) => {
              const isCompleted = d.status === 'completed'
              const isFailed = d.status === 'failed'
              const isProcessing = d.status === 'processing' || d.status === 'pending'

              return (
                <div key={d.jobId} className="pt-3 first:pt-0 flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2.5">
                      <div className={`mt-0.5 p-1.5 rounded-lg ${
                        isCompleted 
                          ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                          : isFailed 
                            ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400' 
                            : 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : isFailed ? (
                          <AlertCircle className="w-3.5 h-3.5" />
                        ) : (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-neutral-800 dark:text-neutral-100 leading-tight truncate max-w-[200px]">
                          Exportação: {d.viewName}
                        </span>
                        <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
                          {isCompleted 
                            ? `Sucesso • ${d.recordCount ?? 0} registros` 
                            : isFailed 
                              ? 'Falha no processamento' 
                              : `Processando (${d.progress}%)`}
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => onRemove(d.jobId)}
                      className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Progress bar */}
                  {isProcessing && (
                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-indigo-600 dark:bg-indigo-400 h-1.5 rounded-full transition-all duration-500" 
                        style={{ width: `${d.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Fail Error Message */}
                  {isFailed && (
                    <span className="text-[9px] text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded-xl border border-red-200/50 dark:border-red-950/50 font-medium leading-normal">
                      Erro: {d.error || 'Erro de conexão no banco'}
                    </span>
                  )}

                  {/* Completed Action Button */}
                  {isCompleted && d.fileUrl && (
                    <a
                      href={d.fileUrl}
                      download={d.fileName}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-600/25"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar Arquivo
                    </a>
                  )}
                </div>
              )
            })}
          </div>

          {workspaceSlug && projectSlug && (
            <div className="pt-3.5 mt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex justify-center">
              <Link
                href={`/${workspaceSlug}/${projectSlug}/downloads`}
                className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all flex items-center gap-1.5 py-1.5 px-4 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl border border-transparent hover:border-indigo-100 dark:hover:border-indigo-950"
              >
                Abrir Central de Downloads <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
