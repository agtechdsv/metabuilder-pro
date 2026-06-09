'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import {
  GitFork,
  Plus,
  Trash2,
  Lock,
  ArrowRight,
  Loader2,
  Database,
  RefreshCw,
  X,
  Check,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RelationsManagerProps {
  project: any
  models: any[]
}

interface Relation {
  id: string
  name: string
  from_model_id: string
  from_field_id: string
  to_model_id: string
  to_field_id: string
  relation_type: string
  source: 'cli' | 'manual'
}

const RELATION_TYPE_LABELS: Record<string, string> = {
  many_to_one: 'N → 1',
  one_to_many: '1 → N',
  many_to_many: 'N → N',
  one_to_one: '1 → 1',
}

export function RelationsManager({ project, models }: RelationsManagerProps) {
  const supabase = createClient()
  const { toast } = useToast()

  const [relations, setRelations] = useState<Relation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [formFromModel, setFormFromModel] = useState('')
  const [formFromField, setFormFromField] = useState('')
  const [formToModel, setFormToModel] = useState('')
  const [formToField, setFormToField] = useState('')
  const [formRelType, setFormRelType] = useState('many_to_one')
  const [isSaving, setIsSaving] = useState(false)

  const fetchRelations = useCallback(async () => {
    const { data, error } = await supabase
      .from('relations')
      .select('*')
      .eq('project_id', project.id)
      .order('source', { ascending: false }) // 'manual' antes de 'cli'
      .order('name', { ascending: true })

    if (!error) setRelations(data || [])
    setIsLoading(false)
    setIsRefreshing(false)
  }, [project.id])

  useEffect(() => {
    fetchRelations()
  }, [fetchRelations])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchRelations()
  }

  const getModelById = (id: string) => models.find(m => m.id === id)

  const getFieldsForModel = (modelId: string) => {
    const model = getModelById(modelId)
    if (!model) return []
    return Array.isArray(model.fields) ? model.fields : Object.values(model.fields || {})
  }

  const getFieldById = (modelId: string, fieldId: string) => {
    return getFieldsForModel(modelId).find((f: any) => f.id === fieldId)
  }

  const resetForm = () => {
    setFormFromModel('')
    setFormFromField('')
    setFormToModel('')
    setFormToField('')
    setFormRelType('many_to_one')
    setShowAddForm(false)
  }

  const handleSaveManual = async () => {
    if (!formFromModel || !formFromField || !formToModel || !formToField) {
      toast('Preencha todos os campos obrigatórios', 'error')
      return
    }

    if (formFromModel === formToModel && formFromField === formToField) {
      toast('A relação não pode apontar para o mesmo campo', 'error')
      return
    }

    // Verifica duplicata
    const duplicate = relations.find(
      r =>
        r.from_model_id === formFromModel &&
        r.from_field_id === formFromField &&
        r.to_model_id === formToModel &&
        r.to_field_id === formToField
    )
    if (duplicate) {
      toast('Esta relação já existe', 'error')
      return
    }

    const fromModel = getModelById(formFromModel)
    const toModel = getModelById(formToModel)
    const relName = `manual_${fromModel?.db_table_name}_${toModel?.db_table_name}_${Date.now()}`

    setIsSaving(true)
    const { error } = await supabase.from('relations').insert({
      project_id: project.id,
      name: relName,
      from_model_id: formFromModel,
      from_field_id: formFromField,
      to_model_id: formToModel,
      to_field_id: formToField,
      relation_type: formRelType,
      source: 'manual',
    })

    if (error) {
      toast('Erro ao salvar relação: ' + error.message, 'error')
    } else {
      toast('Relação manual criada com sucesso!', 'success')
      resetForm()
      fetchRelations()
    }
    setIsSaving(false)
  }

  const handleDelete = async (rel: Relation) => {
    if (rel.source !== 'manual') return
    setDeletingId(rel.id)
    const { error } = await supabase.from('relations').delete().eq('id', rel.id)
    if (error) {
      toast('Erro ao excluir relação: ' + error.message, 'error')
    } else {
      toast('Relação removida', 'success')
      setRelations(prev => prev.filter(r => r.id !== rel.id))
    }
    setDeletingId(null)
  }

  const cliRelations = relations.filter(r => r.source !== 'manual')
  const manualRelations = relations.filter(r => r.source === 'manual')

  const RelationRow = ({ rel }: { rel: Relation }) => {
    const fromModel = getModelById(rel.from_model_id)
    const toModel = getModelById(rel.to_model_id)
    const fromField = getFieldById(rel.from_model_id, rel.from_field_id)
    const toField = getFieldById(rel.to_model_id, rel.to_field_id)
    const isManual = rel.source === 'manual'

    return (
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all group',
        isManual
          ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/70 dark:border-blue-800/40 hover:border-blue-400 dark:hover:border-blue-600'
          : 'bg-white dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
      )}>
        {/* From */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Tabela</span>
          <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
            {fromModel?.display_name || fromModel?.db_table_name || rel.from_model_id}
          </span>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono truncate">
            .{fromField?.db_column_name || rel.from_field_id}
          </span>
        </div>

        {/* Arrow + Type */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">
            {RELATION_TYPE_LABELS[rel.relation_type] || rel.relation_type}
          </span>
          <ArrowRight className="w-4 h-4 text-neutral-400" />
        </div>

        {/* To */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Referência</span>
          <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
            {toModel?.display_name || toModel?.db_table_name || rel.to_model_id}
          </span>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono truncate">
            .{toField?.db_column_name || rel.to_field_id}
          </span>
        </div>

        {/* Badge + Action */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isManual ? (
            <>
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[8px] font-black rounded-lg uppercase tracking-wider">
                Manual
              </span>
              <button
                onClick={() => handleDelete(rel)}
                disabled={deletingId === rel.id}
                className="p-1.5 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                title="Excluir relação manual"
              >
                {deletingId === rel.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
              </button>
            </>
          ) : (
            <>
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-[8px] font-black rounded-lg uppercase tracking-wider">
                Banco
              </span>
              <div className="p-1.5 rounded-lg text-neutral-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100">
                <Lock className="w-3.5 h-3.5" />
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-neutral-900 dark:text-white">
              Santo Graal de Relacionamentos
            </h3>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
              {cliRelations.length} do banco · {manualRelations.length} manuais
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all group"
            title="Atualizar"
          >
            <RefreshCw className={cn('w-4 h-4 transition-transform duration-500', isRefreshing && 'animate-spin')} />
          </button>
          <button
            onClick={() => setShowAddForm(v => !v)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all',
              showAddForm
                ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
            )}
          >
            {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showAddForm ? 'Cancelar' : 'Nova Relação'}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl">
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
            Esta é a fonte única de verdade para todos os relacionamentos do projeto.
          </p>
          <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">
            Relações <strong>Banco</strong> vêm da introspecção do CLI e não podem ser editadas. 
            Você pode adicionar relações <strong>Manuais</strong> para casos onde o banco não define FK explicitamente.
            Todos os Casos de Uso usam este grafo para resolver JOINs automaticamente.
          </p>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="p-5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-3xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <h4 className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> Nova Relação Manual
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* From Model */}
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Tabela Origem</label>
              <select
                value={formFromModel}
                onChange={e => { setFormFromModel(e.target.value); setFormFromField('') }}
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm font-bold text-neutral-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
              >
                <option value="">Selecione a tabela...</option>
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.display_name || m.db_table_name}</option>
                ))}
              </select>
            </div>

            {/* From Field */}
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Campo FK (Chave Estrangeira)</label>
              <select
                value={formFromField}
                onChange={e => setFormFromField(e.target.value)}
                disabled={!formFromModel}
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm font-bold text-neutral-900 dark:text-white focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
              >
                <option value="">Selecione o campo...</option>
                {getFieldsForModel(formFromModel).map((f: any) => (
                  <option key={f.id} value={f.id}>{f.display_name || f.db_column_name}</option>
                ))}
              </select>
            </div>

            {/* To Model */}
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Tabela Destino (Referenciada)</label>
              <select
                value={formToModel}
                onChange={e => { setFormToModel(e.target.value); setFormToField('') }}
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm font-bold text-neutral-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
              >
                <option value="">Selecione a tabela...</option>
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.display_name || m.db_table_name}</option>
                ))}
              </select>
            </div>

            {/* To Field */}
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Campo PK (Chave Primária Referenciada)</label>
              <select
                value={formToField}
                onChange={e => setFormToField(e.target.value)}
                disabled={!formToModel}
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm font-bold text-neutral-900 dark:text-white focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
              >
                <option value="">Selecione o campo...</option>
                {getFieldsForModel(formToModel).map((f: any) => (
                  <option key={f.id} value={f.id}>{f.display_name || f.db_column_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Relation Type */}
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Tipo de Relação</label>
            <div className="flex gap-2">
              {Object.entries(RELATION_TYPE_LABELS).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFormRelType(val)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                    formRelType === val
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                      : 'bg-white dark:bg-neutral-800 text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:border-indigo-400'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-2 border-t border-blue-200/50 dark:border-blue-800/30">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveManual}
              disabled={isSaving || !formFromModel || !formFromField || !formToModel || !formToField}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Salvar Relação
            </button>
          </div>
        </div>
      )}

      {/* CLI Relations */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-emerald-500" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
            Do Banco de Dados ({cliRelations.length})
          </h4>
          <div className="flex-1 h-px bg-neutral-100 dark:bg-neutral-800" />
          <div className="flex items-center gap-1 text-[8px] text-neutral-400 font-bold">
            <Lock className="w-2.5 h-2.5" /> Somente Leitura
          </div>
        </div>

        {cliRelations.length === 0 ? (
          <div className="text-center py-8 text-neutral-400">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-bold">Nenhuma relação introspectada ainda.</p>
            <p className="text-[10px] mt-1">Execute a Sincronização pelo CLI para importar as relações do banco.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cliRelations.map(rel => <RelationRow key={rel.id} rel={rel} />)}
          </div>
        )}
      </div>

      {/* Manual Relations */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <GitFork className="w-3.5 h-3.5 text-blue-500" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
            Manuais ({manualRelations.length})
          </h4>
          <div className="flex-1 h-px bg-neutral-100 dark:bg-neutral-800" />
        </div>

        {manualRelations.length === 0 ? (
          <div className="text-center py-6 text-neutral-400 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <p className="text-xs font-bold">Nenhuma relação manual adicionada.</p>
            <p className="text-[10px] mt-1">Use o botão "Nova Relação" para conectar tabelas sem FK explícita no banco.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {manualRelations.map(rel => <RelationRow key={rel.id} rel={rel} />)}
          </div>
        )}
      </div>
    </div>
  )
}
