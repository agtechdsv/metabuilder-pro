'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Play, Database, AlertCircle, ArrowLeft } from 'lucide-react'
import { ByocEditor } from '@/components/studio/ByocEditor'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'

interface SqlStudioClientProps {
  workspaceSlug: string
  projectSlug: string
  project: any
}

export function SqlStudioClient({ workspaceSlug, projectSlug, project }: SqlStudioClientProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState<string>('-- Escreva sua query SQL aqui...\nSELECT * FROM "minha_tabela" LIMIT 10;')
  const [results, setResults] = useState<any[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [rowsAffected, setRowsAffected] = useState<number | null>(null)
  const [queryId, setQueryId] = useState<string>('')
  
  const { toast } = useToast()
  const supabase = createClient()

  const handleExecute = async () => {
    if (!query.trim()) return

    setLoading(true)
    setErrorMsg(null)
    setResults([])
    setColumns([])
    setRowsAffected(null)

    const newQueryId = Math.random().toString(36).substring(7)
    setQueryId(newQueryId)

    const channelName = `tunnel:${project.id}`
    const channel = supabase.channel(channelName)

    // Inscreve-se para receber o resultado da query específica
    channel.on('broadcast', { event: `query_result_${newQueryId}` }, (payload) => {
      setLoading(false)
      const data = payload.payload
      
      if (data.success) {
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          setResults(data.data)
          setColumns(Object.keys(data.data[0]))
        } else {
          setResults([])
        }
        
        if (data.rowsAffected !== undefined) {
          setRowsAffected(data.rowsAffected)
          toast(`Sucesso! Linhas afetadas: ${data.rowsAffected}`, 'success')
        } else {
           if (data.data && Array.isArray(data.data)) {
             toast(`Sucesso! Retornou ${data.data.length} linha(s).`, 'success')
           } else {
             toast('Comando executado com sucesso.', 'success')
           }
        }
      } else {
        setErrorMsg(data.error || 'Erro desconhecido ao executar query.')
        toast('Erro ao executar query', 'error')
      }
      
      supabase.removeChannel(channel)
    })

    // Envia o comando
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'sql_query',
          payload: {
            queryId: newQueryId,
            action: 'raw_sql',
            query: query,
            token: project.secret_token,
            schemaName: project.db_schema || 'public'
          }
        })
      }
    })

    // Timeout de fallback
    setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          setErrorMsg(t('studio.sql.timeout', 'Tempo esgotado. Verifique se o agente CLI do Metabuilder está rodando na sua máquina conectada.'))
          toast('Timeout do Túnel', 'error')
          supabase.removeChannel(channel)
          return false
        }
        return prev
      })
    }, 15000)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        if (!loading) {
          handleExecute()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleExecute, loading])

  return (
    <main className="w-full px-10 pt-4 pb-4 flex flex-col flex-grow h-full overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 rotate-3">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
              SQL <span className="text-emerald-600 dark:text-emerald-500">Studio</span>
            </h2>
            <p className="text-[10px] text-neutral-400 uppercase font-black tracking-[0.2em]">
              {t('studio.sql.subtitle', 'Execução Local • Nativo')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/admin/${workspaceSlug}/${projectSlug}/studio`}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900/50 dark:hover:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase text-neutral-600 dark:text-neutral-300"
          >
            <ArrowLeft className="w-4 h-4" /> {t('studio.sql.back_studio', 'Voltar ao Studio')}
          </Link>
          <button
            onClick={handleExecute}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            {t('studio.sql.execute_btn', 'EXECUTAR (CTRL + ENTER)')}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 flex-grow min-h-0">
        {/* Editor SQL */}
        <div className="h-[40%] shrink-0 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm relative">
          <ByocEditor
            value={query}
            onChange={(val) => setQuery(val || '')}
            language="sql"
            height="100%"
          />
        </div>

        {/* Resultados */}
        <div className="flex-grow min-h-0 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex justify-between items-center">
            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
              {t('studio.sql.results_title', 'Resultados')}
            </span>
            {rowsAffected !== null && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500">
                {t('studio.sql.rows_affected', 'Linhas Afetadas: {count}').replace('{count}', String(rowsAffected))}
              </span>
            )}
            {results.length > 0 && rowsAffected === null && (
              <span className="text-xs font-medium text-neutral-500">
                {t('studio.sql.rows_count', '{count} linha(s)').replace('{count}', String(results.length))}
              </span>
            )}
          </div>
          <div className="flex-grow overflow-auto p-0">
            {errorMsg ? (
              <div className="p-6 flex flex-col items-center justify-center h-full text-center">
                <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
                <h3 className="text-sm font-bold text-neutral-800 dark:text-white mb-1">{t('studio.sql.error_execution', 'Erro na Execução')}</h3>
                <p className="text-xs text-red-600 dark:text-red-400 max-w-lg">{errorMsg}</p>
              </div>
            ) : results.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-900 shadow-sm z-10">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="px-4 py-3 text-xs font-semibold text-neutral-600 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-800 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                  {results.map((row, i) => (
                    <tr key={i} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                      {columns.map((col) => (
                        <td key={col} className="px-4 py-2.5 text-xs text-neutral-700 dark:text-neutral-300 max-w-[300px] truncate">
                          {row[col] !== null ? String(row[col]) : <span className="text-neutral-400 italic">null</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 flex flex-col items-center justify-center h-full text-center text-neutral-400">
                <Database className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">{t('studio.sql.no_results_title', 'Nenhum resultado para exibir.')}</p>
                <p className="text-xs mt-1">{t('studio.sql.no_results_desc', 'Execute uma query para ver os dados aqui.')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
