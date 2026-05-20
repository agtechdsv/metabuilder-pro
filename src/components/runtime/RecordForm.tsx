'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save, Eye, Pencil, Plus, Trash2, ArrowLeft, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'

// Helper para obter valores de forma insensível a maiúsculas/minúsculas e tolerante a prefixos
const getCaseInsensitiveValue = (data: any, path: string) => {
  if (!data || !path) return undefined
  
  // 1. Tentar busca exata no caminho
  if (data[path] !== undefined && data[path] !== null) {
    return data[path]
  }
  
  // 2. Tentar busca exata no baseName (ex: "data_inicio" de "agenda_compromissos.data_inicio")
  const baseName = path.split('.').pop()
  if (baseName && data[baseName] !== undefined && data[baseName] !== null) {
    return data[baseName]
  }

  // 3. Busca case-insensitive
  const lowerPath = path.toLowerCase()
  const lowerBase = baseName ? baseName.toLowerCase() : ''
  
  for (const key of Object.keys(data)) {
    const lowerKey = key.toLowerCase()
    if (lowerKey === lowerPath) {
      return data[key]
    }
    if (lowerBase && lowerKey === lowerBase) {
      return data[key]
    }
    
    // Tratar se a chave no data for "tabela.coluna" e o lowerBase/lowerPath bater com o final dela
    const keyBase = key.split('.').pop()?.toLowerCase()
    if (keyBase && (keyBase === lowerPath || (lowerBase && keyBase === lowerBase))) {
      return data[key]
    }
  }

  return undefined
}

interface RecordFormProps {
  mode: 'create' | 'edit' | 'view'
  fields: any[]
  initialData?: any
  onSave: (data: any) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  logicType?: string
  masterModelId?: string
  masterModelName?: string
  detailDisplayMode?: 'tabs' | 'sections'
  isPageMode?: boolean
  onEditDetail?: (detail: any) => void
  onDeleteDetail?: (detail: any) => void
  onAddDetail?: (tableName: string, parentId?: any) => void
  joins?: any[]
  dictionary?: Record<string, string>
  initialTab?: string
  onTabChange?: (tab: string) => void
  detailsInlineTypes?: Record<string, boolean>
  footerBgClass?: string
}

export default function RecordForm({ 
  mode, 
  fields, 
  initialData, 
  onSave,
  onCancel,
  isLoading = false,
  logicType,
  masterModelId,
  masterModelName,
  detailDisplayMode = 'tabs',
  isPageMode = false,
  onEditDetail,
  onDeleteDetail,
  onAddDetail,
  joins = [],
  dictionary = {},
  initialTab = 'master',
  onTabChange,
  detailsInlineTypes = {},
  footerBgClass = "bg-white dark:bg-neutral-950"
}: RecordFormProps) {
  const { t } = useI18n()
  const [formData, setFormData] = useState<any>(initialData || {})
  const [activeTab, setActiveTab] = useState<'master' | string>(initialTab)
  const [relationalOptions, setRelationalOptions] = useState<Record<string, any[]>>({})
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({})
  const [loadingSubDetails, setLoadingSubDetails] = useState<Record<string, boolean>>({})

  // Busca sub-detalhes de um registro sob demanda (lazy loading)
  // chamado ao expandir a cortina de um detalhe pela primeira vez
  const fetchSubDetailsForRecord = async (detail: any, tableName: string, pkCol: string, pkValue: any) => {
    const subJoins = joins.filter(j => j.from?.toLowerCase() === tableName?.toLowerCase())
    if (subJoins.length === 0) return

    const supabaseClient = createClient()
    const allSubDetails: any[] = []

    for (const join of subJoins) {
      if (!pkValue) continue
      const { data } = await (supabaseClient as any)
        .from(join.to)
        .select('*')
        .eq(join.foreignKey, String(pkValue))
      if (data) {
        allSubDetails.push(...data.map((d: any) => ({ ...d, model_name: join.to })))
      }
    }

    // Injeta os sub-detalhes no registro correto dentro de formData._details
    setFormData((prev: any) => {
      const newDetails = (prev._details || []).map((d: any) => {
        const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID
        if (String(dPk) === String(pkValue) && d.model_name?.toLowerCase() === tableName.toLowerCase()) {
          return { ...d, _details: allSubDetails }
        }
        return d
      })
      return { ...prev, _details: newDetails }
    })
  }

  useEffect(() => {
    const fetchAllRelational = async () => {
      const supabase = createClient()
      const newOptions: Record<string, any[]> = {}
      
      for (const field of fields) {
        // Tenta pegar a config específica de formulário, senão usa a global
        const config = field.config?.form_config || field.config
        const comp = config?.component
        if (comp?.type && ['select', 'radio', 'checkbox'].includes(comp.type) && comp.options_type === 'relational' && comp.rel_table) {
          try {
            const { data } = await supabase
              .from(comp.rel_table)
              .select(`${comp.rel_label}, ${comp.rel_value}`)
            
            if (data) {
              newOptions[field.id] = data.map(item => ({
                label: item[comp.rel_label],
                value: item[comp.rel_value]
              }))
            }
          } catch (err) {
            console.error(`Error fetching relational options for field ${field.id}:`, err)
          }
        }
      }
      setRelationalOptions(newOptions)
    }
    
    if (fields.length > 0) {
      fetchAllRelational()
    }
  }, [fields])

  const parseFixedOptions = (str: string) => {
    if (!str) return []
    return str.split(',').map(pair => {
      if (!pair.includes(':')) return { label: pair.trim(), value: pair.trim() }
      const [label, value] = pair.split(':').map(s => s.trim())
      return { label: label || value, value: value || label }
    })
  }

  // Identifica quem é o mestre atual (pode ser o ID ou o Nome da tabela)
  const currentMasterId = masterModelId || fields.find(f => f.model_name?.toLowerCase() === masterModelName?.toLowerCase())?.model_id

  const masterFields = logicType === 'master_detail' 
    ? fields.filter(f => {
        const isMaster = !f.model_id || 
                        (currentMasterId && String(f.model_id) === String(currentMasterId)) || 
                        (masterModelName && f.model_name?.toLowerCase() === masterModelName?.toLowerCase())
        
        if (!isMaster) return false
        // Se estivermos em um modal de detalhe, mostramos todos os campos dele
        return (!!masterModelName || f.zone === 3 || f.zone === '3' || f.zone === undefined || f.zone === null)
      })
    : fields.filter(f => f.zone === 3 || f.zone === '3' || f.zone === undefined || f.zone === null)

  const detailFields = logicType === 'master_detail' 
    ? fields.filter(f => {
        const isMaster = (currentMasterId && String(f.model_id) === String(currentMasterId)) || 
                        (masterModelName && f.model_name?.toLowerCase() === masterModelName?.toLowerCase())
        return f.model_id && !isMaster
      })
    : []

  // FILTRAGEM HIERÁRQUICA: 
  // Só mostramos como aba as tabelas que são FILHAS DIRETAS do mestre atual no array de JOINS
  const detailTables = Array.from(new Set(
    detailFields
      .filter(f => {
        // Se não houver joins, mostra tudo (fallback)
        if (!joins || joins.length === 0) return true
        // Verifica se existe um join de masterModelName -> f.model_name
        return joins.some(j => (j.from?.toLowerCase() === masterModelName?.toLowerCase()) && j.to?.toLowerCase() === f.model_name?.toLowerCase())
      })
      .map(f => f.model_name || 'Details')
  ))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[RecordForm] handleSubmit - formData keys:', Object.keys(formData), '| formData:', JSON.stringify(formData).slice(0, 500))
    onSave(formData)
  }

  useEffect(() => {
    setFormData(initialData || {})
  }, [initialData])

  const titles = {
    create: t('runtime.new_record'),
    edit: t('dashboard.projects.studio.config.configure_view'),
    view: t('runtime.view')
  }

  const icons = {
    create: <Plus className="w-5 h-5 text-indigo-500" />,
    edit: <Pencil className="w-5 h-5 text-indigo-500" />,
    view: <Eye className="w-5 h-5 text-indigo-500" />
  }

  const renderField = (field: any) => {
    if (!field) return null;
    const zoneConfig = field.config?.form_config || field.config || {}
    const comp = zoneConfig.component || { type: 'text' }
    const fieldType = comp.type || 'text'
    const width = comp.width || '100%'

    let rawValue = getCaseInsensitiveValue(formData, field.db_column_name) ?? ''
    let value = rawValue

    if (value && (typeof value === 'string' || value instanceof Date)) {
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
      
      const newFormData = { ...formData }
      
      newFormData[dbCol] = val
      if (baseName) {
        newFormData[baseName] = val
      }
      
      // Atualizar chaves case-insensitive correspondentes
      const lowerCol = dbCol.toLowerCase()
      const lowerBase = baseName ? baseName.toLowerCase() : ''
      
      for (const key of Object.keys(formData)) {
        const lowerKey = key.toLowerCase()
        if (lowerKey === lowerCol || (lowerBase && lowerKey === lowerBase)) {
          newFormData[key] = val
        }
        const keyBase = key.split('.').pop()?.toLowerCase()
        if (keyBase && (keyBase === lowerCol || (lowerBase && keyBase === lowerBase))) {
          newFormData[key] = val
        }
      }
      
      setFormData(newFormData)
    }

    const inputStyle = {
      fontFamily: field.config?.content?.font,
      fontSize: field.config?.content?.size,
      color: field.config?.content?.color,
    }

    const commonClasses = cn(
      "w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900 border rounded-2xl text-sm outline-none transition-all shadow-sm",
      mode === 'view' 
        ? "border-transparent bg-neutral-100/50 dark:bg-neutral-900/50 cursor-default opacity-80" 
        : "border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 group-hover:border-neutral-300 dark:group-hover:border-neutral-700",
      !zoneConfig.content?.color && "text-neutral-900 dark:text-white"
    )

    const options = comp.options_type === 'relational' 
      ? (relationalOptions[field.id] || [])
      : parseFixedOptions(comp.fixed_options)

    const isDisabled = mode === 'view' || field.is_primary_key

    return (
      <div className="space-y-2" style={{ width: width }}>
        <label 
          style={{
            fontFamily: zoneConfig.label?.font,
            fontSize: zoneConfig.label?.size,
            color: zoneConfig.label?.color,
          }}
          className={cn(
            "text-[10px] font-black tracking-widest ml-1",
            !zoneConfig.label?.color && "text-neutral-400",
            !zoneConfig.label?.font && "uppercase"
          )}
        >
          {zoneConfig.label?.text || field.display_name}
          {field.is_primary_key && <span className="ml-2 text-indigo-500"># PK</span>}
          {zoneConfig.content?.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        
        <div className="relative group">
          {fieldType === 'textarea' ? (
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
          ) : fieldType === 'select' ? (
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
          ) : fieldType === 'radio' ? (
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
          ) : fieldType === 'checkbox' ? (
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
          ) : fieldType === 'switch' ? (
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
          ) : (
            <input 
              type={
                fieldType === 'number' ? 'number' :
                fieldType === 'date' ? 'date' :
                (fieldType === 'datetime-local' || fieldType === 'datetime') ? 'datetime-local' :
                fieldType === 'time' ? 'time' : 'text'
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
      </div>
    )
  }

  const renderDetailSection = (tableName: string, parentData: any = formData) => {
    const modelId = fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.model_id
    const displayLabel = dictionary[modelId || ''] || tableName

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Registros Relacionados: {displayLabel}</h4>
            
            {/* Botão Expande/Recolhe Tudo */}
            {detailsInlineTypes[modelId || ''] !== false && (parentData?._details || []).some((d: any) => d.model_name?.toLowerCase() === tableName?.toLowerCase()) && (
              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={async () => {
                    const currentDetails = (parentData?._details || []).filter((d: any) => d.model_name?.toLowerCase() === tableName?.toLowerCase())
                    const pkField = fields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase()).find(f => f.is_primary_key) || { db_column_name: 'id' }
                    const pkCol = pkField.db_column_name.split('.').pop() || 'id'
                    
                    // 1. Expande todos imediatamente
                    const newState = { ...expandedDetails }
                    currentDetails.forEach((d: any, idx: number) => {
                      const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`
                      const key = `detail-${tableName}-${dPk}`
                      newState[key] = true
                    })
                    setExpandedDetails(newState)
                    
                    // 2. Lazy load sub-detalhes para todos que ainda não têm
                    const fetches = currentDetails
                      .filter((d: any) => !d._details || d._details.length === 0)
                      .map((d: any, idx: number) => {
                        const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`
                        const key = `detail-${tableName}-${dPk}`
                        if (!loadingSubDetails[key]) {
                          setLoadingSubDetails(prev => ({ ...prev, [key]: true }))
                          return fetchSubDetailsForRecord(d, tableName, pkCol, dPk)
                            .finally(() => setLoadingSubDetails(prev => ({ ...prev, [key]: false })))
                        }
                        return Promise.resolve()
                      })
                    await Promise.all(fetches)
                  }}
                  title={t('common.expand_all', 'Expandir Tudo')}
                  className="p-1 hover:bg-white dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-indigo-600 transition-all"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currentDetails = (parentData?._details || []).filter((d: any) => d.model_name?.toLowerCase() === tableName?.toLowerCase())
                    const pkField = fields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase()).find(f => f.is_primary_key) || { db_column_name: 'id' }
                    const pkCol = pkField.db_column_name.split('.').pop() || 'id'
                    
                    const newState = { ...expandedDetails }
                    currentDetails.forEach((d: any, idx: number) => {
                      const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`
                      const key = `detail-${tableName}-${dPk}`
                      newState[key] = false
                    })
                    setExpandedDetails(newState)
                  }}
                  title={t('common.collapse_all', 'Recolher Tudo')}
                  className="p-1 hover:bg-white dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-indigo-600 transition-all"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          
          <button 
            type="button" 
            onClick={() => onAddDetail?.(tableName, parentData.id || parentData.ID)}
            className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      
      <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {(() => {
              const seenIds = new Set();
              const detailsToRender = (parentData?._details || [])
                .filter((d: any) => d.model_name?.toLowerCase() === tableName?.toLowerCase());

              return detailsToRender.map((detail: any, idx: number) => {
                  const pkField = fields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase()).find(f => f.is_primary_key) || { db_column_name: 'id' };
                  const pkCol = pkField.db_column_name.split('.').pop() || 'id';
                  const detailIdValue = detail[pkCol] || detail[pkCol.toUpperCase()] || detail.id || detail.ID || `idx-${idx}`;
                  const uniqueKey = `detail-${tableName}-${detailIdValue}`;
                  
                  if (seenIds.has(uniqueKey)) return null;
                  seenIds.add(uniqueKey);
                  
                  return (
                    <div key={uniqueKey} className={cn("flex flex-col gap-1 rounded-2xl transition-all duration-300", expandedDetails[uniqueKey] ? "bg-indigo-50/50 dark:bg-indigo-950/20 ring-1 ring-indigo-500/20 p-0.5" : "")}>
                      <div className={cn(
                        "py-2.5 px-3 border rounded-xl flex items-center justify-between group animate-in fade-in slide-in-from-top-2 duration-300 transition-all",
                        expandedDetails[uniqueKey] 
                          ? "bg-white dark:bg-neutral-900 border-indigo-200 dark:border-indigo-800 shadow-lg shadow-indigo-500/5" 
                          : "bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800"
                      )}>
                        <div className="flex flex-col gap-1">
                        <span className={cn(
                          "text-xs font-bold transition-colors",
                          expandedDetails[uniqueKey] ? "text-indigo-600 dark:text-indigo-400" : "text-neutral-700 dark:text-neutral-200"
                        )}>
                          {detail.display_name || detail.name || detail.label || `Item #${idx + 1}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 transition-all">
                        {/* Botão de Cortina (Na Lista) */}
                        {detailsInlineTypes[modelId || ''] !== false && (
                          <button 
                            type="button" 
                            onClick={async (e) => { 
                              e.stopPropagation();
                              const willExpand = !expandedDetails[uniqueKey]
                              setExpandedDetails(prev => ({
                                ...prev,
                                [uniqueKey]: willExpand
                              }));
                              // Lazy load sub-detalhes ao expandir pela primeira vez
                              if (willExpand && !loadingSubDetails[uniqueKey] && (!detail._details || detail._details.length === 0)) {
                                setLoadingSubDetails(prev => ({ ...prev, [uniqueKey]: true }))
                                await fetchSubDetailsForRecord(detail, tableName, pkCol, detailIdValue)
                                setLoadingSubDetails(prev => ({ ...prev, [uniqueKey]: false }))
                              }
                            }}
                            className={cn(
                              "p-1.5 rounded-lg shadow-sm transition-all",
                              loadingSubDetails[uniqueKey]
                                ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 animate-pulse cursor-wait"
                                : expandedDetails[uniqueKey]
                                ? "bg-indigo-600 text-white"
                                : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                            )}
                          >
                            {loadingSubDetails[uniqueKey] 
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", expandedDetails[uniqueKey] && "rotate-180")} />
                            }
                          </button>
                        )}
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); onEditDetail?.(detail); }}
                          className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 shadow-sm transition-all"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); onDeleteDetail?.(detail); }}
                          className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 shadow-sm transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Efeito Cortina (Edição In-place) */}
                    {expandedDetails[uniqueKey] && (
                      <div className="p-6 bg-white dark:bg-neutral-950 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 animate-in slide-in-from-top-2 duration-300 space-y-8 shadow-inner">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {(() => {
                            const detailFieldsForThisModel = fields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase());
                            return detailFieldsForThisModel.map(field => (
                              <div key={field.id} className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                                  {field.display_name}
                                </label>
                                {(() => {
                                  const baseCol = field.db_column_name.split('.').pop() || field.db_column_name;
                                  const value = detail[baseCol] || detail[baseCol.toUpperCase()] || detail[field.db_column_name] || '';
                                  
                                  const handleInlineChange = (newVal: any) => {
                                    // Se parentData for o formData principal, atualizamos o topo
                                    if (parentData === formData) {
                                      const newDetails = (formData._details || []).map((d: any) => {
                                        const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`;
                                        if (dPk === detailIdValue && d.model_name === tableName) {
                                          return { ...d, [baseCol]: newVal };
                                        }
                                        return d;
                                      });
                                      setFormData({ ...formData, _details: newDetails });
                                    } else {
                                      // Se parentData for um registro de detalhe, atualizamos dentro dele (recursivo)
                                      const newParentDetails = (parentData._details || []).map((d: any) => {
                                        const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`;
                                        if (dPk === detailIdValue && d.model_name === tableName) {
                                          return { ...d, [baseCol]: newVal };
                                        }
                                        return d;
                                      });
                                      
                                      // Agora precisamos atualizar este parentData dentro do formData._details original
                                      const updatedParentData = { ...parentData, _details: newParentDetails };
                                      const newTopDetails = (formData._details || []).map((td: any) => {
                                        // Encontrar o parentData original. Precisamos do seu PK.
                                        // Como não temos o nome da tabela do pai aqui, assumimos que id/ID resolvem ou comparamos o objeto todo
                                        if (td === parentData || (td.id && td.id === parentData.id) || (td.ID && td.ID === parentData.ID)) {
                                          return updatedParentData;
                                        }
                                        return td;
                                      });
                                      setFormData({ ...formData, _details: newTopDetails });
                                    }
                                  };

                                  const fieldConfig = field.config?.form_config || field.config || {};
                                  const type = fieldConfig.component?.type || 'text';

                                  if (type === 'textarea') {
                                    return (
                                      <textarea
                                        value={value}
                                        onChange={(e) => handleInlineChange(e.target.value)}
                                        className="w-full px-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        rows={3}
                                      />
                                    );
                                  }

                                  if (['select', 'radio'].includes(type)) {
                                    const options = relationalOptions[field.id] || parseFixedOptions(fieldConfig.component?.options);
                                    return (
                                      <select
                                        value={value}
                                        onChange={(e) => handleInlineChange(e.target.value)}
                                        className="w-full px-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                      >
                                        <option value="">Selecione...</option>
                                        {options.map((opt: any) => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                      </select>
                                    );
                                  }

                                  return (
                                    <input
                                      type={type === 'number' ? 'number' : 'text'}
                                      value={value}
                                      onChange={(e) => handleInlineChange(e.target.value)}
                                      className="w-full px-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    />
                                  );
                                })()}
                              </div>
                            ));
                          })()}
                        </div>

                        {/* SUB-DETALHES RECURSIVOS NA CORTINA */}
                        {(() => {
                          const subTables = Array.from(new Set(
                            fields
                              .filter(f => joins.some(j => j.from?.toLowerCase() === tableName.toLowerCase() && j.to?.toLowerCase() === f.model_name?.toLowerCase()))
                              .map(f => f.model_name)
                          ));

                          if (subTables.length > 0) {
                            return (
                              <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 space-y-6">
                                {subTables.map(st => (
                                  <div key={st} className="pl-4 border-l-2 border-indigo-100 dark:border-indigo-900/30">
                                    {renderDetailSection(st, detail)}
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                  );
                });
            })()}
        {(!(parentData?._details || []).some((d: any) => d.model_name?.toLowerCase() === tableName?.toLowerCase())) && (
          <div className="py-12 text-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl">
            <p className="text-xs text-neutral-400 italic">Nenhum registro de {(() => {
              const modelId = fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.model_id
              return dictionary[modelId || ''] || tableName
            })()} encontrado.</p>
          </div>
        )}
      </div>
    </div>
    )
  }

  return (
    <div className={cn("flex flex-col", isPageMode ? "bg-white dark:bg-neutral-900/50 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-xl" : "h-full")}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
            {icons[mode]}
          </div>
          <div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{titles[mode]}</h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
              {mode === 'create' ? t('runtime.record_drawer.new_item') : t('runtime.record_drawer.record_id').replace('{id}', initialData?.id || 'N/A')}
            </p>
          </div>
        </div>
        
        {isPageMode && (
          <button 
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> {t('runtime.back_to_list', 'Voltar para Lista')}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        {logicType === 'master_detail' && detailDisplayMode === 'tabs' && detailTables.length > 0 && (
          <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('master')
                onTabChange?.('master')
              }}
              className={cn(
                "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-b-2",
                activeTab === 'master' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-neutral-400 hover:text-neutral-600'
              )}
            >
              {t('runtime.master_details.main_data', 'Dados Principais')}
            </button>
            {detailTables.map(tableName => {
              const modelId = fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.model_id
              const displayLabel = dictionary[modelId || ''] || tableName
              return (
                <button
                  key={tableName}
                  type="button"
                  onClick={() => {
                    setActiveTab(tableName)
                    onTabChange?.(tableName)
                  }}
                  className={cn(
                    "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-b-2",
                    activeTab === tableName ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-neutral-400 hover:text-neutral-600'
                  )}
                >
                  {displayLabel}
                </button>
              )
            })}
          </div>
        )}

        <div className={cn("flex-1 space-y-12", isPageMode ? "" : "overflow-y-auto custom-scrollbar pr-2")}>
          {(detailDisplayMode === 'sections' || activeTab === 'master') && (
            <div className="space-y-6">
              {detailDisplayMode === 'sections' && logicType === 'master_detail' && (
                <div className="flex items-center gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-800 dark:text-neutral-200">
                    {t('runtime.master_details.main_data', 'Dados Principais')}
                  </h3>
                </div>
              )}
              <div className={cn("grid gap-6", isPageMode ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                {(() => {
                  const seenFields = new Set();
                  return masterFields.map(field => {
                    if (seenFields.has(field.id)) return null;
                    seenFields.add(field.id);
                    return <div key={field.id}>{renderField(field)}</div>;
                  });
                })()}
              </div>
            </div>
          )}

          {logicType === 'master_detail' && detailDisplayMode === 'sections' && detailTables.map(tableName => (
            <div key={tableName} className="pt-4 space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-800 dark:text-neutral-200">
                  {(() => {
                    const modelId = fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.model_id
                    return dictionary[modelId || ''] || tableName
                  })()}
                </h3>
              </div>
              {renderDetailSection(tableName)}
            </div>
          ))}

          {logicType === 'master_detail' && detailDisplayMode === 'tabs' && activeTab !== 'master' && (
            renderDetailSection(activeTab)
          )}
        </div>

        <div className={cn(
          "pt-8 mt-auto border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-3 sticky bottom-0",
          footerBgClass
        )}>
          <button 
            type="button"
            onClick={onCancel}
            className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
          >
            {mode === 'view' ? t('runtime.close') : t('common.cancel')}
          </button>
          
          {mode !== 'view' && (
            <button 
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isLoading ? t('runtime.saving') : t('common.save')}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

function parseFixedOptions(optionsString: string) {
  if (!optionsString) return [];
  if (Array.isArray(optionsString)) return optionsString;
  return String(optionsString).split(',').map(opt => {
    const [label, value] = opt.split(':');
    return { label: (label || '').trim(), value: (value || label || '').trim() };
  });
}
