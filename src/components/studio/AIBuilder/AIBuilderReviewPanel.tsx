'use client'

import { useState } from 'react'
import { ArrowLeft, Code2, Database, Settings, Check, X, Loader2, AlertTriangle, Sparkles, ExternalLink } from 'lucide-react'
import { ByocEditor } from '@/components/studio/ByocEditor'
import { MigrationReview } from './MigrationReview'
import { NavigationConfigurator } from './NavigationConfigurator'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { usePreview } from '@/contexts/PreviewContext'

interface ReviewData {
  use_case_name: string
  use_case_slug: string
  component_code: string
  new_migrations: string[]
  suggested_navigation: string
  description: string
  selected_tables?: string[]
  new_tables?: string[]
  approved_migrations?: number[]
}

interface AIBuilderReviewPanelProps {
  reviewData: ReviewData
  sessionId: string
  projectId: string
  workspaceSlug: string
  projectSlug: string
  selectedTables?: any[]
  newTables?: string[]
  onBack: () => void
  onClose?: () => void
  // Modo edição: se fornecido, faz update em vez de insert
  viewId?: string
}

export function AIBuilderReviewPanel({
  reviewData,
  sessionId,
  projectId,
  workspaceSlug,
  projectSlug,
  selectedTables = [],
  newTables = [],
  onBack,
  onClose,
  viewId,
}: AIBuilderReviewPanelProps) {
  const isEditMode = !!viewId
  const [activeTab, setActiveTab] = useState<'component' | 'migrations' | 'settings'>('component')
  const [code, setCode] = useState(reviewData.component_code)
  const [useCaseName, setUseCaseName] = useState(reviewData.use_case_name)
  const [useCaseSlug, setUseCaseSlug] = useState(reviewData.use_case_slug)
  const [navigationConfig, setNavigationConfig] = useState(isEditMode ? (reviewData.suggested_navigation || 'menu_item') : 'menu_item')
  const [approvedMigrations, setApprovedMigrations] = useState<Set<number>>(
    new Set(reviewData.approved_migrations || reviewData.new_migrations?.map((_, i) => i) || [])
  )
  const [isApplying, setIsApplying] = useState(false)

  const router = useRouter()
  const { toast } = useToast()
  const { openPreview } = usePreview()

  const hasMigrations = reviewData.new_migrations && reviewData.new_migrations.length > 0

  const handleApply = async () => {
    if (!useCaseName.trim() || !useCaseSlug.trim()) {
      toast('Informe o nome e o slug do caso de uso.', 'error')
      setActiveTab('settings')
      return
    }

    setIsApplying(true)
    try {
      const res = await fetch('/api/ai-builder/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          project_id: projectId,
          ...(viewId ? { view_id: viewId } : {}),
          use_case_name: useCaseName,
          use_case_slug: useCaseSlug,
          component_code: code,
          new_migrations: hasMigrations ? reviewData.new_migrations : [],
          approved_migrations: hasMigrations ? Array.from(approvedMigrations) : [],
          suggested_navigation: navigationConfig,
          description: reviewData.description,
          selected_tables: reviewData.selected_tables || selectedTables.map((t: any) => t.db_table_name || t),
          new_tables: reviewData.new_tables || newTables,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast(`"${useCaseName}" ${isEditMode ? 'atualizado' : 'criado'} com sucesso! 🎉`, 'success')
        router.push(`/admin/${workspaceSlug}/${projectSlug}/studio`)
      } else if (data.code === 'FREEMIUM_LIMIT') {
        toast('Limite do plano Freemium atingido. Faça upgrade para PRO.', 'error')
      } else {
        toast(data.error || 'Erro ao aplicar o caso de uso.', 'error')
      }
    } finally {
      setIsApplying(false)
    }
  }


  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/50">
        <div className="flex items-center gap-3">
          {onClose && (
            <>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white text-sm font-bold transition-colors"
              >
                ← Voltar ao Studio
              </button>
              <span className="text-neutral-300 dark:text-neutral-700">/</span>
            </>
          )}
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white text-sm font-bold transition-colors"
          >
            {!onClose && <ArrowLeft className="w-4 h-4" />} Voltar ao Chat
          </button>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-black text-neutral-900 dark:text-white truncate max-w-[200px]">
              {reviewData.use_case_name}
            </span>
          </div>
        </div>

        <button
          onClick={handleApply}
          disabled={isApplying}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
        >
          {isApplying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {isEditMode ? 'Atualizar Projeto' : 'Aplicar ao Projeto'}
        </button>
      </div>

      {/* Abas */}
      <div className="shrink-0 flex border-b border-neutral-200 dark:border-neutral-800 px-6 bg-neutral-50 dark:bg-neutral-900/30">
        <button
          onClick={() => setActiveTab('component')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'component'
              ? 'border-violet-600 text-violet-600'
              : 'border-transparent text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" /> Componente
        </button>
        <button
          onClick={() => setActiveTab('migrations')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'migrations'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Migrações SQL
          {hasMigrations && (
            <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-center">
              {reviewData.new_migrations.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'settings'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <Settings className="w-3.5 h-3.5" /> Configurações
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-grow min-h-0 overflow-auto">
        {activeTab === 'component' && (
          <div className="h-full">
            <ByocEditor
              value={code}
              onChange={(val) => setCode(val || '')}
              language="typescript"
              height="100%"
            />
          </div>
        )}

        {activeTab === 'migrations' && (
          <MigrationReview
            migrations={reviewData.new_migrations || []}
            approvedIndices={approvedMigrations}
            onToggleApproval={(i) => {
              const next = new Set(approvedMigrations)
              if (next.has(i)) next.delete(i)
              else next.add(i)
              setApprovedMigrations(next)
            }}
            onToggleAll={(selectAll) => {
              if (selectAll) {
                setApprovedMigrations(new Set(reviewData.new_migrations?.map((_, i) => i) || []))
              } else {
                setApprovedMigrations(new Set())
              }
            }}
          />
        )}

        {activeTab === 'settings' && (
          <NavigationConfigurator
            name={useCaseName}
            slug={useCaseSlug}
            navigation={navigationConfig}
            description={reviewData.description}
            onChangeName={setUseCaseName}
            onChangeSlug={setUseCaseSlug}
            onChangeNavigation={setNavigationConfig}
          />
        )}
      </div>
    </div>
  )
}
