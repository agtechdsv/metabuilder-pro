import { Drawer } from '@/components/ui/Drawer'
import { cn } from '@/lib/utils'
import { Plus, Copy } from 'lucide-react'
import FormulaBuilder from '../../../FormulaBuilder'
import { getModelsWithRelations } from '@/lib/relationPathFinder'

export function FieldDrawer({
  isDrawerOpen, setIsDrawerOpen, editingFieldId, getFieldName,
  currentFieldMeta, drawerActiveTab, setDrawerActiveTab,
  updateMeta, config, setConfig, models, relations,
  enumerations, editingTabId, editingFieldZone, handleApplyStylesToZone, t
}: any) {
  return (

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={`${t('wizard.layout.drawer.title')}: ${editingFieldId ? getFieldName(editingFieldId) : ''}`}
      >
        {currentFieldMeta && (
          <div className="flex flex-col h-full">
            {editingFieldId !== 'TABS' && (
              <div className="flex border-b border-neutral-100 dark:border-neutral-800 mb-6">
                <button
                  onClick={() => setDrawerActiveTab('geral')}
                  className={cn(
                    "flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
                    drawerActiveTab === 'geral' ? "text-indigo-600" : "text-neutral-400 hover:text-neutral-600"
                  )}
                >
                  GERAL
                  {drawerActiveTab === 'geral' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                </button>
                <button
                  onClick={() => setDrawerActiveTab('estilos')}
                  className={cn(
                    "flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
                    drawerActiveTab === 'estilos' ? "text-indigo-600" : "text-neutral-400 hover:text-neutral-600"
                  )}
                >
                  ESTILOS
                  {drawerActiveTab === 'estilos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                </button>
                <button
                  onClick={() => setDrawerActiveTab('logica')}
                  className={cn(
                    "flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
                    drawerActiveTab === 'logica' ? "text-indigo-600" : "text-neutral-400 hover:text-neutral-600"
                  )}
                >
                  FÓRMULA
                  {drawerActiveTab === 'logica' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                </button>
              </div>
            )}

            <div className="space-y-8 pb-20">
              {editingFieldId === 'TABS' && (
                <>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.label_config')}</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.font')}</label>
                        <select
                          value={currentFieldMeta.label.font}
                          onChange={e => updateMeta('label', 'font', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                        >
                          <option value="Inter">{t('wizard.layout.drawer.font_default')}</option>
                          <option value="Roboto">Roboto</option>
                          <option value="Outfit">Outfit</option>
                          <option value="JetBrains Mono">Mono</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.size')}</label>
                        <input
                          type="text"
                          placeholder="Ex: 12px"
                          value={currentFieldMeta.label.size}
                          onChange={e => updateMeta('label', 'size', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.text_color')}</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={currentFieldMeta.label.color || '#6366f1'}
                          onChange={e => updateMeta('label', 'color', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0"
                        />
                        <input
                          type="text"
                          value={currentFieldMeta.label.color}
                          onChange={e => updateMeta('label', 'color', e.target.value)}
                          placeholder={t('wizard.layout.drawer.text_color')}
                          className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-xs font-mono font-bold outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* TEXTO DE EXIBIÇÃO PARA TABS FICA SEPARADO MAS NA MESMA ABA ÚNICA */}
                  <div className="space-y-4 pt-6 mt-6 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.label_config')}</h3>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.display_text')}</label>
                      <input
                        type="text"
                        value={
                          editingTabId === 'master'
                            ? ((config.layout_config as any).master_tab_title || `${t('wizard.layout.master')}: ${models.find((m: any) => m.id === (config.layout_config as any).master_model_id)?.display_name || ''}`)
                            : ((config.layout_config as any).details_tab_titles?.[editingTabId || ''] || `Detalhe`)
                        }
                        onChange={e => {
                          if (editingTabId === 'master') {
                            setConfig({
                              ...config,
                              layout_config: { ...config.layout_config, master_tab_title: e.target.value }
                            })
                          } else if (editingTabId) {
                            const currentTitles = (config.layout_config as any).details_tab_titles || {}
                            setConfig({
                              ...config,
                              layout_config: {
                                ...config.layout_config,
                                details_tab_titles: { ...currentTitles, [editingTabId]: e.target.value }
                              }
                            })
                          }
                        }}
                        className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </>
              )}

              {editingFieldId !== 'TABS' && drawerActiveTab === 'geral' && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.label_config')}</h3>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.display_text')}</label>
                      <input
                        type="text"
                        value={currentFieldMeta.label.text}
                        onChange={e => updateMeta('label', 'text', e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 bg-emerald-600 rounded-full"></div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.content_config')}</h3>
                    </div>
                    <div className="space-y-4">
                      {editingFieldZone === 'filter' && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Operador de Filtro (Busca)</label>
                            <select
                              value={currentFieldMeta.content?.filter_operator || 'ilike'}
                              onChange={e => updateMeta('content', 'filter_operator', e.target.value)}
                              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none cursor-pointer focus:border-indigo-500 transition-colors"
                            >
                              <option value="ilike">Contém (Busca por texto - Padrão)</option>
                              <option value="=">Igual (=)</option>
                              <option value=">">Maior que (&gt;)</option>
                              <option value=">=">Maior ou igual (&gt;=)</option>
                              <option value="<">Menor que (&lt;)</option>
                              <option value="<=">Menor ou igual (&lt;=)</option>
                              <option value="!=">Diferente (!=)</option>
                              <option value="between">Intervalo (De / Até)</option>
                            </select>
                          </div>

                          {(() => {
                            const isDateField = models.some((m: any) => m.fields?.some((f: any) => (f.id === editingFieldId || f.db_column_name === editingFieldId) && (f.data_type?.includes('date') || f.data_type?.includes('timestamp'))));
                            const inputType = isDateField ? 'date' : 'text';

                            return (
                              <div className="space-y-4">
                                {isDateField && (
                                  <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Tipo de Valor Padrão</label>
                                    <select
                                      value={currentFieldMeta.content?.default_value_type || 'fixed'}
                                      onChange={e => updateMeta('content', 'default_value_type', e.target.value)}
                                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                                    >
                                      <option value="fixed">Fixo (Escolher Data)</option>
                                      <option value="relative">Dinâmico (Últimos...)</option>
                                    </select>
                                  </div>
                                )}

                                {currentFieldMeta.content?.default_value_type === 'relative' && isDateField ? (
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Quantidade</label>
                                      <input
                                        type="number"
                                        min="1"
                                        placeholder="Ex: 30"
                                        value={currentFieldMeta.content?.default_value_relative_number || ''}
                                        onChange={e => updateMeta('content', 'default_value_relative_number', e.target.value)}
                                        className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Unidade</label>
                                      <select
                                        value={currentFieldMeta.content?.default_value_relative_unit || 'days'}
                                        onChange={e => updateMeta('content', 'default_value_relative_unit', e.target.value)}
                                        className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                                      >
                                        <option value="hours">Hora(s)</option>
                                        <option value="days">Dia(s)</option>
                                        <option value="weeks">Semana(s)</option>
                                        <option value="months">Meses</option>
                                        <option value="years">Ano(s)</option>
                                      </select>
                                    </div>
                                  </div>
                                ) : currentFieldMeta.content?.filter_operator === 'between' ? (
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Valor Padrão (De)</label>
                                      <input
                                        type={inputType}
                                        placeholder="Ex: 2024-01-01"
                                        value={currentFieldMeta.content?.default_value_start || ''}
                                        onChange={e => updateMeta('content', 'default_value_start', e.target.value)}
                                        className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Valor Padrão (Até)</label>
                                      <input
                                        type={inputType}
                                        placeholder="Ex: 2024-12-31"
                                        value={currentFieldMeta.content?.default_value_end || ''}
                                        onChange={e => updateMeta('content', 'default_value_end', e.target.value)}
                                        className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Valor Padrão Inicial</label>
                                    <input
                                      type={inputType}
                                      placeholder="Valor que inicia na busca"
                                      value={currentFieldMeta.content?.default_value || ''}
                                      onChange={e => updateMeta('content', 'default_value', e.target.value)}
                                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.mask')}</label>
                        <div className="flex flex-col gap-2">
                          <select
                            value={
                              ['', '000.000.000-00', '00.000.000/0000-00', '00000-000', '(00) 00000-0000', '00/00/0000', '0.000', '0.000,00'].includes(currentFieldMeta.content.mask || '')
                                ? currentFieldMeta.content.mask || ''
                                : 'custom'
                            }
                            onChange={e => {
                              const val = e.target.value
                              if (val !== 'custom') {
                                updateMeta('content', 'mask', val)
                              } else {
                                const isKnown = ['', '000.000.000-00', '00.000.000/0000-00', '00000-000', '(00) 00000-0000', '00/00/0000', '0.000', '0.000,00'].includes(currentFieldMeta.content.mask || '')
                                if (isKnown) {
                                  updateMeta('content', 'mask', ' ')
                                }
                              }
                            }}
                            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none cursor-pointer"
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

                          {!['', '000.000.000-00', '00.000.000/0000-00', '00000-000', '(00) 00000-0000', '00/00/0000', '0.000', '0.000,00'].includes(currentFieldMeta.content.mask || '') && (
                            <input
                              type="text"
                              placeholder="Ex: 000.000.000-00"
                              value={(currentFieldMeta.content.mask || '').trim()}
                              onChange={e => updateMeta('content', 'mask', e.target.value)}
                              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-indigo-500/50 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                            />
                          )}

                          {currentFieldMeta.content.mask === '00000-000' && (
                            <div className="space-y-4 p-4 mt-2 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 animate-in fade-in slide-in-from-top-2">
                              <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={currentFieldMeta.viacep?.enabled || false}
                                    onChange={(e) => updateMeta('viacep', 'enabled', e.target.checked)}
                                  />
                                  <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                </label>
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{t('wizard.layout.drawer.viacep_title', 'Busca Automática de Endereço (ViaCEP)')}</span>
                              </div>

                              {currentFieldMeta.viacep?.enabled && (
                                <div className="space-y-3 pt-4 border-t border-indigo-100 dark:border-indigo-900/30">
                                  <p className="text-[9px] text-neutral-500 font-medium leading-relaxed">{t('wizard.layout.drawer.viacep_desc', 'Mapeie os campos do formulário que receberão os dados do ViaCEP automaticamente:')}</p>

                                  {['logradouro', 'bairro', 'cidade', 'uf'].map((fieldKey) => (
                                    <div key={fieldKey} className="flex items-center justify-between gap-2">
                                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider w-20">{fieldKey}</label>
                                      <select
                                        value={currentFieldMeta.viacep?.[fieldKey] || ''}
                                        onChange={e => updateMeta('viacep', fieldKey, e.target.value)}
                                        className="flex-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[9px] font-bold outline-none"
                                      >
                                        <option value="">{t('wizard.layout.kanban.group_placeholder', 'Selecione o campo...')}</option>
                                        {config.layout_config.form_fields.map((ffId: string) => (
                                          <option key={ffId} value={ffId}>{getFieldName(ffId)}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 cursor-pointer group" onClick={() => updateMeta('content', 'required', !currentFieldMeta.content?.required)}>
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          currentFieldMeta.content?.required ? 'bg-red-500 border-red-500 text-white' : 'border-neutral-300 dark:border-neutral-700'
                        )}>
                          {currentFieldMeta.content?.required && <Plus className="w-3 h-3 rotate-45" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-widest">{t('wizard.layout.drawer.required')}</span>
                          <span className="text-[8px] text-neutral-400 font-medium">{t('wizard.layout.drawer.required_desc')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 cursor-pointer group" onClick={() => updateMeta('content', 'readonly', !currentFieldMeta.content?.readonly)}>
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          currentFieldMeta.content?.readonly ? 'bg-amber-500 border-amber-500 text-white' : 'border-neutral-300 dark:border-neutral-700'
                        )}>
                          {currentFieldMeta.content?.readonly && <Plus className="w-3 h-3 rotate-45" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-widest">{t('wizard.layout.drawer.readonly', 'Somente Leitura')}</span>
                          <span className="text-[8px] text-neutral-400 font-medium">{t('wizard.layout.drawer.readonly_desc', 'O usuário não poderá alterar este valor')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.component_config', 'Configuração do Componente')}</h3>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.component_type', 'Tipo de Componente')}</label>
                        <select
                          value={currentFieldMeta.component?.type || 'text'}
                          onChange={e => updateMeta('component', 'type', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                        >
                          <option value="text">{t('wizard.layout.drawer.component_types.text')}</option>
                          <option value="textarea">{t('wizard.layout.drawer.component_types.textarea')}</option>
                          <option value="number">{t('wizard.layout.drawer.component_types.number')}</option>
                          <option value="select">{t('wizard.layout.drawer.component_types.select')}</option>
                          <option value="radio">{t('wizard.layout.drawer.component_types.radio')}</option>
                          <option value="checkbox">{t('wizard.layout.drawer.component_types.checkbox')}</option>
                          <option value="switch">{t('wizard.layout.drawer.component_types.switch')}</option>
                          <option value="date">{t('wizard.layout.drawer.component_types.date')}</option>
                          <option value="image_uploader">{t('wizard.layout.drawer.component_types.image_uploader')}</option>
                          <option value="document_uploader">{t('wizard.layout.drawer.component_types.document_uploader')}</option>
                          <option value="file_uploader">{t('wizard.layout.drawer.component_types.file_uploader')}</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.width', 'Largura')}</label>
                          <input
                            type="text"
                            placeholder="Ex: 100% ou 200px"
                            value={currentFieldMeta.component?.width || '100%'}
                            onChange={e => updateMeta('component', 'width', e.target.value)}
                            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                          />
                        </div>
                        {currentFieldMeta.component?.type === 'textarea' && (
                          <div className="space-y-2">
                            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.rows', 'Linhas')}</label>
                            <input
                              type="number"
                              value={currentFieldMeta.component?.rows || 3}
                              onChange={e => updateMeta('component', 'rows', parseInt(e.target.value))}
                              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {(['select', 'radio', 'checkbox'].includes(currentFieldMeta.component?.type)) && (
                        <div className="space-y-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                          <div className="space-y-2">
                            <label className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.options_source', 'Origem dos Dados')}</label>
                            <div className="flex gap-2">
                              {['relational', 'enumeration', 'fixed'].map(opt => (
                                <button
                                  key={opt}
                                  onClick={() => updateMeta('component', 'options_type', opt)}
                                  className={cn(
                                    "flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                                    (currentFieldMeta.component?.options_type || 'fixed') === opt ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-neutral-900 text-neutral-400'
                                  )}
                                >
                                  {opt === 'fixed' ? t('wizard.layout.drawer.source_fixed') : opt === 'enumeration' ? t('wizard.layout.drawer.source_enum') : t('wizard.layout.drawer.source_relational')}
                                </button>
                              ))}
                            </div>
                          </div>

                          {(currentFieldMeta.component?.options_type || 'fixed') === 'fixed' ? (
                            <div className="space-y-2">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.fixed_options', 'Opções (Label:Valor, separadas por vírgula)')}</label>
                              <textarea
                                placeholder="Ex: Ativo:A, Inativo:I"
                                value={currentFieldMeta.component?.fixed_options || ''}
                                onChange={e => updateMeta('component', 'fixed_options', e.target.value)}
                                className="w-full h-20 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none resize-none"
                              />
                            </div>
                          ) : currentFieldMeta.component?.options_type === 'enumeration' ? (
                            <div className="space-y-2">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.select_enumeration')}</label>
                              <select
                                value={currentFieldMeta.component?.rel_table || ''}
                                onChange={e => updateMeta('component', 'rel_table', e.target.value)}
                                className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                              >
                                <option value="">{t('wizard.layout.drawer.options_select_placeholder')}</option>
                                {enumerations.map((e: any) => (
                                  <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                              </select>
                              {currentFieldMeta.component?.rel_table && (
                                <p className="text-[9px] text-neutral-500 mt-2 italic px-1">
                                  {t('wizard.layout.drawer.options_available', '{count} opções disponíveis').replace('{count}', String(enumerations.find((e: any) => e.id === currentFieldMeta.component?.rel_table)?.values?.length || 0))}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.rel_table', 'Tabela Relacionada')}</label>
                                <select
                                  value={currentFieldMeta.component?.rel_table || ''}
                                  onChange={e => updateMeta('component', 'rel_table', e.target.value)}
                                  className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                >
                                  <option value="">{t('wizard.layout.drawer.options_select_placeholder')}</option>
                                  {models.map((m: any) => (
                                    <option key={m.id} value={m.db_table_name}>{m.display_name || m.db_table_name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.rel_label')}</label>
                                  <select
                                    value={currentFieldMeta.component?.rel_label || ''}
                                    onChange={e => updateMeta('component', 'rel_label', e.target.value)}
                                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                  >
                                    <option value="">{t('wizard.layout.drawer.options_select_placeholder')}</option>
                                    {models.find((m: any) => m.db_table_name === currentFieldMeta.component?.rel_table)?.fields.map((f: any) => (
                                      <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.rel_value')}</label>
                                  <select
                                    value={currentFieldMeta.component?.rel_value || ''}
                                    onChange={e => updateMeta('component', 'rel_value', e.target.value)}
                                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                  >
                                    <option value="">{t('wizard.layout.drawer.options_select_placeholder')}</option>
                                    {models.find((m: any) => m.db_table_name === currentFieldMeta.component?.rel_table)?.fields.map((f: any) => (
                                      <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {editingFieldId !== 'TABS' && drawerActiveTab === 'logica' && (
                <div className="space-y-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-indigo-600 rounded-full" />
                      <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest">
                        Cálculos e Fórmulas
                      </h4>
                    </div>
                    <FormulaBuilder
                      value={currentFieldMeta.content?.formula_tokens || []}
                      onChange={(tokens) => {
                        updateMeta('content', 'formula_tokens', tokens);
                      }}
                      availableFields={[
                        ...getModelsWithRelations(
                          models?.filter((m: any) => config.selected_models?.includes(m.id)) || [],
                          relations,
                          models,
                          config.layout_config?.max_relation_depth || 2
                        ).flatMap((g: any) =>
                          (g.model.fields || []).map((f: any) => ({
                            id: f.id,
                            modelName: g.label,
                            db_column_name: g.prefix ? `${g.prefix}${f.db_column_name}` : f.db_column_name,
                            display_name: f.display_name
                          }))
                        ),
                        ...(config.layout_config?.form_fields || [])
                          .filter((fid: string) => fid.startsWith('virt_') && fid !== editingFieldId)
                          .map((fid: string) => {
                            const meta = config.layout_config?.fields_metadata?.[fid] || {};
                            const virtModelId = meta.virtual_model_id;
                            let vModelName = 'Virtual';
                            let vDbTable = '';
                            if (virtModelId) {
                              const foundModel = models?.find((m: any) => m.id === virtModelId);
                              if (foundModel) {
                                vModelName = foundModel.display_name || foundModel.name;
                                vDbTable = foundModel.db_table_name;
                              }
                            }

                            const isMaster = !virtModelId || virtModelId === (config.layout_config?.master_model_id || config.selected_models?.[0]);
                            const dbColName = isMaster ? fid : `${vDbTable}.${fid}`;

                            return {
                              id: fid,
                              modelName: vModelName,
                              db_column_name: dbColName,
                              display_name: meta.label?.text || 'Campo Calculado',
                              isVirtual: true
                            };
                          })
                      ]}
                    />
                  </div>
                </div>
              )}

              {editingFieldId !== 'TABS' && drawerActiveTab === 'estilos' && (
                <>
                  <button
                    onClick={handleApplyStylesToZone}
                    className="w-full mb-6 flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 py-3 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-xs font-bold"
                  >
                    <Copy className="w-4 h-4" />
                    {t('wizard.layout.drawer.apply_styles_zone', 'Aplicar formatação a todos desta zona ({zone})').replace('{zone}', editingFieldZone === 'filter' ? t('wizard.layout.drawer.zone_filter') : editingFieldZone === 'grid' ? t('wizard.layout.drawer.zone_grid') : t('wizard.layout.drawer.zone_form'))}
                  </button>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.label_config')}</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.font')}</label>
                        <select
                          value={currentFieldMeta.label.font}
                          onChange={e => updateMeta('label', 'font', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                        >
                          <option value="Inter">{t('wizard.layout.drawer.font_default')}</option>
                          <option value="Roboto">Roboto</option>
                          <option value="Outfit">Outfit</option>
                          <option value="JetBrains Mono">Mono</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.size')}</label>
                        <input
                          type="text"
                          placeholder="Ex: 12px"
                          value={currentFieldMeta.label.size}
                          onChange={e => updateMeta('label', 'size', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.text_color')}</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={currentFieldMeta.label.color || '#6366f1'}
                          onChange={e => updateMeta('label', 'color', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0"
                        />
                        <input
                          type="text"
                          value={currentFieldMeta.label.color}
                          onChange={e => updateMeta('label', 'color', e.target.value)}
                          placeholder={t('wizard.layout.drawer.text_color')}
                          className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-xs font-mono font-bold outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 bg-emerald-600 rounded-full"></div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.content_config')}</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.font')}</label>
                        <select
                          value={currentFieldMeta.content.font}
                          onChange={e => updateMeta('content', 'font', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                        >
                          <option value="Inter">{t('wizard.layout.drawer.font_default')}</option>
                          <option value="Roboto">Roboto</option>
                          <option value="Outfit">Outfit</option>
                          <option value="JetBrains Mono">Mono</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.size')}</label>
                        <input
                          type="text"
                          placeholder="Ex: 14px"
                          value={currentFieldMeta.content.size}
                          onChange={e => updateMeta('content', 'size', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.content_color')}</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={currentFieldMeta.content.color || '#000000'}
                          onChange={e => updateMeta('content', 'color', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0"
                        />
                        <input
                          type="text"
                          value={currentFieldMeta.content.color}
                          onChange={e => updateMeta('content', 'color', e.target.value)}
                          placeholder={t('wizard.layout.drawer.content_color')}
                          className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-xs font-mono font-bold outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Drawer>
  )
}
