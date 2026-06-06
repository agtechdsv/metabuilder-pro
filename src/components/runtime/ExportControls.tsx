'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  FileJson, 
  Loader2,
  ChevronDown,
  ExternalLink,
  File,
  Activity
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'

interface ExportDropdownProps {
  projectId: string
  workspaceSlug: string
  projectSlug: string
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
  projectSlug,
  viewName,
  modelName,
  displayFields,
  joins,
  filters,
  exportFormats = ['xlsx', 'csv', 'json'],
  selectedRecord
}: ExportDropdownProps) {
  const { t } = useI18n()
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


    setIsInitializing(true)

    try {
      // 1. Resolve logged-in user ID (check custom client session first, then fallback to Supabase admin/dev auth)
      const sessionCookieName = `client_session_${projectId}`
      const cookieRow = document.cookie
        .split('; ')
        .find(row => row.trim().startsWith(`${sessionCookieName}=`))
      
      let userId: string | null = null
      
      if (cookieRow) {
        try {
          const cookieVal = cookieRow.split('=')[1]
          const parsed = JSON.parse(decodeURIComponent(cookieVal))
          if (parsed && parsed.id) {
            userId = parsed.id.toString()
          }
        } catch (e) {
          console.error('[Export] Error parsing client session cookie:', e)
        }
      }

      if (!userId) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          userId = user.id
        }
        
        if (!userId) {
          // Verifica se o projeto está com autenticação desabilitada (auth_type = 'none')
          const { data: authConfig } = await supabase
            .from('project_auth_config')
            .select('auth_type')
            .eq('project_id', projectId)
            .maybeSingle()
            
          if (!authConfig || authConfig.auth_type === 'none') {
            userId = '00000000-0000-0000-0000-000000000000'
          }
        }
      }
      
      if (!userId) {
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
          userId: userId,
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
        const downloadsUrl = `/${workspaceSlug}/${projectSlug}/downloads`
        toast(
          `Exportação de "${viewName}" iniciada! Seus dados estão sendo processados em segundo plano — você pode continuar navegando à vontade.`,
          'success',
          {
            label: '📥 Acompanhar na Central de Downloads',
            onClick: () => { if (window.top) { window.top.location.href = downloadsUrl } else { window.location.href = downloadsUrl } }
          }
        )
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
        {t('runtime.export_btn')}
        <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full pt-2 w-64 z-[150] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-white/80 dark:bg-neutral-900/90 backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl shadow-2xl overflow-hidden p-2">
            <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800/80 mb-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
                {t('runtime.export_select_format')}
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
                  <span>{t('runtime.export_xlsx')}</span>
                  <span className="text-[9px] font-medium text-neutral-400">{t('runtime.export_xlsx_hint')}</span>
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
                  <span>{t('runtime.export_csv')}</span>
                  <span className="text-[9px] font-medium text-neutral-400">{t('runtime.export_csv_hint')}</span>
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
                  <span>{t('runtime.export_json')}</span>
                  <span className="text-[9px] font-medium text-neutral-400">{t('runtime.export_json_hint')}</span>
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
                  <span>{t('runtime.export_pdf')}</span>
                  <span className="text-[9px] font-medium text-neutral-400">{t('runtime.export_pdf_hint')}</span>
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
                  <span>{t('runtime.export_ofx')}</span>
                  <span className="text-[9px] font-medium text-neutral-400">{t('runtime.export_ofx_hint')}</span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
