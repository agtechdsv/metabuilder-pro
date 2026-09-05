'use client'

import React from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DrawerGeneralTabProps {
  currentFieldMeta: any
  updateMeta: (section: string, field: string, value: any) => void
  editingFieldZone: string
  editingFieldId: string
  models: any[]
  enumerations: any[]
  config: any
  getFieldName: (fieldId: string) => string
  t: (key: string, fallback?: string) => string
}

export function DrawerGeneralTab({
  currentFieldMeta,
  updateMeta,
  editingFieldZone,
  editingFieldId,
  models,
  enumerations,
  config,
  getFieldName,
  t
}: DrawerGeneralTabProps) {
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-4 bg-indigo-600 rounded-full" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
            {t('wizard.layout.drawer.label_config')}
          </h3>
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
            {t('wizard.layout.drawer.display_text')}
          </label>
          <input
            type="text"
            value={currentFieldMeta.label.text}
            onChange={(e) => updateMeta('label', 'text', e.target.value)}
            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-indigo-500 outline-none transition-all"
          />
        </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-1 h-4 bg-emerald-600 rounded-full" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
            {t('wizard.layout.drawer.content_config')}
          </h3>
        </div>
        <div className="space-y-4">
          {editingFieldZone === 'filter' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                  {t('wizard.layout.drawer.filter_operator', 'Operador de Filtro (Busca)')}
                </label>
                <select
                  value={currentFieldMeta.content?.filter_operator || 'ilike'}
                  onChange={(e) => updateMeta('content', 'filter_operator', e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none cursor-pointer focus:border-indigo-500 transition-colors"
                >
                  <option value="ilike">
                    {t('wizard.layout.drawer.filter_operators.ilike', 'Contém (Busca por texto - Padrão)')}
                  </option>
                  <option value="=">{t('wizard.layout.drawer.filter_operators.equal', 'Igual (=)')}</option>
                  <option value=">">{t('wizard.layout.drawer.filter_operators.gt', 'Maior que (>)')}</option>
                  <option value=">=">
                    {t('wizard.layout.drawer.filter_operators.gte', 'Maior ou igual (>=)')}
                  </option>
                  <option value="<">{t('wizard.layout.drawer.filter_operators.lt', 'Menor que (<)')}</option>
                  <option value="<=">
                    {t('wizard.layout.drawer.filter_operators.lte', 'Menor ou igual (<=)')}
                  </option>
                  <option value="!=">{t('wizard.layout.drawer.filter_operators.neq', 'Diferente (!=)')}</option>
                  <option value="between">
                    {t('wizard.layout.drawer.filter_operators.between', 'Intervalo (De / Até)')}
                  </option>
                </select>
              </div>

              {(() => {
                const isDateField = models.some((m: any) =>
                  m.fields?.some(
                    (f: any) =>
                      (f.id === editingFieldId || f.db_column_name === editingFieldId) &&
                      (f.data_type?.includes('date') || f.data_type?.includes('timestamp'))
                  )
                )
                const inputType = isDateField ? 'date' : 'text'

                return (
                  <div className="space-y-4">
                    {isDateField && (
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                          {t('wizard.layout.drawer.default_val_type', 'Tipo de Valor Padrão')}
                        </label>
                        <select
                          value={currentFieldMeta.content?.default_value_type || 'fixed'}
                          onChange={(e) => updateMeta('content', 'default_value_type', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                        >
                          <option value="fixed">
                            {t('wizard.layout.drawer.default_val_fixed', 'Fixo (Escolher Data)')}
                          </option>
                          <option value="relative">
                            {t('wizard.layout.drawer.default_val_relative', 'Dinâmico (Últimos...)')}
                          </option>
                        </select>
                      </div>
                    )}

                    {currentFieldMeta.content?.default_value_type === 'relative' && isDateField ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                            {t('wizard.layout.drawer.quantity', 'Quantidade')}
                          </label>
                          <input
                            type="number"
                            min="1"
                            placeholder="Ex: 30"
                            value={currentFieldMeta.content?.default_value_relative_number || ''}
                            onChange={(e) => updateMeta('content', 'default_value_relative_number', e.target.value)}
                            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                            {t('wizard.layout.drawer.unit', 'Unidade')}
                          </label>
                          <select
                            value={currentFieldMeta.content?.default_value_relative_unit || 'days'}
                            onChange={(e) => updateMeta('content', 'default_value_relative_unit', e.target.value)}
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
                          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                            {t('wizard.layout.drawer.default_val_from', 'Valor Padrão (De)')}
                          </label>
                          <input
                            type={inputType}
                            placeholder="Ex: 2024-01-01"
                            value={currentFieldMeta.content?.default_value_start || ''}
                            onChange={(e) => updateMeta('content', 'default_value_start', e.target.value)}
                            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                            {t('wizard.layout.drawer.default_val_to', 'Valor Padrão (Até)')}
                          </label>
                          <input
                            type={inputType}
                            placeholder="Ex: 2024-12-31"
                            value={currentFieldMeta.content?.default_value_end || ''}
                            onChange={(e) => updateMeta('content', 'default_value_end', e.target.value)}
                            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                          {t('wizard.layout.drawer.default_val_initial', 'Valor Padrão Inicial')}
                        </label>
                        <input
                          type={inputType}
                          placeholder={t('wizard.layout.drawer.default_val_placeholder', 'Valor que inicia na busca')}
                          value={currentFieldMeta.content?.default_value || ''}
                          onChange={(e) => updateMeta('content', 'default_value', e.target.value)}
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
            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
              {t('wizard.layout.drawer.mask')}
            </label>
            <div className="flex flex-col gap-2">
              <select
                value={
                  [
                    '',
                    '000.000.000-00',
                    '00.000.000/0000-00',
                    '00000-000',
                    '(00) 00000-0000',
                    '00/00/0000',
                    '0.000',
                    '0.000,00',
                  ].includes(currentFieldMeta.content.mask || '')
                    ? currentFieldMeta.content.mask || ''
                    : 'custom'
                }
                onChange={(e) => {
                  const val = e.target.value
                  if (val !== 'custom') {
                    updateMeta('content', 'mask', val)
                  } else {
                    const isKnown = [
                      '',
                      '000.000.000-00',
                      '00.000.000/0000-00',
                      '00000-000',
                      '(00) 00000-0000',
                      '00/00/0000',
                      '0.000',
                      '0.000,00',
                    ].includes(currentFieldMeta.content.mask || '')
                    if (isKnown) {
                      updateMeta('content', 'mask', ' ')
                    }
                  }
                }}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none cursor-pointer"
              >
                <option value="">{t('wizard.layout.drawer.masks.none', 'Nenhuma')}</option>
                <option value="000.000.000-00">
                  {t('wizard.layout.drawer.masks.cpf', 'CPF (000.000.000-00)')}
                </option>
                <option value="00.000.000/0000-00">
                  {t('wizard.layout.drawer.masks.cnpj', 'CNPJ (00.000.000/0000-00)')}
                </option>
                <option value="00000-000">{t('wizard.layout.drawer.masks.cep', 'CEP (00000-000)')}</option>
                <option value="(00) 00000-0000">
                  {t('wizard.layout.drawer.masks.phone', 'Telefone/Celular ((00) 00000-0000)')}
                </option>
                <option value="00/00/0000">{t('wizard.layout.drawer.masks.date', 'Data (00/00/0000)')}</option>
                <option value="0.000">
                  {t('wizard.layout.drawer.masks.integer', 'Inteiro com Milhar (0.000)')}
                </option>
                <option value="0.000,00">
                  {t('wizard.layout.drawer.masks.decimal', 'Decimal com Milhar (0.000,00)')}
                </option>
                <option value="custom">
                  {t('wizard.layout.drawer.masks.custom', 'Personalizado (Custom)...')}
                </option>
              </select>

              {![
                '',
                '000.000.000-00',
                '00.000.000/0000-00',
                '00000-000',
                '(00) 00000-0000',
                '00/00/0000',
                '0.000',
                '0.000,00',
              ].includes(currentFieldMeta.content.mask || '') && (
                <input
                  type="text"
                  placeholder="Ex: 000.000.000-00"
                  value={(currentFieldMeta.content.mask || '').trim()}
                  onChange={(e) => updateMeta('content', 'mask', e.target.value)}
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
                      <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600" />
                    </label>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      {t('wizard.layout.drawer.viacep_title', 'Busca Automática de Endereço (ViaCEP)')}
                    </span>
                  </div>

                  {currentFieldMeta.viacep?.enabled && (
                    <div className="space-y-3 pt-4 border-t border-indigo-100 dark:border-indigo-900/30">
                      <p className="text-[9px] text-neutral-500 font-medium leading-relaxed">
                        {t(
                          'wizard.layout.drawer.viacep_desc',
                          'Mapeie os campos do formulário que receberão os dados do ViaCEP automaticamente:'
                        )}
                      </p>

                      {['logradouro', 'bairro', 'cidade', 'uf'].map((fieldKey) => (
                        <div key={fieldKey} className="flex items-center justify-between gap-2">
                          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider w-20">
                            {fieldKey}
                          </label>
                          <select
                            value={currentFieldMeta.viacep?.[fieldKey] || ''}
                            onChange={(e) => updateMeta('viacep', fieldKey, e.target.value)}
                            className="flex-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[9px] font-bold outline-none"
                          >
                            <option value="">
                              {t('wizard.layout.kanban.group_placeholder', 'Selecione o campo...')}
                            </option>
                            {config.layout_config.form_fields.map((ffId: string) => (
                              <option key={ffId} value={ffId}>
                                {getFieldName(ffId)}
                              </option>
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

          <div
            className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 cursor-pointer group"
            onClick={() => updateMeta('content', 'required', !currentFieldMeta.content?.required)}
          >
            <div
              className={cn(
                'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                currentFieldMeta.content?.required
                  ? 'bg-red-500 border-red-500 text-white'
                  : 'border-neutral-300 dark:border-neutral-700'
              )}
            >
              {currentFieldMeta.content?.required && <Plus className="w-3 h-3 rotate-45" />}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-widest">
                {t('wizard.layout.drawer.required')}
              </span>
              <span className="text-[8px] text-neutral-400 font-medium">
                {t('wizard.layout.drawer.required_desc')}
              </span>
            </div>
          </div>

          <div
            className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 cursor-pointer group"
            onClick={() => updateMeta('content', 'readonly', !currentFieldMeta.content?.readonly)}
          >
            <div
              className={cn(
                'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                currentFieldMeta.content?.readonly
                  ? 'bg-amber-500 border-amber-500 text-white'
                  : 'border-neutral-300 dark:border-neutral-700'
              )}
            >
              {currentFieldMeta.content?.readonly && <Plus className="w-3 h-3 rotate-45" />}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-widest">
                {t('wizard.layout.drawer.readonly', 'Somente Leitura')}
              </span>
              <span className="text-[8px] text-neutral-400 font-medium">
                {t('wizard.layout.drawer.readonly_desc', 'O usuário não poderá alterar este valor')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-1 h-4 bg-amber-500 rounded-full" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
            {t('wizard.layout.drawer.component_config', 'Configuração do Componente')}
          </h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-4">
            <div className="p-3 bg-neutral-50 dark:bg-neutral-900/30 border border-neutral-100 dark:border-neutral-800 rounded-xl space-y-3">
              <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                {t('wizard.layout.drawer.default_page_layout', 'Layout Padrão (Página)')}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                    {t('wizard.layout.drawer.grid_span', 'Ocupar Colunas')}
                  </label>
                  <select
                    value={currentFieldMeta.component?.gridSpan || '12'}
                    onChange={(e) => updateMeta('component', 'gridSpan', e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-bold outline-none"
                  >
                    <option value="1">{t('wizard.layout.drawer.cols_1', '1 Coluna')}</option>
                    <option value="2">{t('wizard.layout.drawer.cols_2', '2 Colunas')}</option>
                    <option value="3">{t('wizard.layout.drawer.cols_3', '3 Colunas')}</option>
                    <option value="4">{t('wizard.layout.drawer.cols_4', '4 Colunas')}</option>
                    <option value="5">{t('wizard.layout.drawer.cols_5', '5 Colunas')}</option>
                    <option value="6">{t('wizard.layout.drawer.cols_6', '6 Colunas (Metade)')}</option>
                    <option value="7">{t('wizard.layout.drawer.cols_7', '7 Colunas')}</option>
                    <option value="8">{t('wizard.layout.drawer.cols_8', '8 Colunas')}</option>
                    <option value="9">{t('wizard.layout.drawer.cols_9', '9 Colunas')}</option>
                    <option value="10">{t('wizard.layout.drawer.cols_10', '10 Colunas')}</option>
                    <option value="11">{t('wizard.layout.drawer.cols_11', '11 Colunas')}</option>
                    <option value="12">{t('wizard.layout.drawer.cols_12', '12 Colunas (Inteira)')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  {(() => {
                    const widthStr = currentFieldMeta.component?.width || '100%'
                    const widthMatch = widthStr.match(/^(\d+(?:\.\d+)?)(.*)$/)
                    const wValue = widthMatch ? widthMatch[1] : '100'
                    const wUnit = widthMatch ? widthMatch[2] : '%'
                    return (
                      <>
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                          {t('wizard.layout.drawer.visual_width', 'Largura Visual')}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={wValue}
                            onChange={(e) => updateMeta('component', 'width', `${e.target.value}${wUnit}`)}
                            className="flex-1 w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-bold outline-none"
                          />
                          <select
                            value={wUnit}
                            onChange={(e) => updateMeta('component', 'width', `${wValue}${e.target.value}`)}
                            className="w-16 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-1 py-2 text-xs font-bold outline-none"
                          >
                            <option value="%">%</option>
                            <option value="px">px</option>
                            <option value="col">Colunas</option>
                            <option value="ch">ch</option>
                            <option value="rem">rem</option>
                          </select>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 dark:bg-neutral-900/30 border border-neutral-100 dark:border-neutral-800 rounded-xl space-y-3">
              <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                {t('wizard.layout.drawer.modal_drawer_layout', 'Layout Modal / Drawer')}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                    {t('wizard.layout.drawer.grid_span', 'Ocupar Colunas')}
                  </label>
                  <select
                    value={
                      currentFieldMeta.component?.modalGridSpan || currentFieldMeta.component?.gridSpan || '12'
                    }
                    onChange={(e) => updateMeta('component', 'modalGridSpan', e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-bold outline-none"
                  >
                    <option value="1">{t('wizard.layout.drawer.cols_1', '1 Coluna')}</option>
                    <option value="2">{t('wizard.layout.drawer.cols_2', '2 Colunas')}</option>
                    <option value="3">{t('wizard.layout.drawer.cols_3', '3 Colunas')}</option>
                    <option value="4">{t('wizard.layout.drawer.cols_4', '4 Colunas')}</option>
                    <option value="5">{t('wizard.layout.drawer.cols_5', '5 Colunas')}</option>
                    <option value="6">{t('wizard.layout.drawer.cols_6', '6 Colunas (Metade)')}</option>
                    <option value="7">{t('wizard.layout.drawer.cols_7', '7 Colunas')}</option>
                    <option value="8">{t('wizard.layout.drawer.cols_8', '8 Colunas')}</option>
                    <option value="9">{t('wizard.layout.drawer.cols_9', '9 Colunas')}</option>
                    <option value="10">{t('wizard.layout.drawer.cols_10', '10 Colunas')}</option>
                    <option value="11">{t('wizard.layout.drawer.cols_11', '11 Colunas')}</option>
                    <option value="12">{t('wizard.layout.drawer.cols_12', '12 Colunas (Inteira)')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  {(() => {
                    const widthStr =
                      currentFieldMeta.component?.modalWidth || currentFieldMeta.component?.width || '100%'
                    const widthMatch = widthStr.match(/^(\d+(?:\.\d+)?)(.*)$/)
                    const wValue = widthMatch ? widthMatch[1] : '100'
                    const wUnit = widthMatch ? widthMatch[2] : '%'
                    return (
                      <>
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                          {t('wizard.layout.drawer.visual_width', 'Largura Visual')}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={wValue}
                            onChange={(e) => updateMeta('component', 'modalWidth', `${e.target.value}${wUnit}`)}
                            className="flex-1 w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-bold outline-none"
                          />
                          <select
                            value={wUnit}
                            onChange={(e) => updateMeta('component', 'modalWidth', `${wValue}${e.target.value}`)}
                            className="w-16 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-1 py-2 text-xs font-bold outline-none"
                          >
                            <option value="%">%</option>
                            <option value="px">px</option>
                            <option value="col">Colunas</option>
                            <option value="ch">ch</option>
                            <option value="rem">rem</option>
                          </select>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
              {t('wizard.layout.drawer.component_type', 'Tipo de Componente')}
            </label>
            <select
              value={currentFieldMeta.component?.type || 'text'}
              onChange={(e) => updateMeta('component', 'type', e.target.value)}
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
              <option value="document_uploader">
                {t('wizard.layout.drawer.component_types.document_uploader')}
              </option>
              <option value="file_uploader">{t('wizard.layout.drawer.component_types.file_uploader')}</option>
            </select>
          </div>

          {currentFieldMeta.component?.type === 'textarea' && (
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                {t('wizard.layout.drawer.rows', 'Linhas')}
              </label>
              <input
                type="number"
                value={currentFieldMeta.component?.rows || 3}
                onChange={(e) => updateMeta('component', 'rows', parseInt(e.target.value))}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
              />
            </div>
          )}

          {['select', 'radio', 'checkbox'].includes(currentFieldMeta.component?.type) && (
            <div className="space-y-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider ml-1">
                  {t('wizard.layout.drawer.options_source', 'Origem dos Dados')}
                </label>
                <div className="flex gap-2">
                  {['relational', 'enumeration', 'fixed'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => updateMeta('component', 'options_type', opt)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all',
                        (currentFieldMeta.component?.options_type || 'fixed') === opt
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-white dark:bg-neutral-900 text-neutral-400'
                      )}
                    >
                      {opt === 'fixed'
                        ? t('wizard.layout.drawer.source_fixed')
                        : opt === 'enumeration'
                        ? t('wizard.layout.drawer.source_enum')
                        : t('wizard.layout.drawer.source_relational')}
                    </button>
                  ))}
                </div>
              </div>

              {(currentFieldMeta.component?.options_type || 'fixed') === 'fixed' ? (
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                    {t('wizard.layout.drawer.fixed_options', 'Opções (Label:Valor, separadas por vírgula)')}
                  </label>
                  <textarea
                    placeholder="Ex: Ativo:A, Inativo:I"
                    value={currentFieldMeta.component?.fixed_options || ''}
                    onChange={(e) => updateMeta('component', 'fixed_options', e.target.value)}
                    className="w-full h-20 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none resize-none"
                  />
                </div>
              ) : currentFieldMeta.component?.options_type === 'enumeration' ? (
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                    {t('wizard.layout.drawer.select_enumeration')}
                  </label>
                  <select
                    value={currentFieldMeta.component?.rel_table || ''}
                    onChange={(e) => updateMeta('component', 'rel_table', e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  >
                    <option value="">{t('wizard.layout.drawer.options_select_placeholder')}</option>
                    {enumerations.map((e: any) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                  {currentFieldMeta.component?.rel_table && (
                    <p className="text-[9px] text-neutral-500 mt-2 italic px-1">
                      {t('wizard.layout.drawer.options_available', '{count} opções disponíveis').replace(
                        '{count}',
                        String(
                          enumerations.find((e: any) => e.id === currentFieldMeta.component?.rel_table)?.values
                            ?.length || 0
                        )
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                      {t('wizard.layout.drawer.rel_table', 'Tabela Relacionada')}
                    </label>
                    <select
                      value={currentFieldMeta.component?.rel_table || ''}
                      onChange={(e) => updateMeta('component', 'rel_table', e.target.value)}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    >
                      <option value="">{t('wizard.layout.drawer.options_select_placeholder')}</option>
                      {models.map((m: any) => (
                        <option key={m.id} value={m.db_table_name}>
                          {m.display_name || m.db_table_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                        {t('wizard.layout.drawer.rel_label')}
                      </label>
                      <select
                        value={currentFieldMeta.component?.rel_label || ''}
                        onChange={(e) => updateMeta('component', 'rel_label', e.target.value)}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      >
                        <option value="">{t('wizard.layout.drawer.options_select_placeholder')}</option>
                        {models
                          .find((m: any) => m.db_table_name === currentFieldMeta.component?.rel_table)
                          ?.fields.map((f: any) => (
                            <option key={f.id} value={f.db_column_name}>
                              {f.display_name || f.db_column_name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                        {t('wizard.layout.drawer.rel_value')}
                      </label>
                      <select
                        value={currentFieldMeta.component?.rel_value || ''}
                        onChange={(e) => updateMeta('component', 'rel_value', e.target.value)}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      >
                        <option value="">{t('wizard.layout.drawer.options_select_placeholder')}</option>
                        {models
                          .find((m: any) => m.db_table_name === currentFieldMeta.component?.rel_table)
                          ?.fields.map((f: any) => (
                            <option key={f.id} value={f.db_column_name}>
                              {f.display_name || f.db_column_name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                        {t('wizard.layout.drawer.depends_on', 'Depende de (Filtro Em Cascata)')}
                      </label>
                      <select
                        value={currentFieldMeta.component?.depends_on || ''}
                        onChange={(e) => updateMeta('component', 'depends_on', e.target.value)}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      >
                        <option value="">
                          {t('wizard.layout.drawer.options_select_placeholder', 'Nenhum')}
                        </option>
                        {(() => {
                          const allZoneFields = [
                            ...(config.layout_config.form_fields || []),
                            ...(config.layout_config.filter_fields || []),
                          ]
                          const uniqueFields = Array.from(new Set(allZoneFields))
                          return uniqueFields.map((fid: any) => {
                            const fObj = models.flatMap((m: any) => m.fields).find((f: any) => f.id === fid)
                            const val = fObj?.db_column_name || fid
                            return (
                              <option key={`dep-${fid}`} value={val}>
                                {getFieldName(fid)} ({val})
                              </option>
                            )
                          })
                        })()}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                        {t('wizard.layout.drawer.filter_column', 'Filtrar Coluna Por')}
                      </label>
                      <select
                        value={currentFieldMeta.component?.filter_column || ''}
                        onChange={(e) => updateMeta('component', 'filter_column', e.target.value)}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none disabled:opacity-50"
                        disabled={!currentFieldMeta.component?.depends_on}
                      >
                        <option value="">
                          {t('wizard.layout.drawer.options_select_placeholder', 'Selecione a coluna alvo')}
                        </option>
                        {models
                          .find((m: any) => m.db_table_name === currentFieldMeta.component?.rel_table)
                          ?.fields.map((f: any) => (
                            <option key={`fc-${f.id}`} value={f.db_column_name}>
                              {f.display_name || f.db_column_name}
                            </option>
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
  )
}
