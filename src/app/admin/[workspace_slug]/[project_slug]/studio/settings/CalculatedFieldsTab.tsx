'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import FormulaBuilder, { FormulaToken } from '@/components/studio/FormulaBuilder'
import { FunctionSquare, Plus, Pencil, Trash2, Save, X, Calculator } from 'lucide-react'

interface VirtualField {
  id: string
  name: string
  display_name: string
  formula_tokens: FormulaToken[]
}

interface CalculatedFieldsTabProps {
  project: any
  models: any[]
}

export function CalculatedFieldsTab({ project, models }: CalculatedFieldsTabProps) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  // List of saved virtual fields from project.virtual_fields (JSONB)
  const [virtualFields, setVirtualFields] = useState<VirtualField[]>(() => {
    const raw = project?.virtual_fields
    if (!raw) return []
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) } catch { return [] }
    }
    return Array.isArray(raw) ? raw : []
  })

  // Right-column editing state
  const [editing, setEditing] = useState<VirtualField | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [fieldToDelete, setFieldToDelete] = useState<string | null>(null)

  // ── Available fields for FormulaBuilder ─────────────────────────────────
  // All real fields from all models + already saved virtual fields
  const availableFields = useMemo(() => {
    const realFields = models.flatMap((m: any) =>
      (m.fields || []).map((f: any) => ({
        id: f.id,
        modelName: m.display_name || m.db_table_name,
        db_column_name: f.db_column_name,
        display_name: f.display_name || f.db_column_name,
      }))
    )

    const virtFields = virtualFields.map(vf => ({
      id: vf.id,
      modelName: 'Calculado',
      db_column_name: `virt:${vf.id}`,
      display_name: vf.display_name || vf.name,
    }))

    return [...realFields, ...virtFields]
  }, [models, virtualFields])

  // ── Persist to DB ────────────────────────────────────────────────────────
  const persist = async (fields: VirtualField[]) => {
    const { error } = await supabase
      .from('projects')
      .update({ virtual_fields: fields })
      .eq('id', project.id)
    if (error) throw error
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const startNew = () => {
    setEditing({ id: Math.random().toString(36).substring(2, 10), name: '', display_name: '', formula_tokens: [] })
    setIsNew(true)
  }

  const startEdit = (vf: VirtualField) => {
    setEditing({ ...vf })
    setIsNew(false)
  }

  const cancelEdit = () => {
    setEditing(null)
    setIsNew(false)
  }

  const handleSave = async () => {
    if (!editing) return
    if (!editing.display_name.trim()) {
      toast('Informe um nome para o campo calculado.', 'error')
      return
    }
    setIsSaving(true)
    try {
      const updated = isNew
        ? [...virtualFields, editing]
        : virtualFields.map(vf => vf.id === editing.id ? editing : vf)
      await persist(updated)
      setVirtualFields(updated)
      cancelEdit()
      router.refresh()
      toast('Campo calculado salvo!', 'success')
    } catch (err: any) {
      toast('Erro ao salvar: ' + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const updated = virtualFields.filter(vf => vf.id !== id)
      await persist(updated)
      setVirtualFields(updated)
      if (editing?.id === id) cancelEdit()
      setFieldToDelete(null)
      router.refresh()
      toast('Campo calculado excluído.', 'success')
    } catch (err: any) {
      toast('Erro ao excluir: ' + err.message, 'error')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── LEFT COLUMN: List of calculated fields ── */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3">
        <div className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-4 flex flex-col gap-2 shadow-sm">
          <div className="px-3 py-2 flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                Campos Calculados
              </h3>
              <p className="text-xs text-neutral-500">
                Defina fórmulas reutilizáveis para todos os casos de uso.
              </p>
            </div>
            <button
              onClick={startNew}
              title="Novo campo calculado"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-500/20 flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo
            </button>
          </div>

          <div className="flex flex-col gap-1 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 custom-scrollbar">
            {virtualFields.length === 0 && (
              <div className="py-10 flex flex-col items-center justify-center text-center px-4">
                <FunctionSquare className="w-10 h-10 text-neutral-200 dark:text-neutral-700 mb-3" />
                <p className="text-xs font-bold text-neutral-500">Nenhum campo calculado</p>
                <p className="text-[10px] text-neutral-400 mt-1">Clique em "Novo" para criar o primeiro.</p>
              </div>
            )}

            {virtualFields.map(vf => (
              <div
                key={vf.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-2xl text-left transition-all border",
                  editing?.id === vf.id
                    ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 shadow-sm"
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50 border-transparent"
                )}
              >
                <div className={cn(
                  "p-2 rounded-xl flex-shrink-0",
                  editing?.id === vf.id
                    ? "bg-indigo-600 text-white"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                )}>
                  <Calculator className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-bold truncate",
                    editing?.id === vf.id
                      ? "text-indigo-900 dark:text-indigo-300"
                      : "text-neutral-700 dark:text-neutral-300"
                  )}>
                    {vf.display_name || vf.name}
                  </p>
                  <p className="text-[10px] text-neutral-400 font-mono truncate">
                    {vf.formula_tokens.length} token{vf.formula_tokens.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(vf)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setFieldToDelete(vf.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN: Formula Builder ── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {editing ? (
          <div className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] shadow-sm flex flex-col h-[calc(100vh-230px)]">

            {/* Header */}
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2.5 bg-indigo-600 rounded-xl text-white flex-shrink-0">
                  <FunctionSquare className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={editing.display_name}
                    onChange={e => setEditing({ ...editing, display_name: e.target.value, name: e.target.value })}
                    placeholder="Nome do campo calculado (ex: Total R$)"
                    className="w-full text-lg font-black tracking-tight text-neutral-900 dark:text-white bg-transparent outline-none border-b-2 border-dashed border-neutral-200 dark:border-neutral-700 focus:border-indigo-500 transition-colors py-1"
                  />
                  <p className="text-[11px] text-neutral-400 font-medium mt-1">
                    {isNew ? 'Novo campo calculado' : 'Editando campo calculado'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-2 px-4 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? 'Salvando...' : 'Salvar Campo'}
                </button>
              </div>
            </div>

            {/* Formula Builder */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Construtor de Fórmula</h3>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Ao arrastar este campo calculado para um Caso de Uso, o sistema usará automaticamente os campos da tabela alvo quando os nomes coincidirem.
                </p>
              </div>

              <FormulaBuilder
                value={editing.formula_tokens}
                onChange={tokens => setEditing({ ...editing, formula_tokens: tokens })}
                availableFields={availableFields}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] flex flex-col items-center justify-center text-center p-10 h-[calc(100vh-230px)]">
            <FunctionSquare className="w-16 h-16 text-neutral-200 dark:text-neutral-800 mb-4" />
            <h3 className="text-lg font-black text-neutral-700 dark:text-neutral-300 mb-2">
              Campos Calculados
            </h3>
            <p className="text-sm text-neutral-500 max-w-sm mb-6">
              Crie fórmulas reutilizáveis que serão aplicadas automaticamente ao gerar Casos de Uso.
            </p>
            <button
              onClick={startNew}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              <Plus className="w-4 h-4" />
              Criar Primeiro Campo Calculado
            </button>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation ── */}
      {fieldToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-8 shadow-2xl max-w-sm w-full space-y-6 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 dark:bg-red-500/10 rounded-2xl">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-neutral-900 dark:text-white">Excluir Campo?</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setFieldToDelete(null)}
                className="flex-1 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-sm font-bold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(fieldToDelete)}
                className="flex-1 py-3 rounded-2xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
