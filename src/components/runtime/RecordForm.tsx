'use client'

import { useState, useEffect, useRef } from 'react'
import { evaluateFormula } from '@/lib/formulaEvaluator'
import { Loader2, Save, Eye, Pencil, Plus, Trash2, ArrowLeft, Check, ChevronDown, ChevronUp, Zap, Link, Database, Globe, Maximize2, PanelRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { FileUploaderInput } from '@/components/runtime/FileUploaderInput'

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
    if (lowerKey === lowerPath) return data[key]
    
    const keyBase = key.split('.').pop()?.toLowerCase()
    if (keyBase && (keyBase === lowerPath || (lowerBase && keyBase === lowerBase))) return data[key]
  }

  return undefined
}

const getActionIcon = (iconName: string, className?: string) => {
  return <DynamicIcon icon={iconName} className={className || "w-4 h-4"} />
}

const getFontFamily = (font?: string) => {
  if (!font) return undefined;
  const cleanFont = font.replace(' (Padrão)', '');
  if (cleanFont.includes('Mono')) return `"${cleanFont}", monospace`;
  return `"${cleanFont}", sans-serif`;
}

const getFontSize = (size?: string) => {
  if (!size) return undefined;
  if (!isNaN(Number(size))) return `${size}px`;
  return size;
}

// Helper para aplicar máscara a valores (apenas para exibição)
const applyMask = (value: any, mask: string) => {
  if (!mask || value === null || value === undefined || value === '') return value

  if (mask === '0.000') {
    const num = Number(value)
    if (!isNaN(num)) return num.toLocaleString('pt-BR')
    return value
  }

  if (mask === '0.000,00') {
    const num = Number(value)
    if (!isNaN(num)) return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return value
  }

  // Máscaras de string convencionais (ex: 000.000.000-00)
  const strVal = String(value)
  const numbers = strVal.replace(/\D/g, '')
  let maskedValue = ''
  let numberIndex = 0

  for (let i = 0; i < mask.length; i++) {
    if (numberIndex >= numbers.length) break

    if (mask[i] === '0') {
      maskedValue += numbers[numberIndex]
      numberIndex++
    } else {
      maskedValue += mask[i]
    }
  }
  return maskedValue
}

const parseMaskedNumber = (value: string, mask: string) => {
  if (!value) return ''
  const numbers = value.replace(/\D/g, '')
  if (!numbers) return ''

  if (mask === '0.000,00') {
    return parseInt(numbers, 10) / 100
  }
  if (mask === '0.000') {
    return parseInt(numbers, 10)
  }
  return value
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
  masterTabTitle?: string
  detailsTabTitles?: Record<string, string>
  detailsItemTitles?: Record<string, string>
  tabsStyleConfig?: any
  detailsDisplayMode?: Record<string, 'tabs' | 'sections'>
  isPageMode?: boolean
  onEditDetail?: (detail: any) => void
  onDeleteDetail?: (detail: any) => void
  onAddDetail?: (tableName: string, parentId?: any) => void
  joins?: any[]
  dictionary?: Record<string, string>
  initialTab?: string
  onTabChange?: (tab: string) => void
  customActions?: any[]
  onCustomAction?: (action: any, row?: any) => void
  detailsInlineTypes?: Record<string, boolean>
  detailsInterfaceTypes?: Record<string, string>
  footerBgClass?: string
  projectId?: string
  secretToken?: string
  tunnelChannel?: any
  isTunnelReady?: boolean
  project?: any
  refreshTrigger?: number
  renderOnlyDetail?: string
  hideHeader?: boolean
  formHeaderTitle?: string
  formHeaderSubtitleField?: string
  projectRelations?: any[]
}

const getActionColorClasses = (color: string) => {
  const normalized = color?.toLowerCase() || 'indigo'
  switch (normalized) {
    case 'emerald':
      return {
        text: 'text-emerald-650 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-800/50',
        hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300'
      }
    case 'amber':
      return {
        text: 'text-amber-650 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        border: 'border-amber-200 dark:border-amber-800/50',
        hover: 'hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-305'
      }
    case 'red':
      return {
        text: 'text-red-655 dark:text-red-405',
        bg: 'bg-red-50 dark:bg-red-950/30',
        border: 'border-red-200 dark:border-red-800/50',
        hover: 'hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-305'
      }
    case 'blue':
      return {
        text: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-800/50',
        hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-350'
      }
    case 'violet':
      return {
        text: 'text-violet-650 dark:text-violet-400',
        bg: 'bg-violet-50 dark:bg-violet-950/30',
        border: 'border-violet-200 dark:border-violet-800/50',
        hover: 'hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-305'
      }
    case 'pink':
      return {
        text: 'text-pink-655 dark:text-pink-400',
        bg: 'bg-pink-50 dark:bg-pink-950/30',
        border: 'border-pink-200 dark:border-pink-800/50',
        hover: 'hover:bg-pink-100 dark:hover:bg-pink-900/30 hover:text-pink-700 dark:hover:text-pink-305'
      }
    case 'rose':
      return {
        text: 'text-rose-600 dark:text-rose-400',
        bg: 'bg-rose-50 dark:bg-rose-950/30',
        border: 'border-rose-200 dark:border-rose-800/50',
        hover: 'hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-700 dark:hover:text-rose-350'
      }
    case 'neutral':
    case 'gray':
      return {
        text: 'text-neutral-600 dark:text-neutral-400',
        bg: 'bg-neutral-50 dark:bg-neutral-950/30',
        border: 'border-neutral-200 dark:border-neutral-800/50',
        hover: 'hover:bg-neutral-100 dark:hover:bg-neutral-900/30 hover:text-neutral-700 dark:hover:text-neutral-300'
      }
    case 'indigo':
    default:
      return {
        text: 'text-indigo-650 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-950/30',
        border: 'border-indigo-200 dark:border-indigo-800/50',
        hover: 'hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-305'
      }
  }
}

const getBulkActionClasses = (color: string) => {
  const normalized = color?.toLowerCase() || 'indigo'
  switch (normalized) {
    case 'emerald':
      return 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
    case 'amber':
      return 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20'
    case 'red':
      return 'bg-red-655 hover:bg-red-500 text-white shadow-red-500/20'
    case 'blue':
      return 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
    case 'violet':
      return 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/20'
    case 'pink':
      return 'bg-pink-655 hover:bg-pink-500 text-white shadow-pink-500/20'
    case 'rose':
      return 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20'
    case 'neutral':
    case 'gray':
      return 'bg-neutral-600 hover:bg-neutral-500 text-white shadow-neutral-500/20'
    case 'indigo':
    default:
      return 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
  }
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
  detailsDisplayMode = {},
  tabsStyleConfig,
  isPageMode = false,
  onEditDetail,
  onDeleteDetail,
  onAddDetail,
  joins = [],
  dictionary = {},
  initialTab = 'master',
  onTabChange,
  customActions = [],
  onCustomAction,
  detailsInlineTypes = {},
  detailsInterfaceTypes = {},
  footerBgClass = "bg-white dark:bg-neutral-950",
  projectId,
  secretToken = 'test-token',
  tunnelChannel,
  isTunnelReady,
  project,
  masterTabTitle,
  detailsTabTitles,
  detailsItemTitles,
  refreshTrigger = 0,
  renderOnlyDetail,
  hideHeader = false,
  formHeaderTitle,
  formHeaderSubtitleField,
  projectRelations = []
}: RecordFormProps) {
  const { t } = useI18n()
  const [formData, setFormData] = useState<any>(initialData || {})
  const [activeTab, setActiveTab] = useState<'master' | string>(initialTab)

  const formRef = useRef<HTMLFormElement>(null)
  
  useEffect(() => {
    if (mode === 'view') return;
    const timer = setTimeout(() => {
      if (formRef.current) {
        // Find the first visible and enabled input/textarea/select
        const firstInput = formRef.current.querySelector('input:not([type="hidden"]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled]):not([readonly])') as HTMLElement
        if (firstInput) {
          firstInput.focus()
        }
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [mode, initialData, refreshTrigger, activeTab])
  const [relationalOptions, setRelationalOptions] = useState<Record<string, any[]>>({})
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({})
  const [loadingSubDetails, setLoadingSubDetails] = useState<Record<string, boolean>>({})

  const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embedded') === 'true'
  const handleCancel = () => {
    if (isEmbedded) {
      window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')
    } else {
      onCancel()
    }
  }

  // Busca sub-detalhes de um registro sob demanda (lazy loading)
  // chamado ao expandir a cortina de um detalhe pela primeira vez
  const fetchSubDetailsForRecord = async (detail: any, tableName: string, pkCol: string, pkValue: any) => {
    const subJoins = joins.filter(j => j.from?.toLowerCase() === tableName?.toLowerCase())
    if (subJoins.length === 0) return

    const supabaseClient = createClient()
    const allSubDetails: any[] = []

    for (const join of subJoins) {
      if (!pkValue) continue

      let data: any[] = []

      if (projectId) {
        // Query via the secure data tunnel
        const queryId = crypto.randomUUID()

        console.log(`[MetaBuilder] RecordForm fetching sub-details from ${join.to} via tunnel where ${join.foreignKey} = ${pkValue}`)

        try {
          data = await new Promise<any[]>((resolve, reject) => {
            const isTemporary = !tunnelChannel || !isTunnelReady
            const channelName = `tunnel:${projectId}`
            const channel = isTemporary ? supabaseClient.channel(channelName) : tunnelChannel
            let resolved = false

            const handleResult = (payload: any) => {
              if (payload.payload?.queryId === queryId) {
                resolved = true
                cleanup()
                if (payload.payload.success) {
                  resolve(payload.payload.data || [])
                } else {
                  reject(new Error(payload.payload.error || 'Error fetching sub-details'))
                }
              }
            }

            const cleanup = () => {
              try {
                const bindings = channel.bindings?.broadcast
                if (Array.isArray(bindings)) {
                  const cleanBindings = bindings.filter((b: any) => {
                    const match = b.callback === handleResult
                    if (match && channel.channelAdapter) {
                      channel.channelAdapter.off('broadcast', b.ref)
                    }
                    return !match
                  })
                  channel.bindings.broadcast = cleanBindings
                }

                if (isTemporary) {
                  channel.unsubscribe()
                  supabaseClient.removeChannel(channel)
                }
              } catch (err) {
                console.error('[MetaBuilder] Error cleaning up channel in RecordForm:', err)
              }
            }

            channel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
            channel.on('broadcast', { event: 'sql_result' }, handleResult)

            let fetchJoins = (joins || []).filter(j => j.from?.toLowerCase() === join.to.toLowerCase())
          
            const modelId = project?.models?.find((m: any) => m.db_table_name === join.to)?.id
            const customField = detailsItemTitles?.[modelId || '']
            if (customField && customField.includes('.')) {
              const relatedTable = customField.split('.')[0]
              const hasJoin = fetchJoins.some(j => j.to === relatedTable || j.toTable === relatedTable)
              if (!hasJoin) {
                const sourceModel = project?.models?.find((m: any) => m.db_table_name === join.to)
              const linkField = sourceModel?.fields?.find((f: any) => 
                f.foreign_key_table === relatedTable || 
                f.db_column_name === `${relatedTable}_id` ||
                (relatedTable.endsWith('s') && f.db_column_name === `${relatedTable.slice(0, -1)}_id`) ||
                (relatedTable.endsWith('es') && f.db_column_name === `${relatedTable.slice(0, -2)}_id`)
              )
              if (linkField) {
                  fetchJoins.push({
                    from: join.to,
                    local: linkField.db_column_name,
                    localKey: linkField.db_column_name,
                    to: relatedTable,
                    foreignKey: linkField.foreign_key_column || 'id',
                    type: 'left'
                  })
                }
              }
            }

            const sendPayload = {
              type: 'broadcast',
              event: 'sql_query',
              payload: {
                queryId,
                table: join.to,
                schemaName: project?.models?.find((m: any) => m.db_table_name === join.to)?.db_schema_name || project?.slug || 'public',
                action: 'select',
                token: secretToken,
                joins: fetchJoins,
                filters: { [join.foreignKey]: String(pkValue) },
                limit: 100,
                offset: 0
              }
            }

            if (isTemporary) {
              channel.subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                  channel.send(sendPayload)
                }
              })
            } else {
              channel.send(sendPayload)
            }

            // Timeout fallback
            setTimeout(() => {
              if (!resolved) {
                resolved = true
                cleanup()
                console.warn(`[MetaBuilder] Timeout fetching sub-details in RecordForm for queryId ${queryId}`)
                resolve([])
              }
            }, 8000)
          })
        } catch (err) {
          console.error(`[MetaBuilder] Error fetching sub-details from ${join.to} via tunnel:`, err)
        }
      } else {
        // Fallback to direct supabase query
        const { data: directData } = await (supabaseClient as any)
          .from(join.to)
          .select('*')
          .eq(join.foreignKey, String(pkValue))
        if (directData) {
          data = directData
        }
      }

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
        const isRelationalComp = comp?.type && (['select', 'radio', 'checkbox', 'Combo (Select)', 'Radio Buttons', 'Checkbox Group'].includes(comp.type) || comp.options_type === 'relational' || comp.options_type === 'enumeration')
        if (isRelationalComp && comp.options_type === 'relational' && comp.rel_table) {
          try {
            if (projectId) {
              if (!tunnelChannel || !isTunnelReady) continue;
              const queryId = crypto.randomUUID()
              const rawQuery = `SELECT "${comp.rel_label}", "${comp.rel_value}" FROM "${comp.rel_table}"`

              const schemaToUse = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === comp.rel_table?.toLowerCase())?.db_schema_name || project?.slug || 'public'
              console.log(`[MetaBuilder:RecordForm] Fetching relational options for ${comp.rel_table} with schemaName:`, schemaToUse)
              console.log(`[MetaBuilder:RecordForm] Query:`, rawQuery)

              const data = await new Promise<any[]>((resolve, reject) => {
                let resolved = false
                const cleanup = () => {
                  try {
                    const bindings = tunnelChannel.bindings?.broadcast
                    if (Array.isArray(bindings)) {
                      const cleanBindings = bindings.filter((b: any) => {
                        const match = b.callback === handleResult
                        if (match && tunnelChannel.channelAdapter) {
                          tunnelChannel.channelAdapter.off('broadcast', b.ref)
                        }
                        return !match
                      })
                      tunnelChannel.bindings.broadcast = cleanBindings
                    }
                  } catch (e) { }
                }

                const handleResult = (payload: any) => {
                  if (payload.payload?.queryId === queryId) {
                    resolved = true
                    cleanup()
                    console.log(`[MetaBuilder:RecordForm] Relational options for ${comp.rel_table} returned:`, payload.payload)
                    if (payload.payload.success) resolve(payload.payload.data || [])
                    else reject(new Error(payload.payload.error || 'Error fetching relational options'))
                  }
                }
                tunnelChannel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
                tunnelChannel.on('broadcast', { event: 'sql_result' }, handleResult)

                tunnelChannel.send({
                  type: 'broadcast',
                  event: 'sql_query',
                  payload: {
                    queryId,
                    table: comp.rel_table,
                    schemaName: schemaToUse,
                    action: 'select',
                    query: rawQuery,
                    sql: rawQuery,
                    token: secretToken,
                    joins: [],
                    limit: 1000,
                    offset: 0
                  }
                })

                setTimeout(() => {
                  if (!resolved) {
                    resolved = true
                    console.warn(`[MetaBuilder:RecordForm] Timeout fetching relational options for ${comp.rel_table}`)
                    resolve([])
                  }
                }, 8000)
              })

              if (data) {
                newOptions[field.id] = data.map(item => ({
                  label: item[comp.rel_label] || item[comp.rel_label.toLowerCase()] || item[comp.rel_label.toUpperCase()],
                  value: item[comp.rel_value] || item[comp.rel_value.toLowerCase()] || item[comp.rel_value.toUpperCase()]
                }))
              }
            } else {
              const { data } = await supabase
                .from(comp.rel_table)
                .select(`${comp.rel_label}, ${comp.rel_value}`)

              if (data) {
                newOptions[field.id] = data.map(item => ({
                  label: item[comp.rel_label],
                  value: item[comp.rel_value]
                }))
              }
            }
          } catch (err) {
            console.error(`Error fetching relational options for field ${field.id}:`, err)
          }
        } else if (isRelationalComp && comp.options_type === 'enumeration' && comp.rel_table) {
          try {
            const { data } = await supabase
              .from('project_enumerations')
              .select('values')
              .eq('id', comp.rel_table)
              .single()

            if (data && data.values) {
              newOptions[field.id] = data.values.map((v: any) => ({
                label: v.description || v.value,
                value: v.value
              }))
            }
          } catch (err) {
            console.error(`Error fetching enumeration options for field ${field.id}:`, err)
          }
        }
      }
      setRelationalOptions(newOptions)
    }

    if (fields.length > 0) {
      fetchAllRelational()
    }
  }, [fields, isTunnelReady, tunnelChannel, project, projectId, refreshTrigger])

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

  const masterFields = fields.filter(f => {
    const isMaster = !f.model_id ||
      (currentMasterId && String(f.model_id) === String(currentMasterId)) ||
      (masterModelName && f.model_name?.toLowerCase().trim() === masterModelName?.toLowerCase().trim())

    if (!isMaster) return false
    return (!!masterModelName || f.zone === 3 || f.zone === '3' || f.zone === undefined || f.zone === null)
  })

  const detailFields = fields.filter(f => {
    const isMaster = (currentMasterId && String(f.model_id) === String(currentMasterId)) ||
      (masterModelName && f.model_name?.toLowerCase().trim() === masterModelName?.toLowerCase().trim())
    return f.model_id && !isMaster
  })

  // FILTRAGEM HIERÁRQUICA: 
  // Só mostramos como aba as tabelas que são FILHAS DIRETAS do mestre atual no array de JOINS
  const detailTables = Array.from(new Set(
    detailFields
      .filter(f => {
        if (masterModelName && f.model_name?.toLowerCase().trim() === masterModelName?.toLowerCase().trim()) return false;
        // Se não houver joins, mostra tudo (fallback)
        if (!joins || joins.length === 0) return true
        // Verifica se existe um join de masterModelName -> f.model_name
        return joins.some(j => (j.from?.toLowerCase() === masterModelName?.toLowerCase()) && j.to?.toLowerCase() === f.model_name?.toLowerCase())
      })
      .map(f => f.model_name || 'Details')
  ))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const payloadToSave = { ...formData }
    Object.keys(payloadToSave).forEach(key => {
      if (key.startsWith('virt_') || fields.find((f: any) => f.db_column_name === key)?.is_virtual) {
        delete payloadToSave[key]
      }
    })

    console.log('[RecordForm] handleSubmit - payload keys:', Object.keys(payloadToSave), '| payload:', JSON.stringify(payloadToSave).slice(0, 500))
    onSave(payloadToSave)
  }

  useEffect(() => {
    const data = { ...(initialData || {}) }
    
    console.log('[RecordForm Debug] useEffect initialData trigger.', { mode, initialDetailsLength: data._details?.length, detailTables })
    
    // Inject empty details for master_detail or cadastro if not provided
    if (mode === 'create' && (!data._details || data._details.length === 0)) {
      const dDetails: any[] = []
      const newExpandedState: Record<string, boolean> = {}
      
      // Use the exact same detailTables array that determines the tabs
      detailTables.forEach(tableName => {
        const newId = crypto.randomUUID()
        dDetails.push({
          model_name: tableName,
          _isNew: true,
          id: newId
        })
        newExpandedState[`detail-${tableName}-${newId}`] = true
      })
      
      console.log('[RecordForm Debug] Injecting empty details!', { dDetails })
      data._details = dDetails
      
      // Expande automaticamente as abas recém injetadas
      setExpandedDetails(prev => ({ ...prev, ...newExpandedState }))
      
      // Foco automático no primeiro campo da tela para o novo registro
      setTimeout(() => {
        const firstInput = document.querySelector('input:not([type="hidden"]), select, textarea') as HTMLElement
        if (firstInput) firstInput.focus()
      }, 300)
    }
    
    setFormData(data)
    // Using JSON.stringify(detailTables) to safely include it as a dependency without causing loops
  }, [initialData, mode, logicType, masterModelId, fields, JSON.stringify(detailTables)])

  // Motor Reativo de Fórmulas
  useEffect(() => {
    if (!fields) return;

    let hasChanges = false;
    const newFormData = { ...formData };

    // Agrupa os detalhes pela tabela (model_name) para alimentar as funções de agregação (SOMA, etc)
    const detailsData: Record<string, any[]> = {};
    (formData._details || []).forEach((d: any) => {
      const tableName = d.model_name || d.model;
      if (tableName) {
        if (!detailsData[tableName]) detailsData[tableName] = [];
        detailsData[tableName].push(d);
      }
    });

    // Avalia todos os campos que possuem uma fórmula configurada
    fields.forEach(field => {
      const tokens = field.config?.content?.formula_tokens || [];
      if (tokens.length === 0) return;

      const mainModelName = masterModelName || project?.models?.find((m: any) => m.id === masterModelId)?.db_table_name;
      const isMasterZone = !field.model_name || !mainModelName || field.model_name.toLowerCase() === mainModelName.toLowerCase();

      if (isMasterZone) {
        const computedValue = evaluateFormula(tokens, formData, detailsData, formData, mainModelName);
        // Evita loop infinito atualizando apenas se o valor realmente mudou
        if (computedValue !== null && computedValue !== undefined && String(computedValue) !== String(formData[field.db_column_name])) {
          newFormData[field.db_column_name] = computedValue;
          hasChanges = true;
        }
      } else {
        const detailTableName = field.model_name;
        if (newFormData._details) {
          newFormData._details = newFormData._details.map((row: any) => {
            if (row.model_name?.toLowerCase() !== detailTableName?.toLowerCase() && row.model?.toLowerCase() !== detailTableName?.toLowerCase()) return row;

            const mappedRow = { ...formData, ...row };
            Object.keys(row).forEach(k => {
               mappedRow[`${detailTableName}.${k}`] = row[k];
            });

            const computedValue = evaluateFormula(tokens, mappedRow, detailsData, row, detailTableName);
            if (computedValue !== null && computedValue !== undefined && String(computedValue) !== String(row[field.db_column_name])) {
              hasChanges = true;
              return { ...row, [field.db_column_name]: computedValue };
            }
            return row;
          });
        }
      }
    });

    if (hasChanges) {
      setFormData((prev: any) => {
        const next = { ...prev };
        Object.keys(newFormData).forEach(k => {
          if (newFormData[k] !== formData[k]) {
            next[k] = newFormData[k];
          }
        });
        return next;
      });
    }
  }, [formData, fields]);

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

    const fieldCustomActions = customActions?.filter((a: any) => {
      const ctxs = a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : [a.context];
      if (!ctxs.includes('field_group')) return false;
      const targets = a.group_fields || (a.group_field ? [a.group_field] : []);
      if (targets.includes(field.db_column_name) && !targets.some((t: string) => t.includes(':'))) return true;

      // Identify zone: compare field.model_id with main usecase's masterModelId
      const mainModelName = project?.models?.find((m: any) => m.id === masterModelId)?.db_table_name;
      const isMasterZone = !mainModelName || mainModelName.toLowerCase() === masterModelName?.toLowerCase();
      const zoneStr = isMasterZone ? 'master' : 'detail';
      
      if (targets.includes(`${zoneStr}:${field.db_column_name}`)) return true;

      // Fallback: se não for mestre-detalhe, aceita tanto master: quanto detail: para o campo,
      // pois tudo é renderizado no formulário principal de qualquer forma.
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
    const width = comp.width || '100%'

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

    const options = (comp.options_type === 'relational' || comp.options_type === 'enumeration')
      ? (relationalOptions[field.id] || [])
      : parseFixedOptions(comp.fixed_options)
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
                    onClick={() => onCustomAction?.(action, formData)}
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
                    onClick={() => onCustomAction?.(action, formData)}
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

  const renderDetailSection = (tableName: string, parentData: any = formData, titleNode?: any, hideToolbar?: boolean) => {
    const targetModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === tableName?.toLowerCase())
    const modelId = targetModel?.id || fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.model_id
    const displayLabel = detailsTabTitles?.[modelId || ''] || dictionary[modelId || ''] || targetModel?.display_name || fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.display_model_name || tableName

    return (
      <div className="space-y-2">
        {!hideToolbar && (
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
          {titleNode ?? <div />}
          {/* lado direito: todos os controles */}
          <div className="flex items-center gap-1">
            {customActions.filter(a => (a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : [a.context]).includes('detail_top')).map(action => {
              const colors = getActionColorClasses(action.color)
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onCustomAction?.(action, formData)}
                  className={cn(
                    "p-1.5 rounded-lg border transition-all shadow-sm bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700",
                    colors.text,
                    colors.hover
                  )}
                  title={action.label}
                >
                  {getActionIcon(action.icon, "w-4 h-4")}
                </button>
              )
            })}

            {/* Expande/Recolhe Tudo */}
            {(parentData?._details || []).some((d: any) => d.model_name?.toLowerCase() === tableName?.toLowerCase()) && (
              <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={async () => {
                    const currentDetails = (parentData?._details || []).filter((d: any) => d.model_name?.toLowerCase() === tableName?.toLowerCase())
                    const pkField = fields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase()).find(f => f.is_primary_key) || { db_column_name: 'id' }
                    const pkCol = pkField.db_column_name.split('.').pop() || 'id'
                    const newState = { ...expandedDetails }
                    currentDetails.forEach((d: any, idx: number) => {
                      const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`
                      newState[`detail-${tableName}-${dPk}`] = true
                    })
                    setExpandedDetails(newState)
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
                      newState[`detail-${tableName}-${dPk}`] = false
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

            {/* Adicionar registro */}
            <button
              type="button"
              onClick={() => {
                if (true) {
                  const newTempId = `temp-${Date.now()}`
                  const newRecord = { id: newTempId, model_name: tableName, _isNew: true }
                  setFormData((prev: any) => ({ ...prev, _details: [...(prev._details || []), newRecord] }))
                  setExpandedDetails((prev: any) => ({ ...prev, [`detail-${tableName}-${newTempId}`]: true }))
                  
                  // Foco no primeiro campo do novo item
                  setTimeout(() => {
                    const container = document.getElementById(`detail-container-detail-${tableName}-${newTempId}`)
                    if (container) {
                      const firstInput = container.querySelector('input:not([type="hidden"]), select, textarea') as HTMLElement
                      if (firstInput) firstInput.focus()
                    }
                  }, 150)
                }
              }}
              className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shadow-sm"
              title={t('common.add_record', 'Adicionar')}
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Abrir Modal/Drawer */}
            {true && (
              <button
                type="button"
                onClick={() => onAddDetail?.(tableName, parentData.id || parentData.ID)}
                title={detailsInterfaceTypes[modelId || ''] === 'drawer' ? t('common.open_drawer', 'Abrir Gaveta') : t('common.open_modal', 'Abrir Modal')}
                className="p-1.5 bg-neutral-50 dark:bg-neutral-800 text-neutral-400 hover:text-indigo-600 rounded-lg transition-colors border border-transparent hover:border-indigo-200"
              >
                {detailsInterfaceTypes[modelId || ''] === 'drawer' ? <PanelRight className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
        )}

        <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {(() => {
            const seenIds = new Set();
            const detailsToRender = (parentData?._details || [])
              .filter((d: any) => d.model_name?.toLowerCase() === tableName?.toLowerCase());
            
            console.log('[RecordForm Render] detailsToRender for', tableName, 'is', detailsToRender.length, 'items', { detailsToRender, parentDetails: parentData?._details });

            return detailsToRender.map((detail: any, idx: number) => {
              const pkField = fields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase()).find(f => f.is_primary_key) || { db_column_name: 'id' };
              const pkCol = pkField.db_column_name.split('.').pop() || 'id';
              const detailIdValue = detail[pkCol] || detail[pkCol.toUpperCase()] || detail.id || detail.ID || `idx-${idx}`;
              const uniqueKey = `detail-${tableName}-${detailIdValue}`;

              if (seenIds.has(uniqueKey)) return null;
              seenIds.add(uniqueKey);

              return (
                <div key={uniqueKey} id={`detail-container-${uniqueKey}`} className={cn("flex flex-col gap-1 rounded-2xl transition-all duration-300", expandedDetails[uniqueKey] ? "bg-indigo-50/50 dark:bg-indigo-950/20 ring-1 ring-indigo-500/20 p-0.5" : "")}>
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
                        {(() => {
                          if (detail._isNew || String(detailIdValue).startsWith('temp-')) {
                            return t('common.new_record', 'Novo Registro');
                          }
                          const customField = detailsItemTitles?.[modelId || ''];
                          if (customField) {
                            let val: any;
                            
                            if (customField.includes('.')) {
                              const parts = customField.split('.');
                              val = detail[customField] ?? detail[parts[0]]?.[parts[1]] ?? detail[parts[1]];
                            } else {
                              val = detail[customField];
                            }
                            
                            // Tradução Automática: Se o campo for um relacionamento (Combo), troca o ID pelo Label
                            const baseField = customField.includes('.') ? customField.split('.')[0] : customField;
                            const safeBase = baseField?.toLowerCase()?.trim() || '';
                            const checkMatch = (f: any) => {
                               const fName = f.db_column_name?.toLowerCase()?.trim() || '';
                               return fName === safeBase || fName.endsWith(`.${safeBase}`) || fName.endsWith(`_${safeBase}`);
                            };
                            const titleFieldDef = detailFields.find(checkMatch) || fields.find(checkMatch);
                            
                            if (titleFieldDef && val !== undefined && val !== null) {
                               const opts = relationalOptions[titleFieldDef.id] || [];
                               const matchedOpt = opts.find(o => String(o.value) === String(val));
                               if (matchedOpt && matchedOpt.label) {
                                  val = matchedOpt.label;
                               }
                            }

                            if (val !== undefined && val !== null && val !== '') {
                              if (typeof val === 'object') {
                                return String(val.display_name || val.name || val.nome || val.titulo || val.title || val.id || JSON.stringify(val));
                              }
                              return String(val);
                            }
                          }
                          return detail.display_name || detail.name || detail.nome || detail.titulo || detail.label || `Item #${idx + 1}`;
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 transition-all">
                      {/* Botão de Cortina (Na Lista) */}
                      {true && (
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
                      {customActions.filter(a => (a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : [a.context]).includes('detail_row')).map(action => {
                        const colors = getActionColorClasses(action.color)
                        return (
                          <button
                            key={action.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCustomAction?.(action, detail); }}
                            className={cn(
                              "p-1.5 rounded-lg border transition-all shadow-sm bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700",
                              colors.text,
                              colors.hover
                            )}
                            title={action.label}
                          >
                            {getActionIcon(action.icon, "w-3.5 h-3.5")}
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEditDetail?.(detail); }}
                        className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 shadow-sm transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Se o registro é novo (ainda não salvo no banco), apenas remove da lista local
                          if (detail._isNew || String(detailIdValue).startsWith('temp-')) {
                            setFormData((prev: any) => ({
                              ...prev,
                              _details: (prev._details || []).filter((_d: any, _i: number) => {
                                const _pk = pkField.db_column_name.split('.').pop() || 'id';
                                const _dPk = _d[_pk] || _d[_pk.toUpperCase()] || _d.id || _d.ID || `idx-${_i}`;
                                return String(_dPk) !== String(detailIdValue);
                              })
                            }));
                          } else {
                            // Registro persistido: chama o fluxo normal de exclusão
                            onDeleteDetail?.(detail);
                          }
                        }}
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
                              <label 
                                style={{
                                  fontFamily: getFontFamily(field.config?.label?.font),
                                  fontSize: getFontSize(field.config?.label?.size),
                                  color: field.config?.label?.color,
                                  fontWeight: field.config?.label?.bold ? 'bold' : undefined,
                                  fontStyle: field.config?.label?.italic ? 'italic' : undefined,
                                  textTransform: field.config?.label?.uppercase ? 'uppercase' : undefined,
                                }}
                                className="text-[10px] font-black tracking-widest text-neutral-400"
                              >
                                {field.display_name}
                              </label>
                              {(() => {
                                const baseCol = field.db_column_name.split('.').pop() || field.db_column_name;
                                const rawValue = detail[baseCol] || detail[baseCol.toUpperCase()] || detail[field.db_column_name] || '';

                                const fieldConfig = field.config?.form_config || field.config || {};
                                const type = fieldConfig.component?.type || 'text';
                                const maskStr = fieldConfig.content?.mask;
                                const isDateType = type === 'date' || type === 'datetime-local' || type === 'datetime' || type === 'time';
                                const isInlineDisabled = mode === 'view' || field.is_primary_key || fieldConfig.content?.readonly === true;

                                const handleInlineChange = (rawVal: any) => {
                                  let newVal = rawVal;
                                  if (maskStr && typeof rawVal === 'string' && !isDateType) {
                                    if (maskStr === '0.000' || maskStr === '0.000,00') {
                                      newVal = parseMaskedNumber(rawVal, maskStr);
                                    } else {
                                      newVal = applyMask(rawVal, maskStr);
                                    }
                                  }

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


                                if (type === 'textarea') {
                                  return (
                                    <textarea
                                      value={rawValue || ''}
                                      onChange={(e) => handleInlineChange(e.target.value)}
                                      disabled={isInlineDisabled}
                                      className="w-full px-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                      rows={3}
                                    />
                                  );
                                }

                                if (['select', 'Combo (Select)'].includes(type)) {
                                  const options = relationalOptions[field.id] || parseFixedOptions(fieldConfig.component?.options);
                                  return (
                                    <select
                                      value={rawValue || ''}
                                      onChange={(e) => handleInlineChange(e.target.value)}
                                      disabled={isInlineDisabled}
                                      className="w-full px-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <option value="">Selecione...</option>
                                      {options.map((opt: any) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  );
                                }

                                if (['radio', 'Radio Buttons'].includes(type)) {
                                  const options = relationalOptions[field.id] || parseFixedOptions(fieldConfig.component?.options);
                                  return (
                                    <div className="flex flex-wrap gap-4 pt-1">
                                      {options.map((opt: any, i: number) => (
                                        <label key={i} className="flex items-center gap-2 cursor-pointer group/opt">
                                          <div
                                            onClick={() => !isInlineDisabled && handleInlineChange(opt.value)}
                                            className={cn(
                                              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                              String(rawValue) === String(opt.value) ? 'border-indigo-600 bg-indigo-600' : 'border-neutral-300 dark:border-neutral-700'
                                            )}
                                          >
                                            {String(rawValue) === String(opt.value) && <div className="w-2 h-2 bg-white rounded-full" />}
                                          </div>
                                          <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 group-hover/opt:text-indigo-600 transition-colors">{opt.label}</span>
                                        </label>
                                      ))}
                                    </div>
                                  );
                                }
                                
                                if (['checkbox', 'Checkbox Group'].includes(type)) {
                                  const options = relationalOptions[field.id] || parseFixedOptions(fieldConfig.component?.options);
                                  return (
                                    <div className="flex flex-wrap gap-4 pt-1">
                                      {options.map((opt: any, i: number) => {
                                        const checked = Array.isArray(rawValue) ? rawValue.includes(opt.value) : String(rawValue).split(',').includes(String(opt.value));
                                        return (
                                          <label key={i} className="flex items-center gap-2 cursor-pointer group/opt">
                                            <div
                                              onClick={() => {
                                                if (isInlineDisabled) return;
                                                let currentValues = Array.isArray(rawValue) ? [...rawValue] : (rawValue ? String(rawValue).split(',') : []);
                                                if (checked) {
                                                  currentValues = currentValues.filter((v: any) => String(v) !== String(opt.value));
                                                } else {
                                                  currentValues.push(opt.value);
                                                }
                                                handleInlineChange(currentValues.join(','));
                                              }}
                                              className={cn(
                                                "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                                checked ? 'border-indigo-600 bg-indigo-600' : 'border-neutral-300 dark:border-neutral-700'
                                              )}
                                            >
                                              {checked && <div className="w-2 h-2 bg-white" style={{ clipPath: 'polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%)' }} />}
                                            </div>
                                            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 group-hover/opt:text-indigo-600 transition-colors">{opt.label}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  );
                                }

                                let displayValue = rawValue;
                                if (maskStr && !isDateType) {
                                  displayValue = applyMask(rawValue, maskStr);
                                } else if (isDateType && rawValue && typeof rawValue === 'string') {
                                  const dateStr = rawValue.replace(' ', 'T');
                                  if (type === 'date') displayValue = dateStr.substring(0, 10);
                                  else if (type === 'datetime-local' || type === 'datetime') displayValue = dateStr.substring(0, 16);
                                }

                                return (
                                  <input
                                    type={
                                      type === 'date' ? 'date' :
                                        (type === 'datetime-local' || type === 'datetime') ? 'datetime-local' :
                                          type === 'time' ? 'time' :
                                            maskStr ? 'text' :
                                              type === 'number' ? 'number' : 'text'
                                    }
                                    value={displayValue}
                                    onChange={(e) => handleInlineChange(e.target.value)}
                                    disabled={isInlineDisabled}
                                    className="w-full px-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
                              {subTables.map(st => {
                                const stTargetModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === st?.toLowerCase());
                                const stModelId = stTargetModel?.id || fields.find(f => f.model_name?.toLowerCase() === st?.toLowerCase())?.model_id;
                                const stTitle = detailsTabTitles?.[stModelId || ''] || dictionary?.[stModelId || ''] || stTargetModel?.display_name || fields.find(f => f.model_name?.toLowerCase() === st?.toLowerCase())?.display_model_name || st;
                                
                                return (
                                  <div key={st} className="pl-4 border-l-2 border-indigo-100 dark:border-indigo-900/30">
                                    {renderDetailSection(st, detail, (
                                      <div className="flex items-center gap-2 mb-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
                                        <h3
                                          style={{
                                            fontFamily: getFontFamily(tabsStyleConfig?.label?.font),
                                            fontSize: getFontSize(tabsStyleConfig?.label?.size),
                                            ...(tabsStyleConfig?.label?.color ? { color: tabsStyleConfig.label.color } : {})
                                          }}
                                          className="text-[10px] font-black tracking-[0.2em] text-neutral-800 dark:text-neutral-200 uppercase"
                                        >
                                          {stTitle}
                                        </h3>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
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
                const targetModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === tableName?.toLowerCase());
                const modelId = targetModel?.id || fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.model_id
                return detailsTabTitles?.[modelId || ''] || dictionary[modelId || ''] || targetModel?.display_name || fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.display_model_name || tableName
              })()} encontrado.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col", isPageMode ? "bg-white dark:bg-neutral-900/50 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-xl" : "h-full")}>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
              {icons[mode]}
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                {formHeaderTitle && formHeaderTitle.trim() !== '' ? formHeaderTitle : titles[mode]}
              </h3>
              <p className="text-[10px] font-black tracking-[0.2em] text-neutral-400">
                {mode === 'create' ? t('runtime.record_drawer.new_item') : 
                  (formHeaderSubtitleField && initialData?.[formHeaderSubtitleField] 
                    ? String(initialData[formHeaderSubtitleField]) 
                    : t('runtime.record_drawer.record_id').replace('{id}', initialData?.id || 'N/A'))}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {customActions.filter(a => { const ctxs = a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : [a.context]; return ctxs.includes('master_top') || ctxs.includes('form_top') }).map(action => (
              <button
                key={action.id}
                onClick={() => onCustomAction?.(action, formData)}
                type="button"
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs capitalize tracking-wider transition-all shadow-lg",
                  getBulkActionClasses(action.color)
                )}
              >
                {getActionIcon(action.icon)}
                {action.label}
              </button>
            ))}

            {isPageMode && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-black tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> {t('runtime.back_to_list', 'Voltar para Lista')}
              </button>
            )}
          </div>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="flex-1 flex flex-col">
        {/* Formulário Principal e Abas Híbridas */}
        <div className={cn("flex flex-col h-full", !isPageMode && "overflow-hidden")}>
          {(() => {
            const getModelIdForTable = (tableName: string) => {
              const targetModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === tableName?.toLowerCase());
              return targetModel?.id || fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.model_id;
            };
            const tabTables = detailTables.filter(tableName => detailsDisplayMode?.[getModelIdForTable(tableName)] === 'tabs');
            const sectionTables = detailTables.filter(tableName => detailsDisplayMode?.[getModelIdForTable(tableName)] !== 'tabs');

            return (
              <>
                {!renderOnlyDetail && tabTables.length > 0 && (
                  <div className="flex items-end mb-2 border-b border-neutral-100 dark:border-neutral-800">
                    {/* Abas (scroll horizontal) */}
                    <div className="flex items-center gap-1 overflow-x-auto flex-1 custom-scrollbar">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setActiveTab('master')
                          onTabChange?.('master')
                        }}
                        style={{
                          fontFamily: getFontFamily(tabsStyleConfig?.label?.font),
                          fontSize: getFontSize(tabsStyleConfig?.label?.size),
                          ...(activeTab === 'master' && tabsStyleConfig?.label?.color ? { color: tabsStyleConfig.label.color, borderColor: tabsStyleConfig.label.color } : {})
                        }}
                        className={cn(
                          "px-4 py-2 text-[10px] font-black tracking-widest transition-all border-b-2 whitespace-nowrap",
                          !tabsStyleConfig?.label?.color && activeTab === 'master' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                        )}
                      >
                        {masterTabTitle || t('runtime.master_details.main_data', 'Dados Principais')}
                      </button>
                      {tabTables.map(tableName => {
                        const targetModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === tableName?.toLowerCase());
                        const modelId = targetModel?.id || getModelIdForTable(tableName);
                        const title = detailsTabTitles?.[modelId || ''] || dictionary[modelId || ''] || targetModel?.display_name || fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.display_model_name || tableName;
                        return (
                          <button
                            key={tableName}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setActiveTab(tableName)
                              onTabChange?.(tableName)
                            }}
                            style={{
                              fontFamily: getFontFamily(tabsStyleConfig?.label?.font),
                              fontSize: getFontSize(tabsStyleConfig?.label?.size),
                              ...(activeTab === tableName && tabsStyleConfig?.label?.color ? { color: tabsStyleConfig.label.color, borderColor: tabsStyleConfig.label.color } : {})
                            }}
                            className={cn(
                              "px-4 py-2 text-[10px] font-black tracking-widest transition-all border-b-2 whitespace-nowrap",
                              !tabsStyleConfig?.label?.color && activeTab === tableName ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                            )}
                          >
                            {title}
                          </button>
                        );
                      })}
                    </div>

                    {/* Botões de acao alinhados na mesma linha das abas */}
                    {activeTab !== 'master' && (() => {
                      const activeModelId = getModelIdForTable(activeTab);
                      return (
                        <div className="flex items-center gap-1 pb-2 flex-shrink-0 pl-2">
                          {(formData?._details || []).some((d: any) => d.model_name?.toLowerCase() === activeTab?.toLowerCase()) && (
                            <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                              <button
                                type="button"
                                onClick={async () => {
                                  const currentDetails = (formData?._details || []).filter((d: any) => d.model_name?.toLowerCase() === activeTab?.toLowerCase())
                                  const pkField = fields.filter(f => f.model_name?.toLowerCase() === activeTab?.toLowerCase()).find(f => f.is_primary_key) || { db_column_name: 'id' }
                                  const pkCol = pkField.db_column_name.split('.').pop() || 'id'
                                  const newState = { ...expandedDetails }
                                  currentDetails.forEach((d: any, idx: number) => {
                                    const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`
                                    newState[`detail-${activeTab}-${dPk}`] = true
                                  })
                                  setExpandedDetails(newState)
                                  const fetches = currentDetails.filter((d: any) => !d._details || d._details.length === 0).map((d: any, idx: number) => {
                                    const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`
                                    const key = `detail-${activeTab}-${dPk}`
                                    if (!loadingSubDetails[key]) {
                                      setLoadingSubDetails(prev => ({ ...prev, [key]: true }))
                                      return fetchSubDetailsForRecord(d, activeTab, pkCol, dPk).finally(() => setLoadingSubDetails(prev => ({ ...prev, [key]: false })))
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
                                  const currentDetails = (formData?._details || []).filter((d: any) => d.model_name?.toLowerCase() === activeTab?.toLowerCase())
                                  const pkField = fields.filter(f => f.model_name?.toLowerCase() === activeTab?.toLowerCase()).find(f => f.is_primary_key) || { db_column_name: 'id' }
                                  const pkCol = pkField.db_column_name.split('.').pop() || 'id'
                                  const newState = { ...expandedDetails }
                                  currentDetails.forEach((d: any, idx: number) => {
                                    const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`
                                    newState[`detail-${activeTab}-${dPk}`] = false
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
                          <button
                            type="button"
                            onClick={() => {
                              if (true) {
                                const newTempId = `temp-${Date.now()}`
                                setFormData((prev: any) => ({ ...prev, _details: [...(prev._details || []), { id: newTempId, model_name: activeTab, _isNew: true }] }))
                                setExpandedDetails((prev: any) => ({ ...prev, [`detail-${activeTab}-${newTempId}`]: true }))
                                
                                // Foco no primeiro campo do novo item
                                setTimeout(() => {
                                  const container = document.getElementById(`detail-container-detail-${activeTab}-${newTempId}`)
                                  if (container) {
                                    const firstInput = container.querySelector('input:not([type="hidden"]), select, textarea') as HTMLElement
                                    if (firstInput) firstInput.focus()
                                  }
                                }, 150)
                              }
                            }}
                            className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shadow-sm"
                            title={t('common.add_record', 'Adicionar')}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          {true && (
                            <button
                              type="button"
                              onClick={() => onAddDetail?.(activeTab, formData.id || formData.ID)}
                              title={detailsInterfaceTypes[activeModelId || ''] === 'drawer' ? t('common.open_drawer', 'Abrir Gaveta') : t('common.open_modal', 'Abrir Modal')}
                              className="p-1.5 bg-neutral-50 dark:bg-neutral-800 text-neutral-400 hover:text-indigo-600 rounded-lg transition-colors border border-transparent hover:border-indigo-200"
                            >
                              {detailsInterfaceTypes[activeModelId || ''] === 'drawer' ? <PanelRight className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className={cn("flex-1 space-y-12", isPageMode ? "" : "overflow-y-auto custom-scrollbar pr-2")}>
                  {!renderOnlyDetail && activeTab === 'master' && (
                    <div className="space-y-6">
                      {sectionTables.length > 0 && tabTables.length > 0 && (
                        <div className="flex items-center gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
                          <h3 className="text-[10px] font-black tracking-[0.2em] text-neutral-800 dark:text-neutral-200">
                            {masterTabTitle || t('runtime.master_details.main_data', 'Dados Principais')}
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

                  {!renderOnlyDetail && activeTab === 'master' && sectionTables.length > 0 && sectionTables.map(tableName => {
                    const targetModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === tableName?.toLowerCase());
                    const sectionModelId = targetModel?.id || getModelIdForTable(tableName);
                    const sectionTitle = detailsTabTitles?.[sectionModelId || ''] || dictionary[sectionModelId || ''] || targetModel?.display_name || fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.display_model_name || tableName;
                    return (
                      <div key={tableName} className="pt-6">
                        {renderDetailSection(tableName, formData, (
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
                            <h3
                              style={{
                                fontFamily: getFontFamily(tabsStyleConfig?.label?.font),
                                fontSize: getFontSize(tabsStyleConfig?.label?.size),
                                ...(tabsStyleConfig?.label?.color ? { color: tabsStyleConfig.label.color } : {})
                              }}
                              className="text-[10px] font-black tracking-[0.2em] text-neutral-800 dark:text-neutral-200"
                            >
                              {sectionTitle}
                            </h3>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {!renderOnlyDetail && tabTables.length > 0 && activeTab !== 'master' && (
                    renderDetailSection(activeTab, formData, undefined, true)
                  )}

                  {renderOnlyDetail && renderDetailSection(renderOnlyDetail)}
                </div>
              </>
            );
          })()}
        </div>

        <div className={cn(
          "pt-8 mt-auto border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-3 sticky bottom-0",
          footerBgClass
        )}>
          {!(logicType === 'cadastro' && isPageMode) && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-3 rounded-xl text-xs font-bold capitalize tracking-wider text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
            >
              {mode === 'view' ? t('runtime.close') : t('common.cancel')}
            </button>
          )}

          {mode !== 'view' && (
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black capitalize tracking-wider transition-all shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
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
