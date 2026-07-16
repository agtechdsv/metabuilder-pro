import React, { useMemo, Suspense } from 'react'

const ByocRemoteRenderer = ({ compiledCode, fieldName, componentProps }: { compiledCode: string, fieldName: string, componentProps?: any }) => {
  const DynamicComponent = useMemo(() => {
    try {
      const dataUri = "data:text/javascript;charset=utf-8," + encodeURIComponent(compiledCode);
      return React.lazy(() => import(/* webpackIgnore: true */ dataUri));
    } catch (e) {
      console.error('Failed to load BYOC Component', e);
      return null;
    }
  }, [compiledCode]);

  if (!DynamicComponent) {
    return <div className="p-4 text-red-500 border border-red-200 bg-red-50 rounded-xl">Erro ao carregar {fieldName}</div>;
  }

  return (
    <Suspense fallback={<div className="p-4 flex items-center justify-center animate-pulse bg-indigo-50/50 rounded-xl"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <div className="w-full relative group/byoc">
        <div className="absolute top-2 right-2 opacity-0 group-hover/byoc:opacity-100 transition-opacity z-10 pointer-events-none">
          <span className="bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md shadow-md">Microfrontend</span>
        </div>
        <DynamicComponent {...(componentProps || {})} />
      </div>
    </Suspense>
  );
};
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileUploaderInput } from '@/components/runtime/FileUploaderInput';
import { getActionContexts, getActionGroupFields } from '@/lib/customActionsHelper';
import {
  getCaseInsensitiveValue,
  getActionIcon,
  getFontFamily,
  getFontSize,
  applyMask,
  parseMaskedNumber,
  getActionColorClasses,
  parseFixedOptions
} from './RecordFormUtils';

interface RecordFormFieldProps {
  field: any;
  formData: any;
  setFormData: (data: any) => void;
  mode: 'create' | 'edit' | 'view';
  relationalOptions: Record<string, any[]>;
  customActions?: any[];
  onCustomAction?: (action: any, context?: any) => void;
  buildActionContext: (masterData: any, parentData?: any, parentTableName?: string, detailData?: any, detailTableName?: string) => any;
  project?: any;
  masterModelId?: string;
  masterModelName?: string;
  logicType?: string;
  isPageMode?: boolean;
  t: (key: string, defaultText?: string) => string;
}

export function RecordFormField(props: RecordFormFieldProps) {
  const {
    field,
    formData,
    setFormData,
    mode,
    relationalOptions,
    customActions = [],
    onCustomAction,
    buildActionContext,
    project,
    masterModelId,
    masterModelName,
    logicType,
    isPageMode = true,
    t
  } = props;

    if (!field) return null;

    const fieldLocation = field.model_id === masterModelId ? 'master' : `detail:${field.model_id}`;
    const fieldCustomActions = customActions?.filter((a: any) => {
      const ctxs = getActionContexts(a, fieldLocation);
      if (!ctxs.includes('field_group')) return false;
      const targets = getActionGroupFields(a, fieldLocation);
      if (targets.includes(field.db_column_name)) return true;

      // Legacy zone check
      const mainModelName = project?.models?.find((m: any) => m.id === masterModelId)?.db_table_name;
      const isMasterZone = !mainModelName || mainModelName.toLowerCase() === masterModelName?.toLowerCase();
      const zoneStr = isMasterZone ? 'master' : 'detail';
      if (targets.includes(`${zoneStr}:${field.db_column_name}`)) return true;
      if (logicType !== 'master_detail') {
        return targets.includes(`master:${field.db_column_name}`) || targets.includes(`detail:${field.db_column_name}`);
      }
      return false;
    }) || [];

    const leftActions = fieldCustomActions.filter((a: any) => a.group_position === 'left');
    const rightActions = fieldCustomActions.filter((a: any) => a.group_position !== 'left');

    let rawValue = getCaseInsensitiveValue(formData, field.db_column_name) ?? ''
    if (Number.isNaN(rawValue)) rawValue = ''
    let value = rawValue

    const zoneConfig = field.config?.form_config || field.config || {}
    const comp = zoneConfig.component || { type: 'text' }
    const fieldType = comp.type || 'text'
    let width = isPageMode ? (comp.width || '100%') : (comp.modalWidth || comp.width || '100%')

    if (typeof width === 'string' && width.endsWith('col')) {
      const colWidth = parseFloat(width.replace('col', ''));
      const gridSpanStr = isPageMode ? (comp.gridSpan || '12') : (comp.modalGridSpan || comp.gridSpan || '12');
      const gridSpan = parseInt(gridSpanStr) || 12;
      if (!isNaN(colWidth) && gridSpan > 0) {
        width = `${(colWidth / gridSpan) * 100}%`;
      } else {
        width = '100%';
      }
    }

    const maskStr = zoneConfig.content?.mask || field.config?.content?.mask
    const isDateType = fieldType === 'date' || fieldType === 'datetime-local' || fieldType === 'datetime' || fieldType === 'time'

    if (maskStr && !isDateType) {
      value = applyMask(rawValue, maskStr)
    } else if (value && (typeof value === 'string' || value instanceof Date)) {
      const dateStr = value instanceof Date ? value.toISOString() : String(value)
      if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        if (fieldType === 'date') {
          value = dateStr.substring(0, 10)
        } else if (fieldType === 'datetime-local' || fieldType === 'datetime') {
          value = dateStr.replace(' ', 'T').substring(0, 16)
        } else if (fieldType === 'time') {
          const timeMatch = dateStr.match(/(\d{2}:\d{2}(:\d{2})?)/)
          if (timeMatch) {
            value = timeMatch[1]
          }
        }
      }
    }

    const handleChange = (val: any) => {
      const dbCol = field.db_column_name
      const baseName = dbCol.split('.').pop()

      let finalVal = val
      if (maskStr && typeof val === 'string' && !isDateType) {
        if (maskStr === '0.000' || maskStr === '0.000,00') {
          finalVal = parseMaskedNumber(val, maskStr)
        } else {
          finalVal = applyMask(val, maskStr)
        }
      }

      const newFormData = { ...formData }

      newFormData[dbCol] = finalVal
      if (baseName) {
        newFormData[baseName] = finalVal
      }

      // Atualizar chaves case-insensitive correspondentes
      const lowerCol = dbCol.toLowerCase()
      const lowerBase = baseName ? baseName.toLowerCase() : ''

      for (const key of Object.keys(formData)) {
        const lowerKey = key.toLowerCase()
        if (lowerKey === lowerCol || (lowerBase && lowerKey === lowerBase)) {
          newFormData[key] = finalVal
        }
        const keyBase = key.split('.').pop()?.toLowerCase()
        if (keyBase && (keyBase === lowerCol || (lowerBase && keyBase === lowerBase))) {
          newFormData[key] = finalVal
        }
      }

      setFormData(newFormData)
    }

    const inputStyle = {
      fontFamily: getFontFamily(field.config?.content?.font),
      fontSize: getFontSize(field.config?.content?.size),
      color: field.config?.content?.color,
    }

    const commonClasses = cn(
      "w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900 border rounded-2xl text-sm outline-none transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-70 disabled:bg-neutral-200/50 dark:disabled:bg-neutral-800/50",
      mode === 'view'
        ? "border-transparent bg-neutral-100/50 dark:bg-neutral-900/50 cursor-default opacity-80"
        : "border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 group-hover:border-neutral-300 dark:group-hover:border-neutral-700",
      !zoneConfig.content?.color && "text-neutral-900 dark:text-white"
    )

    let options = (comp.options_type === 'relational' || comp.options_type === 'enumeration')
      ? (relationalOptions[field.id] || [])
      : parseFixedOptions(comp.fixed_options)
      
    if (comp.depends_on && comp.filter_column) {
      const depValue = formData[comp.depends_on]
      if (depValue !== undefined && depValue !== null && depValue !== '') {
        options = options.filter((o: any) => String(o.filter_value) === String(depValue))
      } else {
        options = []
      }
    }
    const isReadOnly = mode === 'view' || zoneConfig.content?.readonly === true || (field.config?.content?.formula_tokens && field.config.content.formula_tokens.length > 0);
    const isDisabled = isReadOnly || field.is_primary_key;
    const isInlineDisabled = isReadOnly || false;    return (
      <div className="space-y-2" style={{ width: width }}>
        <label
          style={{
            fontFamily: getFontFamily(zoneConfig.label?.font),
            fontSize: getFontSize(zoneConfig.label?.size),
            color: zoneConfig.label?.color,
          }}
          className={cn(
            "text-[10px] font-black tracking-widest ml-1",
            !zoneConfig.label?.color && "text-neutral-400"
          )}
        >
          {zoneConfig.label?.text || field.display_name}
          {field.is_primary_key && <span className="ml-2 text-indigo-500"># PK</span>}
          {zoneConfig.content?.required && <span className="ml-1 text-red-500">*</span>}
        </label>

        <div className="flex items-center gap-2">
          {leftActions.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              {leftActions.map((action: any) => {
                const colors = getActionColorClasses(action.color);
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => onCustomAction?.(action, buildActionContext(formData))}
                    className={cn(
                      "p-3 rounded-xl border shadow-sm transition-all flex items-center justify-center",
                      colors.text,
                      colors.hover,
                      "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
                    )}
                    title={action.label}
                  >
                    {getActionIcon(action.icon, "w-4 h-4")}
                  </button>
                );
              })}
            </div>
          )}

          <div className="relative group flex-1">
            {['textarea', 'Área de Texto (Textarea)'].includes(fieldType) ? (
              <textarea
                disabled={isDisabled}
                required={zoneConfig.content?.required}
                value={value}
                onChange={e => handleChange(e.target.value)}
                rows={comp.rows || 3}
                style={inputStyle}
                className={cn(commonClasses, "resize-none")}
                placeholder={mode === 'view' ? '' : t('runtime.record_drawer.input_placeholder').replace('{field}', field.display_name)}
              />
            ) : ['select', 'Combo (Select)'].includes(fieldType) ? (
              <select
                disabled={isDisabled}
                required={zoneConfig.content?.required}
                value={value}
                onChange={e => handleChange(e.target.value)}
                style={inputStyle}
                className={commonClasses}
              >
                <option value="">{t('common.select', 'Selecione...')}</option>
                {options.map((opt: any, i: number) => (
                  <option key={i} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : ['radio', 'Radio Buttons'].includes(fieldType) ? (
              <div className="flex flex-wrap gap-4 p-4 bg-neutral-50/50 dark:bg-neutral-950/30 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                {options.map((opt: any, i: number) => (
                  <label key={i} className="flex items-center gap-2 cursor-pointer group/opt">
                    <div
                      onClick={() => !isDisabled && handleChange(opt.value)}
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        String(value) === String(opt.value) ? 'border-indigo-600 bg-indigo-600' : 'border-neutral-300 dark:border-neutral-700'
                      )}
                    >
                      {String(value) === String(opt.value) && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 group-hover/opt:text-indigo-600 transition-colors">{opt.label}</span>
                  </label>
                ))}
              </div>
            ) : ['checkbox', 'Checkbox Group'].includes(fieldType) ? (
              <div className="flex flex-wrap gap-4 p-4 bg-neutral-50/50 dark:bg-neutral-950/30 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                {options.map((opt: any, i: number) => {
                  const checked = Array.isArray(value) ? value.includes(opt.value) : String(value).split(',').includes(String(opt.value))
                  return (
                    <label key={i} className="flex items-center gap-2 cursor-pointer group/opt">
                      <div
                        onClick={() => {
                          if (isDisabled) return
                          const currentArr = Array.isArray(value) ? value : (value ? String(value).split(',') : [])
                          const nextArr = currentArr.includes(String(opt.value))
                            ? currentArr.filter(v => v !== String(opt.value))
                            : [...currentArr, String(opt.value)]
                          handleChange(nextArr.join(','))
                        }}
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          checked ? 'border-indigo-600 bg-indigo-600' : 'border-neutral-300 dark:border-neutral-700'
                        )}
                      >
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 group-hover/opt:text-indigo-600 transition-colors">{opt.label}</span>
                    </label>
                  )
                })}
              </div>
            ) : ['switch', 'Switch (Liga/Desliga)'].includes(fieldType) ? (
              <div
                onClick={() => !isDisabled && handleChange(!value)}
                className={cn(
                  "w-12 h-6 rounded-full p-1 cursor-pointer transition-all relative",
                  value ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-800'
                )}
              >
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full shadow-sm transition-all absolute top-1",
                  value ? 'left-7' : 'left-1'
                )} />
              </div>
            ) : fieldType === 'byoc' ? (
              field.config?.compiled_code ? (
                <ByocRemoteRenderer 
                  compiledCode={field.config.compiled_code} 
                  fieldName={field.display_name} 
                  componentProps={{
                    value,
                    onChange: handleChange,
                    formData,
                    mode,
                    disabled: isDisabled
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 bg-indigo-50/50 dark:bg-indigo-900/10 border-2 border-dashed border-indigo-200 dark:border-indigo-800 rounded-2xl w-full">
                  <div className="w-10 h-10 mb-3 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-500">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                  </div>
                  <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100 mb-1">Componente Customizado</p>
                  <p className="text-[11px] text-indigo-600/70 dark:text-indigo-400/70 text-center max-w-[250px] font-medium">{field.display_name.replace('[BYOC] ', '')}</p>
                  <div className="mt-4 px-3 py-1 bg-red-100/50 dark:bg-red-900/30 rounded-full border border-red-200/50 dark:border-red-800/50">
                    <p className="text-[9px] font-black tracking-widest text-red-500 uppercase">Código não compilado</p>
                  </div>
                </div>
              )
            ) : ['image_uploader', 'document_uploader', 'file_uploader'].includes(fieldType) ? (
              <FileUploaderInput
                value={value}
                onChange={handleChange}
                disabled={isDisabled}
                type={fieldType === 'image_uploader' ? 'image' : fieldType === 'document_uploader' ? 'document' : 'any'}
                maxSizeMB={5}
              />
            ) : (
              <input
                type={
                  fieldType === 'date' ? 'date' :
                    (fieldType === 'datetime-local' || fieldType === 'datetime') ? 'datetime-local' :
                      fieldType === 'time' ? 'time' :
                        (zoneConfig.content?.mask || field.config?.content?.mask) ? 'text' :
                          fieldType === 'number' ? 'number' : 'text'
                }
                disabled={isDisabled}
                required={field.config?.content?.required}
                value={value}
                onChange={e => handleChange(e.target.value)}
                style={inputStyle}
                className={commonClasses}
                placeholder={mode === 'view' ? '' : t('runtime.record_drawer.input_placeholder').replace('{field}', field.display_name)}
              />
            )}
          </div>
          
          {rightActions.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              {rightActions.map((action: any) => {
                const colors = getActionColorClasses(action.color);
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => onCustomAction?.(action, buildActionContext(formData))}
                    className={cn(
                      "p-3 rounded-xl border shadow-sm transition-all flex items-center justify-center",
                      colors.text,
                      colors.hover,
                      "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
                    )}
                    title={action.label}
                  >
                    {getActionIcon(action.icon, "w-4 h-4")}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    )
}
