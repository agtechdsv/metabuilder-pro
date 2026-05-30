'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Trash2, Save, Database, Edit2, List, X } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'

interface EnumValue {
  value: string
  description: string
}

interface Enumeration {
  id: string
  project_id: string
  name: string
  description: string | null
  values: EnumValue[]
}

export function EnumerationsClient({ workspace, project, workspace_slug, project_slug }: any) {
  const { t } = useI18n()
  const { toast } = useToast()
  const supabase = createClient()

  const [enumerations, setEnumerations] = useState<Enumeration[]>([])
  const [loading, setLoading] = useState(true)

  const [editingEnum, setEditingEnum] = useState<Enumeration | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchEnumerations = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('project_enumerations')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })

    if (error) {
      toast('Erro ao buscar enumerations', 'error')
    } else {
      setEnumerations(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchEnumerations()
  }, [])

  const openNewModal = () => {
    setEditingEnum({
      id: '',
      project_id: project.id,
      name: '',
      description: '',
      values: []
    })
    setIsModalOpen(true)
  }

  const openEditModal = (e: Enumeration) => {
    setEditingEnum({ ...e })
    setIsModalOpen(true)
  }

  const deleteEnum = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este Enumeration?')) return
    const { error } = await supabase.from('project_enumerations').delete().eq('id', id)
    if (error) {
      toast('Erro ao excluir', 'error')
    } else {
      toast('Excluído com sucesso!', 'success')
      fetchEnumerations()
    }
  }

  const saveEnum = async () => {
    if (!editingEnum?.name) {
      toast('O nome é obrigatório.', 'error')
      return
    }

    if (editingEnum.id) {
      // Update
      const { error } = await supabase.from('project_enumerations').update({
        name: editingEnum.name,
        description: editingEnum.description,
        values: editingEnum.values
      }).eq('id', editingEnum.id)

      if (error) {
        toast('Erro ao atualizar.', 'error')
      } else {
        toast('Atualizado com sucesso!', 'success')
        setIsModalOpen(false)
        fetchEnumerations()
      }
    } else {
      // Insert
      const { error } = await supabase.from('project_enumerations').insert({
        project_id: editingEnum.project_id,
        name: editingEnum.name,
        description: editingEnum.description,
        values: editingEnum.values
      })

      if (error) {
        toast('Erro ao criar.', 'error')
      } else {
        toast('Criado com sucesso!', 'success')
        setIsModalOpen(false)
        fetchEnumerations()
      }
    }
  }

  const addEnumValue = () => {
    if (editingEnum) {
      setEditingEnum({
        ...editingEnum,
        values: [...editingEnum.values, { value: '', description: '' }]
      })
    }
  }

  const updateEnumValue = (index: number, key: 'value' | 'description', val: string) => {
    if (editingEnum) {
      const newValues = [...editingEnum.values]
      newValues[index][key] = val
      setEditingEnum({ ...editingEnum, values: newValues })
    }
  }

  const removeEnumValue = (index: number) => {
    if (editingEnum) {
      const newValues = [...editingEnum.values]
      newValues.splice(index, 1)
      setEditingEnum({ ...editingEnum, values: newValues })
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-black flex items-center gap-3 text-neutral-900 dark:text-white tracking-tight">
            <Database className="w-6 h-6 text-indigo-600 dark:text-indigo-500" />
            Enumerations Globais
          </h3>
          <p className="text-xs text-neutral-500 mt-1">Gerencie as listas de valores fixos para usar nos Casos de Uso.</p>
        </div>
        <button 
          onClick={openNewModal}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-bold transition-all shadow-[0_0_25px_rgba(79,70,229,0.4)]"
        >
          <Plus className="w-4 h-4" /> Novo Enum
        </button>
      </div>

      <div className="w-full">
        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-neutral-500 mt-4 font-bold text-xs">Carregando enumerations...</p>
          </div>
        ) : enumerations.length === 0 ? (
          <div className="text-center py-20 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-3xl">
            <List className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold">Nenhum Enumeration configurado</h3>
            <p className="text-sm text-neutral-500 mt-2">Crie listas fixas globais para usar em campos de Select e Radio de qualquer Caso de Uso do projeto.</p>
            <button 
              onClick={openNewModal}
              className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-bold transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Criar Primeiro Enum
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enumerations.map(e => (
              <div key={e.id} className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl hover:border-indigo-500 transition-colors flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-black text-base">{e.name}</h4>
                    {e.description && <p className="text-xs text-neutral-500 mt-1">{e.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditModal(e)} className="p-2 text-neutral-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteEnum(e.id)} className="p-2 text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-auto">
                  {e.values.slice(0, 3).map((v, i) => (
                    <span key={i} className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md text-[10px] font-bold text-neutral-700 dark:text-neutral-300 truncate max-w-full">
                      {v.description} ({v.value})
                    </span>
                  ))}
                  {e.values.length > 3 && (
                    <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md text-[10px] font-bold text-neutral-700 dark:text-neutral-300">
                      +{e.values.length - 3} itens
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      {isModalOpen && editingEnum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl">
                  <List className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="font-black text-lg">{editingEnum.id ? 'Editar Enumeration' : 'Novo Enumeration'}</h3>
                  <p className="text-xs text-neutral-500">Configure os valores que ficarão disponíveis globalmente neste projeto.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Nome do Enum <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editingEnum.name}
                    onChange={e => setEditingEnum({ ...editingEnum, name: e.target.value })}
                    placeholder="Ex: StatusPagamento"
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Descrição Opcional</label>
                  <input
                    type="text"
                    value={editingEnum.description || ''}
                    onChange={e => setEditingEnum({ ...editingEnum, description: e.target.value })}
                    placeholder="Ex: Status das faturas..."
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold">Valores Fixos</h4>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mt-1">Value (salvo no banco) • Description (mostrado ao usuário)</p>
                  </div>
                  <button onClick={addEnumValue} className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-2">
                    <Plus className="w-3 h-3" /> Adicionar Valor
                  </button>
                </div>

                <div className="space-y-2">
                  {editingEnum.values.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
                      <p className="text-xs text-neutral-500 font-bold">Nenhum valor adicionado ainda.</p>
                    </div>
                  ) : (
                    editingEnum.values.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={v.value}
                          onChange={e => updateEnumValue(i, 'value', e.target.value)}
                          placeholder="Value (ex: 1, pending...)"
                          className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                        />
                        <input
                          type="text"
                          value={v.description}
                          onChange={e => updateEnumValue(i, 'description', e.target.value)}
                          placeholder="Description (ex: Pendente)"
                          className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                        />
                        <button onClick={() => removeEnumValue(i)} className="p-2.5 text-neutral-400 hover:text-red-500 bg-neutral-50 hover:bg-red-50 dark:bg-neutral-900 dark:hover:bg-red-900/20 border border-neutral-200 dark:border-neutral-800 hover:border-red-500/50 rounded-xl transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 rounded-b-3xl flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-bold rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                Cancelar
              </button>
              <button onClick={saveEnum} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-indigo-600/20">
                <Save className="w-4 h-4" /> Salvar Enumeration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
