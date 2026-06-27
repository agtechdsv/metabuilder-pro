'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Plus, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import FormulaBuilder from '@/components/studio/FormulaBuilder'
import { formatLabelText, createDefaultFieldMeta } from '@/components/studio/UseCaseBuilder/utils'
import { getModelsWithRelations } from '@/lib/relationPathFinder'

interface FieldSettingsModalProps {
  workspace: any
  project: any
  field: any
  models: any[]
  relations: any[]
  enumerations: any[]
  workspace_slug: string
  project_slug: string
  isOpen: boolean
  onClose: () => void
}

export function FieldSettingsModal({
  workspace,
  project,
  field,
  models,
  relations,
  enumerations,
  workspace_slug,
  project_slug,
  isOpen,
  onClose
}: FieldSettingsModalProps) {
  const { t } = useI18n()
  const { toast } = useToast()
  const supabase = createClient()
  
  const [activeTab, setActiveTab] = useState<'geral' | 'estilos' | 'logica'>('geral')
  const [isSaving, setIsSaving] = useState(false)

  // Initialize with DB options or defaults
  const initialMeta = field.widget_options && Object.keys(field.widget_options).length > 0 
    ? field.widget_options 
    : createDefaultFieldMeta(field.id, models)

  const [currentFieldMeta, setCurrentFieldMeta] = useState<any>(initialMeta)

  const updateMeta = (category: string, key: string, value: any) => {
    setCurrentFieldMeta((prev: any) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }))
  }

  const getFieldName = (fid: string) => {
    for (const m of models) {
      const f = m.fields?.find((x: any) => x.id === fid)
      if (f) return f.display_name || f.db_column_name
    }
    return fid
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('fields')
        .update({ widget_options: currentFieldMeta })
        .eq('id', field.id)

      if (error) throw error

      toast('Propriedades salvas com sucesso!', 'success')
      onClose()
    } catch (err: any) {
      console.error(err)
      toast('Erro ao salvar as propriedades.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Defaults: ${field.display_name || field.db_column_name}`}
      hideHeader
      size="4xl"
    >
      <div className="flex flex-col h-[85vh] bg-[#f8f9fc] dark:bg-[#030303] overflow-hidden rounded-[2rem]">
        {/* Header (Custom) */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#080808]/80 backdrop-blur-xl px-10 py-4 border-b border-neutral-200 dark:border-neutral-800 space-y-4 rounded-t-[2rem]">
          <section className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-xl font-black tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
                  <span className="text-neutral-400 font-medium text-lg">{field.models?.db_table_name}.</span>
                  {field.display_name || field.db_column_name}
                </h2>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                  Configure as propriedades padrão deste campo para futuros casos de uso.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? 'Salvando...' : 'Salvar Padrões'}
              </button>
              
              <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800 hidden sm:block"></div>
              
              <button
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </section>

          {/* Tabs */}
          <div className="flex border-b border-neutral-200 dark:border-neutral-800 pt-2">
            <button
              onClick={() => setActiveTab('geral')}
              className={cn(
                "px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
                activeTab === 'geral' ? "text-indigo-600" : "text-neutral-400 hover:text-neutral-600"
              )}
            >
              GERAL
              {activeTab === 'geral' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
            </button>
            <button
              onClick={() => setActiveTab('estilos')}
              className={cn(
                "px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
                activeTab === 'estilos' ? "text-indigo-600" : "text-neutral-400 hover:text-neutral-600"
              )}
            >
              ESTILOS
              {activeTab === 'estilos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
            </button>
            <button
              onClick={() => setActiveTab('logica')}
              className={cn(
                "px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
                activeTab === 'logica' ? "text-indigo-600" : "text-neutral-400 hover:text-neutral-600"
              )}
            >
              FÓRMULA
              {activeTab === 'logica' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="bg-white dark:bg-neutral-900/50 p-8 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] shadow-sm max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {activeTab === 'geral' && (
            <div className="space-y-10">
              
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-5 bg-indigo-600 rounded-full"></div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.label_config')}</h3>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.display_text')}</label>
                  <input
                    type="text"
                    value={currentFieldMeta.label?.text || ''}
                    onChange={e => updateMeta('label', 'text', e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-6 pt-8 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-5 bg-emerald-600 rounded-full"></div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.content_config')}</h3>
                </div>
                <div className="space-y-6">
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.mask')}</label>
                    <div className="flex flex-col gap-2">
                      <select
                        value={
                          ['', '000.000.000-00', '00.000.000/0000-00', '00000-000', '(00) 00000-0000', '00/00/0000', '0.000', '0.000,00'].includes(currentFieldMeta.content?.mask || '')
                            ? currentFieldMeta.content?.mask || ''
                            : 'custom'
                        }
                        onChange={e => {
                          const val = e.target.value
                          if (val !== 'custom') {
                            updateMeta('content', 'mask', val)
                          } else {
                            const isKnown = ['', '000.000.000-00', '00.000.000/0000-00', '00000-000', '(00) 00000-0000', '00/00/0000', '0.000', '0.000,00'].includes(currentFieldMeta.content?.mask || '')
                            if (isKnown) {
                              updateMeta('content', 'mask', ' ')
                            }
                          }
                        }}
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none cursor-pointer"
                      >
                        <option value="">{t('wizard.layout.drawer.masks.none', 'Nenhuma')}</option>
                        <option value="000.000.000-00">{t('wizard.layout.drawer.masks.cpf', 'CPF (000.000.000-00)')}</option>
                        <option value="00.000.000/0000-00">{t('wizard.layout.drawer.masks.cnpj', 'CNPJ (00.000.000/0000-00)')}</option>
                        <option value="00000-000">{t('wizard.layout.drawer.masks.cep', 'CEP (00000-000)')}</option>
                        <option value="(00) 00000-0000">{t('wizard.layout.drawer.masks.phone', 'Telefone/Celular ((00) 00000-0000)')}</option>
                        <option value="00/00/0000">{t('wizard.layout.drawer.masks.date', 'Data (00/00/0000)')}</option>
                        <option value="0.000">{t('wizard.layout.drawer.masks.integer', 'Inteiro com Milhar (0.000)')}</option>
                        <option value="0.000,00">{t('wizard.layout.drawer.masks.decimal', 'Decimal com Milhar (0.000,00)')}</option>
                        <option value="custom">{t('wizard.layout.drawer.masks.custom', 'Personalizado (Custom)...')}</option>
                      </select>

                      {!['', '000.000.000-00', '00.000.000/0000-00', '00000-000', '(00) 00000-0000', '00/00/0000', '0.000', '0.000,00'].includes(currentFieldMeta.content?.mask || '') && (
                        <input
                          type="text"
                          placeholder="Ex: 000.000.000-00"
                          value={(currentFieldMeta.content?.mask || '').trim()}
                          onChange={e => updateMeta('content', 'mask', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-indigo-500/50 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-4 p-5 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800 cursor-pointer group" onClick={() => updateMeta('content', 'required', !currentFieldMeta.content?.required)}>
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                        currentFieldMeta.content?.required ? 'bg-red-500 border-red-500 text-white' : 'border-neutral-300 dark:border-neutral-700'
                      )}>
                        {currentFieldMeta.content?.required && <Plus className="w-3 h-3 rotate-45" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-widest">{t('wizard.layout.drawer.required')}</span>
                        <span className="text-[10px] text-neutral-400 font-medium">{t('wizard.layout.drawer.required_desc')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-5 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800 cursor-pointer group" onClick={() => updateMeta('content', 'readonly', !currentFieldMeta.content?.readonly)}>
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                        currentFieldMeta.content?.readonly ? 'bg-amber-500 border-amber-500 text-white' : 'border-neutral-300 dark:border-neutral-700'
                      )}>
                        {currentFieldMeta.content?.readonly && <Plus className="w-3 h-3 rotate-45" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-widest">{t('wizard.layout.drawer.readonly', 'Somente Leitura')}</span>
                        <span className="text-[10px] text-neutral-400 font-medium">{t('wizard.layout.drawer.readonly_desc', 'O usuário não poderá alterar este valor')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-8 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-5 bg-amber-500 rounded-full"></div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.component_config', 'Configuração do Componente')}</h3>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 rounded-2xl space-y-4">
                      <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Layout Padrão (Página)</h4>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.grid_span', 'Ocupar Colunas')}</label>
                          <select
                            value={currentFieldMeta.component?.gridSpan || '12'}
                            onChange={e => updateMeta('component', 'gridSpan', e.target.value)}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold outline-none"
                          >
                            <option value="1">1 Coluna</option>
                            <option value="2">2 Colunas</option>
                            <option value="3">3 Colunas</option>
                            <option value="4">4 Colunas</option>
                            <option value="5">5 Colunas</option>
                            <option value="6">6 Colunas (Metade)</option>
                            <option value="7">7 Colunas</option>
                            <option value="8">8 Colunas</option>
                            <option value="9">9 Colunas</option>
                            <option value="10">10 Colunas</option>
                            <option value="11">11 Colunas</option>
                            <option value="12">12 Colunas (Inteira)</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          {(() => {
                            const widthStr = currentFieldMeta.component?.width || '100%';
                            const widthMatch = widthStr.match(/^(\d+(?:\.\d+)?)(.*)$/);
                            const wValue = widthMatch ? widthMatch[1] : '100';
                            const wUnit = widthMatch ? widthMatch[2] : '%';
                            return (
                              <>
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.visual_width', 'Largura Visual')}</label>
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    value={wValue}
                                    onChange={e => updateMeta('component', 'width', `${e.target.value}${wUnit}`)}
                                    className="flex-1 w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold outline-none"
                                  />
                                  <select
                                    value={wUnit}
                                    onChange={e => updateMeta('component', 'width', `${wValue}${e.target.value}`)}
                                    className="w-20 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2 py-2.5 text-sm font-bold outline-none"
                                  >
                                    <option value="%">%</option>
                                    <option value="px">px</option>
                                    <option value="col">Colunas</option>
                                    <option value="ch">ch</option>
                                    <option value="rem">rem</option>
                                  </select>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 rounded-2xl space-y-4">
                      <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Layout Modal / Drawer</h4>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.grid_span', 'Ocupar Colunas')}</label>
                          <select
                            value={currentFieldMeta.component?.modalGridSpan || currentFieldMeta.component?.gridSpan || '12'}
                            onChange={e => updateMeta('component', 'modalGridSpan', e.target.value)}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold outline-none"
                          >
                            <option value="1">1 Coluna</option>
                            <option value="2">2 Colunas</option>
                            <option value="3">3 Colunas</option>
                            <option value="4">4 Colunas</option>
                            <option value="5">5 Colunas</option>
                            <option value="6">6 Colunas (Metade)</option>
                            <option value="7">7 Colunas</option>
                            <option value="8">8 Colunas</option>
                            <option value="9">9 Colunas</option>
                            <option value="10">10 Colunas</option>
                            <option value="11">11 Colunas</option>
                            <option value="12">12 Colunas (Inteira)</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          {(() => {
                            const widthStr = currentFieldMeta.component?.modalWidth || currentFieldMeta.component?.width || '100%';
                            const widthMatch = widthStr.match(/^(\d+(?:\.\d+)?)(.*)$/);
                            const wValue = widthMatch ? widthMatch[1] : '100';
                            const wUnit = widthMatch ? widthMatch[2] : '%';
                            return (
                              <>
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.visual_width', 'Largura Visual')}</label>
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    value={wValue}
                                    onChange={e => updateMeta('component', 'modalWidth', `${e.target.value}${wUnit}`)}
                                    className="flex-1 w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold outline-none"
                                  />
                                  <select
                                    value={wUnit}
                                    onChange={e => updateMeta('component', 'modalWidth', `${wValue}${e.target.value}`)}
                                    className="w-20 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2 py-2.5 text-sm font-bold outline-none"
                                  >
                                    <option value="%">%</option>
                                    <option value="px">px</option>
                                    <option value="col">Colunas</option>
                                    <option value="ch">ch</option>
                                    <option value="rem">rem</option>
                                  </select>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.component_type', 'Tipo de Componente')}</label>
                    <select
                      value={currentFieldMeta.component?.type || 'text'}
                      onChange={e => updateMeta('component', 'type', e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                    >
                      <option value="text">{t('wizard.layout.drawer.component_types.text')}</option>
                      <option value="textarea">{t('wizard.layout.drawer.component_types.textarea')}</option>
                      <option value="number">{t('wizard.layout.drawer.component_types.number')}</option>
                      <option value="select">{t('wizard.layout.drawer.component_types.select', 'Combo (Select)')}</option>
                      <option value="radio">{t('wizard.layout.drawer.component_types.radio')}</option>
                      <option value="checkbox">{t('wizard.layout.drawer.component_types.checkbox')}</option>
                      <option value="switch">{t('wizard.layout.drawer.component_types.switch')}</option>
                      <option value="date">{t('wizard.layout.drawer.component_types.date')}</option>
                      <option value="image_uploader">{t('wizard.layout.drawer.component_types.image_uploader')}</option>
                      <option value="document_uploader">{t('wizard.layout.drawer.component_types.document_uploader')}</option>
                      <option value="file_uploader">{t('wizard.layout.drawer.component_types.file_uploader')}</option>
                    </select>
                  </div>

                  {currentFieldMeta.component?.type === 'textarea' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.rows', 'Linhas')}</label>
                      <input
                        type="number"
                        value={currentFieldMeta.component?.rows || 3}
                        onChange={e => updateMeta('component', 'rows', parseInt(e.target.value))}
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                      />
                    </div>
                  )}

                  {(['select', 'radio', 'checkbox'].includes(currentFieldMeta.component?.type)) && (
                    <div className="space-y-6 p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.options_source', 'Origem dos Dados')}</label>
                        <div className="flex gap-2">
                          {['relational', 'enumeration', 'fixed'].map(opt => (
                            <button
                              key={opt}
                              onClick={() => updateMeta('component', 'options_type', opt)}
                              className={cn(
                                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                (currentFieldMeta.component?.options_type || 'fixed') === opt ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-neutral-900 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                              )}
                            >
                              {opt === 'fixed' ? t('wizard.layout.drawer.source_fixed', 'Valores Fixos') : opt === 'enumeration' ? t('wizard.layout.drawer.source_enum', 'Enum Global') : t('wizard.layout.drawer.source_relational', 'Relacionamento')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {(currentFieldMeta.component?.options_type || 'fixed') === 'fixed' ? (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.fixed_options', 'Opções (Label:Valor, separadas por vírgula)')}</label>
                          <textarea
                            placeholder="Ex: Ativo:A, Inativo:I"
                            value={currentFieldMeta.component?.fixed_options || ''}
                            onChange={e => updateMeta('component', 'fixed_options', e.target.value)}
                            className="w-full h-24 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none resize-none"
                          />
                        </div>
                      ) : currentFieldMeta.component?.options_type === 'enumeration' ? (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.select_enumeration', 'Selecione o Enumeration')}</label>
                          <select
                            value={currentFieldMeta.component?.rel_table || ''}
                            onChange={e => updateMeta('component', 'rel_table', e.target.value)}
                            className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                          >
                            <option value="">{t('wizard.layout.drawer.options_select_placeholder', 'Selecione...')}</option>
                            {enumerations.map((e: any) => (
                              <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                          </select>
                          {currentFieldMeta.component?.rel_table && (
                            <p className="text-[10px] text-neutral-400 mt-2 ml-1">
                              {enumerations.find((e: any) => e.id === currentFieldMeta.component.rel_table)?.values.length || 0} opções disponíveis
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.rel_table', 'Tabela Relacionada')}</label>
                            <select
                              value={currentFieldMeta.component?.rel_table || ''}
                              onChange={e => {
                                updateMeta('component', 'rel_table', e.target.value)
                                updateMeta('component', 'rel_label', '')
                                updateMeta('component', 'rel_value', '')
                              }}
                              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                            >
                              <option value="">{t('wizard.layout.drawer.options_select_placeholder')}</option>
                              {getModelsWithRelations([models.find((m: any) => m.id === field.model_id)].filter(Boolean), relations, models, 2).map((g: any, i: number) => (
                                <optgroup key={i} label={g.label}>
                                  {g.options.map((opt: any) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                          
                          {currentFieldMeta.component?.rel_table && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.rel_label', 'Label (Exibição)')}</label>
                                <select
                                  value={currentFieldMeta.component?.rel_label || ''}
                                  onChange={e => updateMeta('component', 'rel_label', e.target.value)}
                                  className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                                >
                                  <option value="">{t('wizard.layout.drawer.options_select_placeholder')}</option>
                                  {(() => {
                                    const pathParts = currentFieldMeta.component.rel_table.split('.')
                                    const modelId = pathParts[pathParts.length - 1]
                                    const targetModel = models.find((m: any) => m.id === modelId)
                                    return targetModel?.fields?.map((f: any) => (
                                      <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
                                    ))
                                  })()}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.rel_value', 'Value (ID)')}</label>
                                <select
                                  value={currentFieldMeta.component?.rel_value || ''}
                                  onChange={e => updateMeta('component', 'rel_value', e.target.value)}
                                  className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                                >
                                  <option value="">{t('wizard.layout.drawer.options_select_placeholder')}</option>
                                  {(() => {
                                    const pathParts = currentFieldMeta.component.rel_table.split('.')
                                    const modelId = pathParts[pathParts.length - 1]
                                    const targetModel = models.find((m: any) => m.id === modelId)
                                    return targetModel?.fields?.map((f: any) => (
                                      <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
                                    ))
                                  })()}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'estilos' && (
            <div className="space-y-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-5 bg-pink-500 rounded-full"></div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Estilos do Label</h3>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.font', 'Fonte')}</label>
                    <select
                      value={currentFieldMeta.label?.font || 'Inter'}
                      onChange={e => updateMeta('label', 'font', e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                    >
                      <option value="Inter">{t('wizard.layout.drawer.font_default', 'Padrão (Inter)')}</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Outfit">Outfit</option>
                      <option value="JetBrains Mono">Mono</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.size', 'Tamanho')}</label>
                    <input
                      type="text"
                      placeholder="Ex: 12px"
                      value={currentFieldMeta.label?.size || ''}
                      onChange={e => updateMeta('label', 'size', e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.text_color', 'Cor do Texto')}</label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="color"
                      value={currentFieldMeta.label?.color || '#6366f1'}
                      onChange={e => updateMeta('label', 'color', e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer overflow-hidden border-none p-0"
                    />
                    <input
                      type="text"
                      value={currentFieldMeta.label?.color || ''}
                      onChange={e => updateMeta('label', 'color', e.target.value)}
                      placeholder="#000000"
                      className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold font-mono outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-8 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Estilos do Conteúdo (Input)</h3>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.font', 'Fonte')}</label>
                    <select
                      value={currentFieldMeta.content?.font || 'Inter'}
                      onChange={e => updateMeta('content', 'font', e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                    >
                      <option value="Inter">{t('wizard.layout.drawer.font_default', 'Padrão (Inter)')}</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Outfit">Outfit</option>
                      <option value="JetBrains Mono">Mono</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.size', 'Tamanho')}</label>
                    <input
                      type="text"
                      placeholder="Ex: 14px"
                      value={currentFieldMeta.content?.size || ''}
                      onChange={e => updateMeta('content', 'size', e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.text_color', 'Cor do Texto')}</label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="color"
                      value={currentFieldMeta.content?.color || '#000000'}
                      onChange={e => updateMeta('content', 'color', e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer overflow-hidden border-none p-0"
                    />
                    <input
                      type="text"
                      value={currentFieldMeta.content?.color || ''}
                      onChange={e => updateMeta('content', 'color', e.target.value)}
                      placeholder="#000000"
                      className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold font-mono outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logica' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Construtor de Fórmula Padrão</h3>
                  <p className="text-[11px] text-neutral-500 mt-1">Ao definir uma fórmula aqui, todos os casos de uso criados já virão com este campo sendo calculado automaticamente.</p>
                </div>
              </div>

              <FormulaBuilder
                value={currentFieldMeta.content?.formula_tokens || []}
                onChange={(tokens: any) => updateMeta('content', 'formula_tokens', tokens)}
                availableFields={[
                  ...getModelsWithRelations(
                    [models.find((m: any) => m.id === field.model_id)].filter(Boolean),
                    relations,
                    models,
                    2
                  ).flatMap((g: any) =>
                    (g.model.fields || []).map((f: any) => ({
                      id: f.id,
                      modelName: g.label,
                      db_column_name: g.prefix ? `${g.prefix}${f.db_column_name}` : f.db_column_name,
                      display_name: f.display_name
                    }))
                  )
                ]}
              />
            </div>
          )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
