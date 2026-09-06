export function generateRelationSectionComponent(files: Map<string, string>) {
    files.set('components/DetailRelationSection.tsx', `'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Plus,
  Maximize2,
  Minimize2,
  X,
  Save,
  AlertTriangle,
  ExternalLink,
  Layers,
  CheckCircle,
  Loader2
} from 'lucide-react'

export interface DetailFieldConfig {
  id: string
  label: string
  dbColumn: string
  dataType?: string
  isPrimaryKey?: boolean
  config?: any
}

export interface SubRelationConfig {
  relatedTable: string
  relatedModelName: string
  foreignKey: string
  label: string
  fields: DetailFieldConfig[]
}

export interface DetailRelationSectionProps {
  label: string
  relatedTable: string
  foreignKey: string
  parentId: string
  items: any[]
  fields: DetailFieldConfig[]
  subDetails?: SubRelationConfig[]
  backPath?: string
  hideFooter?: boolean
  createAction: (formData: FormData | Record<string, any>) => Promise<any>
  updateAction: (id: string, formData: FormData | Record<string, any>) => Promise<any>
  deleteAction: (id: string) => Promise<any>
  createSubAction?: (formData: FormData | Record<string, any>) => Promise<any>
  updateSubAction?: (id: string, formData: FormData | Record<string, any>) => Promise<any>
  deleteSubAction?: (id: string) => Promise<any>
}

function parseAnyNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const s = String(val).trim()
  if (!s) return 0
  if (s.includes(',')) {
    return Number(s.replace(/\\./g, '').replace(',', '.')) || 0
  }
  return Number(s) || 0
}

function formatMaskRealtime(val: string, mask?: string): string {
  if (!val || !mask) return val || ''
  const numbers = String(val).replace(/\\D/g, '')
  if (!numbers) return ''

  if (mask === '0.000,00' || mask === 'currency' || mask === 'moeda') {
    const num = parseInt(numbers, 10) / 100
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (mask === '0.000') {
    const num = parseInt(numbers, 10)
    return num.toLocaleString('pt-BR')
  }

  if (mask === '000.000.000-00') {
    const d = numbers.slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return \`\${d.slice(0, 3)}.\${d.slice(3)}\`
    if (d.length <= 9) return \`\${d.slice(0, 3)}.\${d.slice(3, 6)}.\${d.slice(6)}\`
    return \`\${d.slice(0, 3)}.\${d.slice(3, 6)}.\${d.slice(6, 9)}-\${d.slice(9, 11)}\`
  }

  if (mask === '00.000.000/0000-00') {
    const d = numbers.slice(0, 14)
    if (d.length <= 2) return d
    if (d.length <= 5) return \`\${d.slice(0, 2)}.\${d.slice(2)}\`
    if (d.length <= 8) return \`\${d.slice(0, 2)}.\${d.slice(2, 5)}.\${d.slice(5)}\`
    if (d.length <= 12) return \`\${d.slice(0, 2)}.\${d.slice(2, 5)}.\${d.slice(5, 8)}/\${d.slice(8)}\`
    return \`\${d.slice(0, 2)}.\${d.slice(2, 5)}.\${d.slice(5, 8)}/\${d.slice(8, 12)}-\${d.slice(12, 14)}\`
  }

  if (mask === '00000-000') {
    const d = numbers.slice(0, 8)
    if (d.length <= 5) return d
    return \`\${d.slice(0, 5)}-\${d.slice(5, 8)}\`
  }

  if (mask === '(00) 00000-0000' || mask === '(00) 0000-0000') {
    const d = numbers.slice(0, 11)
    if (d.length <= 2) return \`(\${d}\`
    if (d.length <= 6) return \`(\${d.slice(0, 2)}) \${d.slice(2)}\`
    if (d.length <= 10) return \`(\${d.slice(0, 2)}) \${d.slice(2, 6)}-\${d.slice(6)}\`
    return \`(\${d.slice(0, 2)}) \${d.slice(2, 7)}-\${d.slice(7, 11)}\`
  }

  if (mask === '00/00/0000') {
    const d = numbers.slice(0, 8)
    if (d.length <= 2) return d
    if (d.length <= 4) return \`\${d.slice(0, 2)}/\${d.slice(2)}\`
    return \`\${d.slice(0, 2)}/\${d.slice(2, 4)}/\${d.slice(4, 8)}\`
  }

  return val
}

function applyFieldMask(val: any, mask?: string): string {
  if (val === null || val === undefined || val === '') return ''
  if (!mask) return String(val)

  if (mask === '0.000,00' || mask === 'currency' || mask === 'moeda') {
    const num = parseAnyNumber(val)
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (mask === '0.000') {
    const num = parseAnyNumber(val)
    return num.toLocaleString('pt-BR')
  }

  return formatMaskRealtime(String(val), mask)
}

const SubItemAccordion = React.forwardRef(({
  subItem,
  sIdx,
  subKey,
  isSubExpanded,
  subFields,
  toggleSubItem,
  formatDateForInput,
  onSubItemChange,
  onEditSubItem,
  onDeleteSubItem,
}: {
  subItem: any
  sIdx: number
  subKey: string
  isSubExpanded: boolean
  subFields: DetailFieldConfig[]
  toggleSubItem: (k: string) => void
  formatDateForInput: (v: any) => string
  onSubItemChange?: (field: string, val: any) => void
  onEditSubItem?: (item: any, sIdx: number) => void
  onDeleteSubItem?: (item: any, sIdx: number) => void
}, ref: any) => {
  const getSubVal = (col: string) => {
    if (!subItem) return ''
    if (subItem[col] !== undefined && subItem[col] !== null) return subItem[col]
    const colOnly = col.includes('.') ? col.split('.').pop()! : col
    if (subItem[colOnly] !== undefined && subItem[colOnly] !== null) return subItem[colOnly]
    const targetKeys = [col.toLowerCase(), colOnly.toLowerCase()]
    for (const k of Object.keys(subItem)) {
      if (targetKeys.includes(k.toLowerCase())) return subItem[k]
    }
    return ''
  }

  const rawQtd = getSubVal('quantidade') || getSubVal('qtd') || 1
  const rawPreco = getSubVal('preco_unitario') || getSubVal('valor_unitario') || getSubVal('preco') || 0
  const parsedPreco = parseAnyNumber(rawPreco)

  const [qtd, setQtd] = useState<number>(Number(rawQtd) || 1)
  const [preco, setPreco] = useState<number>(parsedPreco)

  useEffect(() => {
    setQtd(Number(rawQtd) || 1)
    setPreco(parsedPreco)
  }, [rawQtd, parsedPreco])

  const total = qtd * preco

  let subTitle = ''
  for (const sf of subFields) {
    const val = getSubVal(sf.dbColumn)
    if (sf.config?.options && sf.config.options.length > 0) {
      const opt = sf.config.options.find((o: any) => String(o.value) === String(val))
      if (opt?.label) {
        subTitle = opt.label
        break
      }
    }
  }
  if (!subTitle) {
    subTitle = String(subItem.produto_nome || subItem.produto || subItem.nome || subItem.descricao || subItem.name || \`Item #\${sIdx + 1}\`)
  }

  return (
    <div data-sub-item={subKey} className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 shadow-sm transition-all">
      {/* Barra do Cabeçalho do Sub-Item */}
      <div className="py-2.5 px-4 flex items-center justify-between bg-neutral-50/60 dark:bg-neutral-800/40">
        <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
          {subTitle}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => toggleSubItem(subKey)}
            className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors shadow-sm"
          >
            {isSubExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => onEditSubItem && onEditSubItem(subItem, sIdx)}
            className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            title="Editar Item"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteSubItem && onDeleteSubItem(subItem, sIdx)}
            className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            title="Excluir Item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Campos do Sub-Item Expandido */}
      {isSubExpanded && subFields.length > 0 && (
        <div className="p-5 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-12 gap-4 animate-in slide-in-from-top-2 duration-200 bg-white dark:bg-neutral-900">
          {subFields.map((sf: any) => {
            const val = getSubVal(sf.dbColumn)
            const dt = (sf.dataType || '').toLowerCase()
            const isDate = dt === 'date' || sf.dbColumn.includes('data') || sf.dbColumn.includes('date')
            const isNumber = dt.includes('int') || dt.includes('num') || dt.includes('float') || dt.includes('decimal') || dt.includes('double')
            const isSelect = sf.config?.options && sf.config.options.length > 0
            const isQtdField = sf.dbColumn.includes('quant') || sf.label.toLowerCase().includes('quant')
            const isPrecoField = sf.dbColumn.includes('preco') || sf.dbColumn.includes('valor') || sf.label.toLowerCase().includes('preço') || sf.label.toLowerCase().includes('preco')
            const isTotalField = sf.dbColumn.includes('total') || sf.label.toLowerCase().includes('total')

            const rawCols = sf.config?.gridSpan ?? sf.config?.modalGridSpan ?? sf.config?.columns ?? sf.config?.col_span ?? sf.config?.component?.gridSpan ?? sf.config?.component?.modalGridSpan ?? sf.config?.component?.columns ?? sf.config?.component?.col_span ?? sf.config?.colSpan
            const numCols = typeof rawCols === 'number' ? rawCols : (typeof rawCols === 'string' && rawCols.match(/\d+/) ? parseInt(rawCols.match(/\d+/)![0], 10) : null)
            const widthVal = sf.config?.width || sf.config?.component?.width || ''
            
            let colSpanClass = 'col-span-12 sm:col-span-6 lg:col-span-3'
            if (numCols) {
              if (numCols >= 12) colSpanClass = 'col-span-12'
              else if (numCols === 9) colSpanClass = 'col-span-12 md:col-span-9'
              else if (numCols === 8) colSpanClass = 'col-span-12 md:col-span-8'
              else if (numCols === 7) colSpanClass = 'col-span-12 md:col-span-7'
              else if (numCols === 6) colSpanClass = 'col-span-12 md:col-span-6'
              else if (numCols === 5) colSpanClass = 'col-span-12 md:col-span-5'
              else if (numCols === 4) colSpanClass = 'col-span-12 md:col-span-4'
              else if (numCols === 3) colSpanClass = 'col-span-12 md:col-span-3'
              else if (numCols === 2) colSpanClass = 'col-span-12 md:col-span-2'
              else if (numCols === 1) colSpanClass = 'col-span-12 md:col-span-1'
            } else if (widthVal === '75%') {
              colSpanClass = 'col-span-12 md:col-span-9'
            } else if (widthVal.includes('66')) {
              colSpanClass = 'col-span-12 md:col-span-8'
            } else if (widthVal === '50%' || widthVal === 'w-1/2' || sf.dbColumn.includes('produto')) {
              colSpanClass = 'col-span-12 md:col-span-6'
            } else if (widthVal === '33%' || widthVal === '33.33%') {
              colSpanClass = 'col-span-12 md:col-span-4'
            } else if (widthVal === '25%' || widthVal === 'w-1/4') {
              colSpanClass = 'col-span-12 md:col-span-3'
            } else if (widthVal.includes('16') || isQtdField || isPrecoField || isTotalField) {
              colSpanClass = 'col-span-12 md:col-span-2'
            }

            if (isSelect) {
              return (
                <div key={sf.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                    {sf.label}
                  </label>
                  <select
                    key={sf.dbColumn}
                    name={sf.dbColumn}
                    defaultValue={String(val ?? '')}
                    onChange={(e) => onSubItemChange?.(sf.dbColumn, e.target.value)}
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    {sf.config.options.map((opt: any, oIdx: number) => {
                      const optVal = typeof opt === 'object' ? (opt.value ?? opt.id) : opt
                      const optLabel = typeof opt === 'object' ? (opt.label || opt.value) : opt
                      return <option key={oIdx} value={String(optVal)}>{String(optLabel)}</option>
                    })}
                  </select>
                </div>
              )
            }

            if (isTotalField) {
              return (
                <div key={sf.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                    {sf.label}
                  </label>
                  <input
                    name={sf.dbColumn}
                    type="text"
                    readOnly
                    value={total > 0 ? total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (val ? parseAnyNumber(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00')}
                    className="w-full bg-neutral-100/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 font-semibold rounded-xl px-4 py-2.5 text-sm outline-none cursor-not-allowed"
                  />
                </div>
              )
            }

            const mask = sf.config?.content?.mask || sf.config?.mask || (isPrecoField ? '0.000,00' : '')
            let initialFormatted = isDate ? formatDateForInput(val) : String(val ?? '')
            if (mask) {
              initialFormatted = applyFieldMask(val, mask)
            } else if (isPrecoField && val !== undefined && val !== null && val !== '') {
              initialFormatted = applyFieldMask(val, '0.000,00')
            }

            return (
              <div key={sf.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                  {sf.label}
                </label>
                <input
                  key={sf.dbColumn}
                  name={sf.dbColumn}
                  data-mask={mask}
                  type={isDate ? 'date' : (isNumber && !mask && !isPrecoField) ? 'number' : 'text'}
                  defaultValue={initialFormatted}
                  onChange={(e) => {
                    if (mask) {
                      e.target.value = formatMaskRealtime(e.target.value, mask)
                    }
                    let newVal: any = e.target.value
                    if (isQtdField) {
                      const q = Number(e.target.value) || 0
                      setQtd(q)
                      newVal = q
                    }
                    if (isPrecoField) {
                      const p = parseAnyNumber(e.target.value)
                      setPreco(p)
                      newVal = p
                    }
                    onSubItemChange?.(sf.dbColumn, newVal)
                  }}
                  placeholder={sf.config?.placeholder || \`Digite o valor para \${sf.label}...\`}
                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

export function DetailRelationSection({
  label,
  relatedTable,
  foreignKey,
  parentId,
  items = [],
  fields = [],
  subDetails = [],
  backPath,
  hideFooter = false,
  createAction,
  updateAction,
  deleteAction,
  createSubAction,
  updateSubAction,
  deleteSubAction,
}: DetailRelationSectionProps) {
  const subConfig = (subDetails && subDetails[0]) || null
  const subTable = subConfig?.relatedTable || ''

  const getSubRecords = (item: any): any[] => {
    if (!item) return []
    if (Array.isArray(item.items)) return item.items
    if (subTable && Array.isArray(item[subTable])) return item[subTable]
    if (Array.isArray(item._details)) return item._details
    for (const key of Object.keys(item)) {
      if (Array.isArray(item[key]) && key !== 'items') return item[key]
    }
    return []
  }

  const [localItems, setLocalItems] = useState<any[]>(items)
  const [mounted, setMounted] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalActiveTab, setModalActiveTab] = useState<'master' | 'items'>('master')
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [deletingItem, setDeletingItem] = useState<any | null>(null)
  const [editingSubItem, setEditingSubItem] = useState<{ subItem: any; sIdx: number; parentId: string; subFields: DetailFieldConfig[] } | null>(null)
  const [deletingSubItem, setDeletingSubItem] = useState<{ subItem: any; sIdx: number; parentId: string } | null>(null)
  const [subModalQtd, setSubModalQtd] = useState<number>(1)
  const [subModalPreco, setSubModalPreco] = useState<number>(0)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedSubItems, setExpandedSubItems] = useState<Record<string, boolean>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (editingSubItem) {
      const it = editingSubItem.subItem
      const q = it.quantidade || it.qtd || 1
      const p = it.preco_unitario || it.valor_unitario || it.preco || 0
      const numP = typeof p === 'number' ? p : (Number(String(p).replace(/\\./g, '').replace(',', '.')) || 0)
      setSubModalQtd(Number(q) || 1)
      setSubModalPreco(numP)
    }
  }, [editingSubItem])

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  const toggleSubItem = (key: string) => {
    setExpandedSubItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSubItemFieldChange = (parentIdx: number, subIdx: number, field: string, val: any) => {
    setLocalItems(prev => {
      const next = [...prev]
      const parent = { ...next[parentIdx] }
      const children = [...getSubRecords(parent)]
      if (children[subIdx]) {
        children[subIdx] = { ...children[subIdx], [field]: val }
        parent.items = children
        if (subTable) { parent[subTable] = children }
        next[parentIdx] = parent
      }
      return next
    })
  }

  const handleModalSubItemFieldChange = (subIdx: number, field: string, val: any) => {
    setEditingItem((prev: any) => {
      if (!prev) return prev
      const children = [...getSubRecords(prev)]
      if (children[subIdx]) {
        children[subIdx] = { ...children[subIdx], [field]: val }
      }
      return {
        ...prev,
        items: children,
        ...(subTable ? { [subTable]: children } : {})
      }
    })
  }

  useEffect(() => {
    setLocalItems(items)
  }, [items])

  const allExpanded = localItems.length > 0 && localItems.every((_, idx) => expandedRows[idx])

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedRows({})
    } else {
      const next: Record<string, boolean> = {}
      localItems.forEach((_, idx) => { next[idx] = true })
      setExpandedRows(next)
    }
  }

  const toggleRow = (idx: number) => {
    setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const handleAddInline = () => {
    const tempItem: any = {
      _isNew: true,
      id: \`temp-\${Date.now()}\`,
    }
    editableFields.forEach(f => {
      tempItem[f.dbColumn] = ''
    })
    setLocalItems([tempItem, ...localItems])
    setExpandedRows(prev => ({ ...prev, 0: true }))
  }

  const handleOpenAddModal = () => {
    setEditingItem(null)
    setModalActiveTab('master')
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (item: any) => {
    setEditingItem(item)
    setModalActiveTab('master')
    setIsModalOpen(true)
  }

  useEffect(() => {
    const handleExternalRelationSave = (e: any) => {
       if (!isSubmitting) {
         const p = handleSaveAll(true)
         if (e && e.detail && Array.isArray(e.detail.promises)) {
           e.detail.promises.push(p)
         }
       }
    }
    window.addEventListener('save-all-relations', handleExternalRelationSave)
    return () => window.removeEventListener('save-all-relations', handleExternalRelationSave)
  }, [isSubmitting, localItems])

  const handleSaveAll = async (silent = false) => {
    setIsSubmitting(true)
    if (silent !== true) window.dispatchEvent(new CustomEvent('page-progress-start'))
    try {
      const sectionEl = document.querySelector('.relation-section-container')

      for (let idx = 0; idx < localItems.length; idx++) {
        const item = localItems[idx]
        const rowKey = String(item.id || item.codigo || \`idx-\${idx}\`)
        const rowContainer = sectionEl?.querySelector(\`[data-relation-row="\${rowKey}"]\`) || document.querySelector(\`[data-relation-row="\${rowKey}"]\`)

        const rowData: Record<string, any> = { [foreignKey]: parentId }
        if (rowContainer) {
          const parentInputs = rowContainer.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.relation-parent-fields input, .relation-parent-fields select')
          parentInputs.forEach(inp => {
            if (inp.name && !inp.name.startsWith('$') && !inp.name.startsWith('_')) {
              const m = inp.getAttribute('data-mask')
              if (m === '0.000,00' || m === 'currency' || m === 'moeda' || inp.name.includes('preco') || inp.name.includes('valor')) {
                rowData[inp.name] = parseAnyNumber(inp.value)
              } else if (m === '0.000') {
                rowData[inp.name] = parseInt(inp.value.replace(/\D/g, ''), 10) || 0
              } else {
                rowData[inp.name] = inp.value
              }
            }
          })
        } else {
          editableFields.forEach(f => {
            if (item[f.dbColumn] !== undefined) rowData[f.dbColumn] = item[f.dbColumn]
          })
        }

        let savedParentId = item.id || item.codigo
        const isNewParent = !savedParentId || String(savedParentId).startsWith('temp-')
        if (isNewParent) {
          const created = await createAction(rowData)
          if (created?.id || created?.codigo) {
            savedParentId = created.id || created.codigo
          }
        } else if (Object.keys(rowData).length > 1) {
          await updateAction(savedParentId, rowData)
        }

        if (subConfig && (updateSubAction || createSubAction)) {
          const itemChildRecords: any[] = getSubRecords(item)
          for (let sIdx = 0; sIdx < itemChildRecords.length; sIdx++) {
            const subItem = itemChildRecords[sIdx]
            const subKey = \`\${item.id || item.codigo || idx}-\${sIdx}\`
            const subContainer = rowContainer?.querySelector(\`[data-sub-item="\${subKey}"]\`)

            const subData: Record<string, any> = {}
            if (subConfig.foreignKey) {
              subData[subConfig.foreignKey] = savedParentId
            }

            if (subContainer) {
              const subInputs = subContainer.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')
              subInputs.forEach(inp => {
                if (inp.name && !inp.name.startsWith('$') && !inp.name.startsWith('_')) {
                  const m = inp.getAttribute('data-mask')
                  if (m === '0.000,00' || m === 'currency' || m === 'moeda' || inp.name.includes('preco') || inp.name.includes('valor')) {
                    subData[inp.name] = parseAnyNumber(inp.value)
                  } else if (m === '0.000') {
                    subData[inp.name] = parseInt(inp.value.replace(/\D/g, ''), 10) || 0
                  } else {
                    subData[inp.name] = inp.value
                  }
                }
              })
            } else {
              subFields.forEach((sf: any) => {
                if (subItem[sf.dbColumn] !== undefined) subData[sf.dbColumn] = subItem[sf.dbColumn]
              })
            }

            const isNewSub = !subItem.id || String(subItem.id).startsWith('temp-')
            if (isNewSub && createSubAction) {
              await createSubAction(subData)
            } else if (!isNewSub && updateSubAction && subItem.id) {
              await updateSubAction(subItem.id, subData)
            }
          }
        }
      }

      if (silent !== true) {
        setToastType('success')
        setToastMessage('Alterações salvas com sucesso!')
        window.dispatchEvent(new CustomEvent('save-master-form'))
      }
    } catch (err: any) {
      console.error('Erro ao salvar alterações:', err)
      if (silent !== true) {
        setToastType('error')
        setToastMessage(err?.message || 'Erro ao salvar alterações.')
      }
    } finally {
      setIsSubmitting(false)
      if (silent !== true) window.dispatchEvent(new CustomEvent('page-progress-complete'))
    }
  }

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    window.dispatchEvent(new CustomEvent('page-progress-start'))
    try {
      const modalEl = document.getElementById('modal-master-form')
      const formData = new FormData(e.currentTarget)
      if (!formData.get(foreignKey)) {
        formData.set(foreignKey, parentId)
      }

      const masterData: Record<string, any> = { [foreignKey]: parentId }
      editableFields.forEach(f => {
        const inp = modalEl?.querySelector<HTMLInputElement | HTMLSelectElement>(\`[name="\${f.dbColumn}"]\`)
        if (inp) {
          const m = inp.getAttribute('data-mask')
          if (m === '0.000,00' || m === 'currency' || m === 'moeda' || f.dbColumn.includes('preco') || f.dbColumn.includes('valor')) {
            masterData[f.dbColumn] = parseAnyNumber(inp.value)
          } else if (m === '0.000') {
            masterData[f.dbColumn] = parseInt(inp.value.replace(/\\D/g, ''), 10) || 0
          } else {
            masterData[f.dbColumn] = inp.value
          }
        } else if (formData.has(f.dbColumn)) {
          masterData[f.dbColumn] = formData.get(f.dbColumn)
        }
      })

      let savedParentId = editingItem?.id || editingItem?.codigo
      const isNewParent = !savedParentId || String(savedParentId).startsWith('temp-')

      if (isNewParent) {
        const created = await createAction(masterData)
        savedParentId = created?.id || created?.codigo || \`item-\${Date.now()}\`
      } else {
        await updateAction(savedParentId, masterData)
      }

      const currentChildRecords = getSubRecords(editingItem)
      const updatedChildRecords = [...currentChildRecords]

      if (subConfig && (updateSubAction || createSubAction)) {
        for (let sIdx = 0; sIdx < currentChildRecords.length; sIdx++) {
          const subItem = currentChildRecords[sIdx]
          const subKey = \`modal-\${editingItem?.id || 'edit'}-\${sIdx}\`
          const subContainer = modalEl?.querySelector(\`[data-sub-item="\${subKey}"]\`)

          const subData: Record<string, any> = {}
          if (subConfig.foreignKey) {
            subData[subConfig.foreignKey] = savedParentId
          }

          if (subContainer) {
            const subInputs = subContainer.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')
            subInputs.forEach(inp => {
              if (inp.name && !inp.name.startsWith('$') && !inp.name.startsWith('_')) {
                const m = inp.getAttribute('data-mask')
                if (m === '0.000,00' || m === 'currency' || m === 'moeda' || inp.name.includes('preco') || inp.name.includes('valor')) {
                  subData[inp.name] = parseAnyNumber(inp.value)
                } else if (m === '0.000') {
                  subData[inp.name] = parseInt(inp.value.replace(/\\D/g, ''), 10) || 0
                } else {
                  subData[inp.name] = inp.value
                }
              }
            })
          } else {
            subFields.forEach((sf: any) => {
              if (subItem[sf.dbColumn] !== undefined) subData[sf.dbColumn] = subItem[sf.dbColumn]
            })
          }

          const isNewSub = !subItem.id || String(subItem.id).startsWith('temp-')
          if (isNewSub && createSubAction) {
            const createdSub = await createSubAction(subData)
            if (createdSub?.id) {
              updatedChildRecords[sIdx] = { ...subItem, ...subData, id: createdSub.id }
            } else {
              updatedChildRecords[sIdx] = { ...subItem, ...subData }
            }
          } else if (!isNewSub && updateSubAction && subItem.id) {
            await updateSubAction(subItem.id, subData)
            updatedChildRecords[sIdx] = { ...subItem, ...subData }
          }
        }
      }

      if (isNewParent) {
        setLocalItems(prev => [{
          ...masterData,
          id: savedParentId,
          items: updatedChildRecords,
          ...(subTable ? { [subTable]: updatedChildRecords } : {}),
          __v: 1
        }, ...prev])
      } else {
        setLocalItems(prev => prev.map(it => {
          const isMatch = (it.id && it.id === savedParentId) || (it.codigo && it.codigo === savedParentId)
          if (isMatch) {
            return {
              ...it,
              ...masterData,
              items: updatedChildRecords,
              ...(subTable ? { [subTable]: updatedChildRecords } : {}),
              __v: (it.__v || 0) + 1
            }
          }
          return it
        }))
      }

      setToastType('success')
      setToastMessage(\`\${detailSingular} salvo com sucesso!\`)
      setIsModalOpen(false)
      setEditingItem(null)
    } catch (err: any) {
      console.error('Erro ao salvar:', err)
      setToastType('error')
      setToastMessage(err?.message || \`Erro ao salvar \${detailSingular.toLowerCase()}.\`)
    } finally {
      setIsSubmitting(false)
      window.dispatchEvent(new CustomEvent('page-progress-complete'))
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingItem) return
    setIsSubmitting(true)
    window.dispatchEvent(new CustomEvent('page-progress-start'))
    try {
      if (String(deletingItem.id).startsWith('temp-')) {
        setLocalItems(localItems.filter(i => i.id !== deletingItem.id))
      } else {
        await deleteAction(deletingItem.id || deletingItem.codigo)
        setLocalItems(localItems.filter(i => (i.id || i.codigo) !== (deletingItem.id || deletingItem.codigo)))
      }
      setToastType('success')
      setToastMessage(\`\${detailSingular} excluído com sucesso!\`)
      setDeletingItem(null)
    } catch (err: any) {
      console.error('Erro ao excluir:', err)
      setToastType('error')
      setToastMessage(err?.message || \`Erro ao excluir \${detailSingular.toLowerCase()}.\`)
    } finally {
      setIsSubmitting(false)
      window.dispatchEvent(new CustomEvent('page-progress-complete'))
    }
  }

  const handleSubItemFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingSubItem) return
    setIsSubmitting(true)
    window.dispatchEvent(new CustomEvent('page-progress-start'))
    try {
      const formData = new FormData(e.currentTarget)
      const updatedSub: Record<string, any> = { ...editingSubItem.subItem }
      formData.forEach((v, k) => {
        const matchedField = editingSubItem.subFields.find((f: any) => f.dbColumn === k)
        const m = matchedField?.config?.content?.mask || matchedField?.config?.mask || ''
        if (m === '0.000,00' || m === 'currency' || m === 'moeda' || k.includes('preco') || k.includes('valor')) {
          const parsed = parseAnyNumber(v)
          updatedSub[k] = parsed
          formData.set(k, String(parsed))
        } else if (m === '0.000') {
          const parsed = parseInt(String(v).replace(/\\D/g, ''), 10) || 0
          updatedSub[k] = parsed
          formData.set(k, String(parsed))
        } else {
          updatedSub[k] = v
        }
        if (matchedField?.config?.options) {
          const selectedOpt = matchedField.config.options.find((o: any) => String(o.value ?? o.id) === String(v))
          if (selectedOpt?.label) {
            updatedSub[\`\${k}_nome\`] = selectedOpt.label
            updatedSub[\`\${k}_label\`] = selectedOpt.label
            const displayCol = matchedField.config?.component?.rel_label || matchedField.config?.displayColumn
            if (displayCol) {
              updatedSub[displayCol] = selectedOpt.label
            }
          }
        }
      })
      if (subConfig?.foreignKey) {
        if (!updatedSub[subConfig.foreignKey]) {
          updatedSub[subConfig.foreignKey] = editingSubItem.parentId
        }
        if (!formData.get(subConfig.foreignKey)) {
          formData.set(subConfig.foreignKey, String(editingSubItem.parentId))
        }
      }

      if (updateSubAction && updatedSub.id && !String(updatedSub.id).startsWith('temp-')) {
        await updateSubAction(updatedSub.id, formData)
      } else if (createSubAction && (!updatedSub.id || String(updatedSub.id).startsWith('temp-'))) {
        const created = await createSubAction(formData)
        if (created?.id) updatedSub.id = created.id
      }

      setLocalItems(prev => prev.map((it, itIdx) => {
        const itId = it.id || it.codigo
        const isParent = itId === editingSubItem.parentId || String(itIdx) === String(editingSubItem.parentId) || String(it.id) === String(editingSubItem.parentId)
        if (isParent) {
          const children = getSubRecords(it)
          const nextChildren = children.map((sub: any, idx: number) => idx === editingSubItem.sIdx ? updatedSub : sub)
          return {
            ...it,
            items: nextChildren,
            ...(subTable ? { [subTable]: nextChildren } : {}),
            __v: (it.__v || 0) + 1
          }
        }
        return it
      }))

      if (editingItem) {
        const itId = editingItem.id || editingItem.codigo
        const isParent = itId === editingSubItem.parentId || String(editingSubItem.parentId) === 'edit' || (editingSubItem.subItem && itId === editingSubItem.subItem[subConfig?.foreignKey || ''])
        if (isParent) {
          const children = getSubRecords(editingItem)
          const nextChildren = children.map((sub: any, idx: number) => idx === editingSubItem.sIdx ? updatedSub : sub)
          setEditingItem({
            ...editingItem,
            items: nextChildren,
            ...(subTable ? { [subTable]: nextChildren } : {})
          })
        }
      }
      setToastType('success')
      setToastMessage('Item salvo com sucesso!')
      setEditingSubItem(null)
    } catch (err: any) {
      console.error(err)
      setToastType('error')
      setToastMessage(err?.message || 'Erro ao salvar item.')
    } finally {
      setIsSubmitting(false)
      window.dispatchEvent(new CustomEvent('page-progress-complete'))
    }
  }

  const handleConfirmDeleteSubItem = async () => {
    if (!deletingSubItem) return
    setIsSubmitting(true)
    window.dispatchEvent(new CustomEvent('page-progress-start'))
    try {
      if (deleteSubAction && deletingSubItem.subItem.id && !String(deletingSubItem.subItem.id).startsWith('temp-')) {
        await deleteSubAction(deletingSubItem.subItem.id)
      }

      setLocalItems(prev => prev.map((it, itIdx) => {
        const itId = it.id || it.codigo
        const isParent = itId === deletingSubItem.parentId || String(itIdx) === String(deletingSubItem.parentId) || String(it.id) === String(deletingSubItem.parentId)
        if (isParent) {
          const children = getSubRecords(it)
          const nextChildren = children.filter((_: any, idx: number) => idx !== deletingSubItem.sIdx)
          return {
            ...it,
            items: nextChildren,
            ...(subTable ? { [subTable]: nextChildren } : {}),
            __v: (it.__v || 0) + 1
          }
        }
        return it
      }))
      if (editingItem) {
        const itId = editingItem.id || editingItem.codigo
        const isParent = itId === deletingSubItem.parentId || String(deletingSubItem.parentId) === 'edit'
        if (isParent) {
          const children = getSubRecords(editingItem)
          const nextChildren = children.filter((_: any, idx: number) => idx !== deletingSubItem.sIdx)
          setEditingItem({
            ...editingItem,
            items: nextChildren,
            ...(subTable ? { [subTable]: nextChildren } : {})
          })
        }
      }
      setToastType('success')
      setToastMessage('Item excluído com sucesso!')
      setDeletingSubItem(null)
    } catch (err: any) {
      console.error(err)
      setToastType('error')
      setToastMessage(err?.message || 'Erro ao excluir item.')
    } finally {
      setIsSubmitting(false)
      window.dispatchEvent(new CustomEvent('page-progress-complete'))
    }
  }

  const formatDateForInput = (v: any) => {
    if (!v) return ''
    const s = String(v).trim()
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(s)) return s
    if (/^\\d{4}-\\d{2}-\\d{2}T/.test(s)) return s.slice(0, 10)
    if (s.includes('/')) {
      const parts = s.split('/')
      if (parts.length === 3) {
        return \`\${parts[2].slice(0, 4)}-\${parts[1].padStart(2, '0')}-\${parts[0].padStart(2, '0')}\`
      }
    }
    try {
      const d = new Date(v)
      if (!isNaN(d.getTime())) {
        const year = d.getUTCFullYear()
        const month = String(d.getUTCMonth() + 1).padStart(2, '0')
        const day = String(d.getUTCDate()).padStart(2, '0')
        return \`\${year}-\${month}-\${day}\`
      }
    } catch (e) {}
    return s.slice(0, 10)
  }

  const getFieldValue = (obj: any, dbCol: string) => {
    if (!obj) return ''
    if (obj[dbCol] !== undefined && obj[dbCol] !== null) return obj[dbCol]
    const under = dbCol.replace(/\\./g, '_')
    if (obj[under] !== undefined && obj[under] !== null) return obj[under]
    const colOnly = dbCol.includes('.') ? dbCol.split('.').pop()! : dbCol
    if (obj[colOnly] !== undefined && obj[colOnly] !== null) return obj[colOnly]
    const targetKeys = [dbCol.toLowerCase(), under.toLowerCase(), colOnly.toLowerCase()]
    for (const k of Object.keys(obj)) {
      const kLower = k.toLowerCase()
      if (targetKeys.includes(kLower)) {
        return obj[k]
      }
    }
    return ''
  }

  const editableFields = fields.filter(f => !f.isPrimaryKey && f.dbColumn !== foreignKey)
  const detailSingular = label.endsWith('s') ? label.slice(0, -1) : label
  const rawSubFields = subConfig?.fields || (subConfig as any)?.formFields || (subConfig as any)?.gridFields || []
  const subFields = rawSubFields.filter((f: any) => !f.isPrimaryKey && f.dbColumn !== subConfig?.foreignKey)
  const hasSubDetails = Boolean(subConfig && subFields.length > 0)

  return (
    <div className={\`relation-section-container relative z-10 transition-all \${isMaximized ? 'fixed inset-4 z-50 bg-white dark:bg-neutral-900 p-8 rounded-[2rem] shadow-2xl overflow-y-auto' : 'space-y-4'}\`}>
      {/* Barra Superior de Ações da Aba */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 capitalize">{label}</h3>
          <p className="text-xs text-neutral-400">Total de {localItems.length} {localItems.length === 1 ? 'registro' : 'registros'}</p>
        </div>

        {/* Toolbar no Topo à Direita: Expandir/Recolher, Adicionar, Abrir Modal */}
        <div className="flex items-center gap-2">
          {/* Pill de Expandir/Recolher Tudo */}
          <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                const next: Record<string, boolean> = {}
                localItems.forEach((_, idx) => { next[idx] = true })
                setExpandedRows(next)
              }}
              className="p-1 rounded-lg text-neutral-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-neutral-700 transition-all"
              title="Expandir Todos"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setExpandedRows({})}
              className="p-1 rounded-lg text-neutral-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-neutral-700 transition-all"
              title="Recolher Todos"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Adicionar Registro (+) */}
          <button
            type="button"
            onClick={handleAddInline}
            className="p-2 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all active:scale-95 shadow-sm flex items-center justify-center"
            title={\`Adicionar \${label}\`}
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Abrir Modal (ExternalLink) */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-xl transition-all active:scale-95 flex items-center justify-center"
            title="Abrir em Modal"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lista de Registros Filhos */}
      {localItems.length === 0 ? (
        <div className="bg-neutral-50/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 text-center">
          <p className="text-sm text-neutral-400 dark:text-neutral-500 py-4">
            Nenhum registro de <strong>{label}</strong> vinculado a este registro.
          </p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              type="button"
              onClick={handleAddInline}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar na Lista
            </button>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold rounded-xl text-xs hover:bg-neutral-50 transition-colors shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Abrir Modal
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {localItems.map((item, idx) => {
            const isExpanded = !!expandedRows[idx]
            const isNew = item._isNew || String(item.id || '').startsWith('temp-')
            const itemId = String(item.id || item.codigo || \`idx-\${idx}\`)
            const itemTitle = isNew
              ? 'Novo Registro'
              : String(item.nome || item.name || item.titulo || item.title || item.id || item.codigo || \`Registro #\${idx + 1}\`)
            const itemChildRecords: any[] = getSubRecords(item)

            return (
              <div key={\`\${itemId}-\${item.__v || 0}\`} data-relation-row={itemId} className="relation-row-container flex flex-col rounded-2xl transition-all duration-300">
                {/* Linha do Registro (Pill) */}
                <div className={\`py-2.5 px-4 rounded-xl border flex items-center justify-between transition-all \${
                  isExpanded
                    ? 'bg-white dark:bg-neutral-900 border-indigo-200 dark:border-indigo-800 shadow-md ring-1 ring-indigo-500/10'
                    : 'bg-white dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-sm'
                }\`}>
                  <div className="flex items-center gap-3">
                    <span className={\`text-xs font-mono transition-colors \${
                      isNew
                        ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                        : isExpanded
                          ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                          : 'text-neutral-700 dark:text-neutral-300 font-semibold'
                    }\`}>
                      {itemTitle}
                    </span>
                  </div>

                  {/* Ações da Linha: Expandir, Editar na Modal, Excluir */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleRow(idx)}
                      className={\`p-1.5 rounded-lg shadow-sm transition-all \${
                        isExpanded
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                      }\`}
                      title="Expandir / Recolher"
                    >
                      <ChevronDown className={\`w-3.5 h-3.5 transition-transform duration-300 \${isExpanded ? 'rotate-180' : ''}\`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 shadow-sm transition-all"
                      title="Editar na Modal (Mestre/Detalhe)"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingItem(item)}
                      className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 shadow-sm transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Efeito Cortina (Expansão In-place) */}
                {isExpanded && (
                  <div className="p-6 bg-slate-50/60 dark:bg-neutral-950/60 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 animate-in slide-in-from-top-2 duration-300 space-y-6 shadow-inner mt-1 mb-2">
                    <div className="relation-parent-fields grid grid-cols-12 gap-4">
                      {editableFields.map(f => {
                        const val = getFieldValue(item, f.dbColumn)
                        const isDate = f.dataType === 'date' || f.dataType === 'timestamp' || f.dataType === 'datetime' || f.dbColumn.includes('data')
                        const isNumber = f.dataType === 'integer' || f.dataType === 'numeric' || f.dataType === 'float' || f.dataType === 'decimal'
                        const hasOptions = f.config?.options && Array.isArray(f.config.options) && f.config.options.length > 0
                        const isCalculatedTotal = f.dbColumn.includes('total') || f.label.toLowerCase().includes('total')
                        const isReadOnly = Boolean(f.config?.readOnly || f.config?.content?.readonly || f.config?.readonly || isCalculatedTotal)

                        const widthVal = f.config?.width || f.config?.component?.width || ''
                        const rawCols = f.config?.gridSpan ?? f.config?.modalGridSpan ?? f.config?.component?.gridSpan ?? f.config?.component?.modalGridSpan ?? f.config?.columns ?? f.config?.col_span ?? f.config?.component?.columns ?? f.config?.component?.col_span ?? f.config?.colSpan
                        const numCols = typeof rawCols === 'number' ? rawCols : (typeof rawCols === 'string' && rawCols.match(/\d+/) ? parseInt(rawCols.match(/\d+/)![0], 10) : null)
                        let colSpanClass = 'col-span-12 md:col-span-6'
                        if (numCols) {
                          if (numCols >= 12) colSpanClass = 'col-span-12'
                          else if (numCols === 9) colSpanClass = 'col-span-12 md:col-span-9'
                          else if (numCols === 8) colSpanClass = 'col-span-12 md:col-span-8'
                          else if (numCols === 7) colSpanClass = 'col-span-12 md:col-span-7'
                          else if (numCols === 6) colSpanClass = 'col-span-12 md:col-span-6'
                          else if (numCols === 5) colSpanClass = 'col-span-12 md:col-span-5'
                          else if (numCols === 4) colSpanClass = 'col-span-12 md:col-span-4'
                          else if (numCols === 3) colSpanClass = 'col-span-12 md:col-span-3'
                          else if (numCols === 2) colSpanClass = 'col-span-12 md:col-span-2'
                          else if (numCols === 1) colSpanClass = 'col-span-12 md:col-span-1'
                        } else if (f.config?.multiline || f.config?.component?.type === 'textarea') {
                          colSpanClass = 'col-span-12'
                        } else if (widthVal === '75%') {
                          colSpanClass = 'col-span-12 md:col-span-9'
                        } else if (widthVal.includes('66')) {
                          colSpanClass = 'col-span-12 md:col-span-8'
                        } else if (widthVal === '50%' || widthVal === 'w-1/2') {
                          colSpanClass = 'col-span-12 md:col-span-6'
                        } else if (widthVal === '33%' || widthVal === '33.33%') {
                          colSpanClass = 'col-span-12 md:col-span-4'
                        } else if (widthVal === '25%' || widthVal === 'w-1/4') {
                          colSpanClass = 'col-span-12 md:col-span-3'
                        } else if (widthVal.includes('16')) {
                          colSpanClass = 'col-span-12 md:col-span-2'
                        }

                        const mask = isDate ? '' : (f.config?.content?.mask || f.config?.mask || ((f.dbColumn.includes('preco') || f.dbColumn.includes('valor')) ? '0.000,00' : ''))
                        let displayVal = isDate ? formatDateForInput(val) : String(val ?? '')
                        if (isCalculatedTotal && itemChildRecords && itemChildRecords.length > 0) {
                          const sum = itemChildRecords.reduce((acc: number, sub: any) => {
                            const q = Number(sub.quantidade || sub.qtd || 1)
                            const rawP = sub.preco_unitario || sub.valor_unitario || sub.preco || 0
                            const p = parseAnyNumber(rawP)
                            return acc + (q * p)
                          }, 0)
                          if (sum > 0) {
                            displayVal = sum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          } else if (val && !isNaN(Number(val))) {
                            displayVal = parseAnyNumber(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          }
                        } else if (mask) {
                          displayVal = applyFieldMask(val, mask)
                        } else if (isNumber && val && !isNaN(Number(val)) && (f.dbColumn.includes('preco') || f.dbColumn.includes('valor') || f.dbColumn.includes('total'))) {
                          displayVal = parseAnyNumber(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        }

                        if (hasOptions) {
                          const selectedOpt = f.config!.options!.find((o: any) => {
                            const oV = typeof o === 'object' ? String(o.value) : String(o)
                            const oL = typeof o === 'object' ? String(o.label) : String(o)
                            return oV === String(val) || oL === String(val)
                          })
                          const defVal = selectedOpt ? (typeof selectedOpt === 'object' ? String(selectedOpt.value) : String(selectedOpt)) : String(val || '')

                          return (
                            <div key={f.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                                {f.label}
                              </label>
                              <select
                                key={\`\${f.dbColumn}-\${defVal}\`}
                                name={f.dbColumn}
                                defaultValue={defVal}
                                disabled={isReadOnly}
                                className={\`w-full \${isReadOnly ? 'bg-neutral-100/80 dark:bg-neutral-800/80 cursor-not-allowed opacity-90' : 'bg-white dark:bg-neutral-900'} border border-neutral-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all\`}
                              >
                                <option value="">Selecione...</option>
                                {val && !f.config!.options!.some((o: any) => (o.value || o) === String(val) || (o.label || o) === String(val)) && (
                                  <option value={String(val)}>{String(val)}</option>
                                )}
                                {f.config!.options!.map((opt: any, oIdx: number) => {
                                  const optVal = typeof opt === 'object' ? opt.value : opt
                                  const optLabel = typeof opt === 'object' ? (opt.label || opt.value) : opt
                                  return <option key={oIdx} value={String(optVal)}>{String(optLabel)}</option>
                                })}
                              </select>
                            </div>
                          )
                        }

                        return (
                          <div key={f.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                              {f.label}
                            </label>
                            <input
                              key={f.dbColumn}
                              name={f.dbColumn}
                              data-mask={mask || undefined}
                              type={isDate ? 'date' : (isNumber && !mask && !isCalculatedTotal) ? 'number' : 'text'}
                              readOnly={isReadOnly}
                              placeholder={f.config?.placeholder || \`Digite o valor para \${f.label}...\`}
                              {...(isCalculatedTotal ? { value: displayVal } : { defaultValue: displayVal })}
                              onChange={(e) => {
                                if (!isDate && mask) {
                                  e.target.value = formatMaskRealtime(e.target.value, mask)
                                }
                              }}
                              className={\`w-full \${isReadOnly ? 'bg-neutral-100/80 dark:bg-neutral-800/80 font-semibold cursor-not-allowed text-neutral-800 dark:text-neutral-200 opacity-90' : 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-neutral-200'} border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all\`}
                            />
                          </div>
                        )
                      })}
                    </div>
                    {/* Sub-detalhes inline (ex: ITENS DO DETALHE) */}
                    {hasSubDetails && (
                      <div className="pt-4 border-t border-neutral-200/60 dark:border-neutral-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600" />
                            <span className="text-xs font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300">
                              {subConfig?.label ? subConfig.label.toUpperCase() : \`ITENS DE \${detailSingular.toUpperCase()}\`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {/* Pill de Expandir/Recolher Todos os Sub-itens */}
                            {itemChildRecords.length > 0 && (
                              <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = { ...expandedSubItems }
                                    itemChildRecords.forEach((_, sIdx) => { next[\`\${item.id || idx}-\${sIdx}\`] = true })
                                    setExpandedSubItems(next)
                                  }}
                                  className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded transition-colors"
                                  title="Expandir Todos"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = { ...expandedSubItems }
                                    itemChildRecords.forEach((_, sIdx) => { next[\`\${item.id || idx}-\${sIdx}\`] = false })
                                    setExpandedSubItems(next)
                                  }}
                                  className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded transition-colors"
                                  title="Recolher Todos"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const newSub: any = { id: \`temp-\${Date.now()}\` }
                                setEditingSubItem({ subItem: newSub, sIdx: itemChildRecords.length, parentId: item.id || idx, subFields })
                              }}
                              className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shadow-sm"
                              title="Adicionar"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-indigo-600 rounded-lg transition-colors"
                              title="Abrir Modal"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {isNew || itemChildRecords.length === 0 ? (
                          <div className="border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 text-center bg-neutral-50/20 dark:bg-neutral-900/10">
                            <p className="text-xs italic text-neutral-400 dark:text-neutral-500">
                              Nenhum registro de Itens encontrado.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {itemChildRecords.map((subItem: any, sIdx: number) => {
                              const subKey = \`\${item.id || idx}-\${sIdx}\`
                              const isSubExpanded = !!expandedSubItems[subKey]

                              return (
                                <SubItemAccordion
                                  key={sIdx}
                                  subItem={subItem}
                                  sIdx={sIdx}
                                  subKey={subKey}
                                  isSubExpanded={isSubExpanded}
                                  subFields={subFields}
                                  toggleSubItem={toggleSubItem}
                                  formatDateForInput={formatDateForInput}
                                  onSubItemChange={(field, val) => handleSubItemFieldChange(idx, sIdx, field, val)}
                                  onEditSubItem={(sub, sIndex) => setEditingSubItem({ subItem: sub, sIdx: sIndex, parentId: item.id || idx, subFields })}
                                  onDeleteSubItem={(sub, sIndex) => setDeletingSubItem({ subItem: sub, sIdx: sIndex, parentId: item.id || idx })}
                                />
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer Global Persistente com Botões Cancelar e Salvar Alterações */}
      {!hideFooter && (
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-800 mt-8">
          <Link
            href={backPath || '#'}
            className="px-6 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSaveAll}
            className="inline-flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs tracking-wide transition-colors shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      )}

      {/* Modal Mestre-Detalhe de Criação / Edição (com Abas) */}
      {mounted && isModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] p-8 sm:p-10 max-w-6xl w-full shadow-2xl relative space-y-6 animate-in zoom-in-95">
            {/* Header da Modal */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
                  {editingItem ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    {editingItem ? 'Editar Registro' : 'Novo Registro'}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {editingItem ? \`Registro \${editingItem.id || editingItem.codigo || ''}\` : 'Novo Item'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas da Modal: [Mestre] e [Itens do Mestre] */}
            {hasSubDetails && (
              <div className="flex items-center gap-6 border-b border-neutral-100 dark:border-neutral-800 pb-2">
                <button
                  type="button"
                  onClick={() => setModalActiveTab('master')}
                  className={\`text-xs font-bold pb-2 -mb-2.5 transition-all \${
                    modalActiveTab === 'master'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                  }\`}
                >
                  {label}
                </button>
                <button
                  type="button"
                  onClick={() => setModalActiveTab('items')}
                  className={\`text-xs font-bold pb-2 -mb-2.5 transition-all \${
                    modalActiveTab === 'items'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                  }\`}
                >
                  {subConfig?.label || \`Itens de \${detailSingular}\`}
                </button>
              </div>
            )}

            <form id="modal-master-form" onSubmit={handleFormSubmit} className="space-y-4">
              <input type="hidden" name={foreignKey} value={parentId} />

              {/* Conteúdo da Aba Mestre na Modal */}
              <div className={(!hasSubDetails || modalActiveTab === 'master') ? 'block' : 'hidden'}>
                <div className="grid grid-cols-12 gap-5 max-h-[55vh] overflow-y-auto px-1 py-1">
                  {editableFields.map(f => {
                    const val = getFieldValue(editingItem, f.dbColumn)
                    const isDate = f.dataType === 'date' || f.dataType === 'timestamp' || f.dataType === 'datetime' || f.dbColumn.includes('data')
                    const isNumber = f.dataType === 'integer' || f.dataType === 'numeric' || f.dataType === 'float' || f.dataType === 'decimal'
                    const hasOptions = f.config?.options && Array.isArray(f.config.options) && f.config.options.length > 0
                    const isCalculatedTotal = f.dbColumn.includes('total') || f.label.toLowerCase().includes('total')
                    const isReadOnly = Boolean(f.config?.readOnly || f.config?.content?.readonly || f.config?.readonly || isCalculatedTotal)

                    const comp = f.config?.component || {}
                    const formCfg = f.config?.form_config || {}
                    const formComp = formCfg.component || {}
                    const rawCols = f.config?.modalGridSpan ?? comp.modalGridSpan ?? formCfg.modalGridSpan ?? formComp.modalGridSpan ??
                                    f.config?.gridSpan ?? comp.gridSpan ?? formCfg.gridSpan ?? formComp.gridSpan ??
                                    f.config?.columns ?? comp.columns ?? f.config?.col_span ?? comp.col_span ?? f.config?.colSpan
                    const numCols = typeof rawCols === 'number' ? rawCols : (typeof rawCols === 'string' && rawCols.match(/\d+/) ? parseInt(rawCols.match(/\d+/)![0], 10) : null)
                    const rawWidth = String(f.config?.modalWidth || comp.modalWidth || formCfg.modalWidth || formComp.modalWidth ||
                                            f.config?.width || comp.width || formCfg.width || formComp.width || '')

                    let colSpanClass = 'col-span-12 md:col-span-6'
                    if (numCols) {
                      if (numCols >= 12) colSpanClass = 'col-span-12'
                      else if (numCols === 9) colSpanClass = 'col-span-12 md:col-span-9'
                      else if (numCols === 8) colSpanClass = 'col-span-12 md:col-span-8'
                      else if (numCols === 7) colSpanClass = 'col-span-12 md:col-span-7'
                      else if (numCols === 6) colSpanClass = 'col-span-12 md:col-span-6'
                      else if (numCols === 5) colSpanClass = 'col-span-12 md:col-span-5'
                      else if (numCols === 4) colSpanClass = 'col-span-12 md:col-span-4'
                      else if (numCols === 3) colSpanClass = 'col-span-12 md:col-span-3'
                      else if (numCols === 2) colSpanClass = 'col-span-12 md:col-span-2'
                      else if (numCols === 1) colSpanClass = 'col-span-12 md:col-span-1'
                    } else if (f.config?.multiline || comp.type === 'textarea') {
                      colSpanClass = 'col-span-12'
                    } else if (rawWidth.includes('75')) {
                      colSpanClass = 'col-span-12 md:col-span-9'
                    } else if (rawWidth.includes('66')) {
                      colSpanClass = 'col-span-12 md:col-span-8'
                    } else if (rawWidth.includes('50') || rawWidth === 'w-1/2') {
                      colSpanClass = 'col-span-12 md:col-span-6'
                    } else if (rawWidth.includes('33')) {
                      colSpanClass = 'col-span-12 md:col-span-4'
                    } else if (rawWidth.includes('25') || rawWidth === 'w-1/4' || (isDate && !numCols)) {
                      colSpanClass = 'col-span-12 md:col-span-3'
                    } else if (rawWidth.includes('16')) {
                      colSpanClass = 'col-span-12 md:col-span-2'
                    }

                    const mask = isDate ? '' : (f.config?.content?.mask || f.config?.mask || ((f.dbColumn.includes('preco') || f.dbColumn.includes('valor')) ? '0.000,00' : ''))
                    const editChildRecords = editingItem ? getSubRecords(editingItem) : []
                    let displayVal = isDate ? formatDateForInput(val) : String(val ?? '')
                    if (isCalculatedTotal && editChildRecords && editChildRecords.length > 0) {
                      const sum = editChildRecords.reduce((acc: number, sub: any) => {
                        const q = Number(sub.quantidade || sub.qtd || 1)
                        const rawP = sub.preco_unitario || sub.valor_unitario || sub.preco || 0
                        const p = parseAnyNumber(rawP)
                        return acc + (q * p)
                      }, 0)
                      if (sum > 0) {
                        displayVal = sum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      } else if (val && !isNaN(Number(val))) {
                        displayVal = parseAnyNumber(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      }
                    } else if (mask) {
                      displayVal = applyFieldMask(val, mask)
                    } else if (isNumber && val && !isNaN(Number(val)) && (f.dbColumn.includes('preco') || f.dbColumn.includes('valor') || f.dbColumn.includes('total'))) {
                      displayVal = parseAnyNumber(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    }

                    if (hasOptions) {
                      const selectedOpt = f.config!.options!.find((o: any) => {
                        const oV = typeof o === 'object' ? String(o.value) : String(o)
                        const oL = typeof o === 'object' ? String(o.label) : String(o)
                        return oV === String(val) || oL === String(val)
                      })
                      const defVal = selectedOpt ? (typeof selectedOpt === 'object' ? String(selectedOpt.value) : String(selectedOpt)) : String(val || '')

                      return (
                        <div key={f.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                            {f.label}
                          </label>
                          <select
                            key={\`\${f.dbColumn}-\${defVal}\`}
                            name={f.dbColumn}
                            defaultValue={defVal}
                            disabled={isReadOnly}
                            className={\`w-full \${isReadOnly ? 'bg-neutral-100/80 dark:bg-neutral-800/80 cursor-not-allowed opacity-90' : 'bg-slate-50 dark:bg-neutral-800'} border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all\`}
                          >
                            <option value="">Selecione...</option>
                            {val && !f.config!.options!.some((o: any) => (o.value || o) === String(val) || (o.label || o) === String(val)) && (
                              <option value={String(val)}>{String(val)}</option>
                            )}
                            {f.config!.options!.map((opt: any, oIdx: number) => {
                              const optVal = typeof opt === 'object' ? opt.value : opt
                              const optLabel = typeof opt === 'object' ? (opt.label || opt.value) : opt
                              return <option key={oIdx} value={String(optVal)}>{String(optLabel)}</option>
                            })}
                          </select>
                        </div>
                      )
                    }

                    return (
                      <div key={f.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                        <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                          {f.label}
                        </label>
                        <input
                          key={f.dbColumn}
                          name={f.dbColumn}
                          data-mask={mask || undefined}
                          type={isDate ? 'date' : (isNumber && !mask && !isCalculatedTotal) ? 'number' : 'text'}
                          readOnly={isReadOnly}
                          placeholder={f.config?.placeholder || \`Digite o valor para \${f.label}...\`}
                          {...(isCalculatedTotal ? { value: displayVal } : { defaultValue: displayVal })}
                          onChange={(e) => {
                            if (!isDate && mask) {
                              e.target.value = formatMaskRealtime(e.target.value, mask)
                            }
                          }}
                          className={\`w-full \${isReadOnly ? 'bg-neutral-100/80 dark:bg-neutral-800/80 font-semibold cursor-not-allowed text-neutral-800 dark:text-neutral-200 opacity-90' : 'bg-slate-50 dark:bg-neutral-800'} border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all\`}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Conteúdo da Aba Itens do Detalhe na Modal */}
              {hasSubDetails && (
                <div className={modalActiveTab === 'items' ? 'block space-y-4 max-h-[55vh] overflow-y-auto px-1' : 'hidden'}>
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
                    <span className="text-xs font-bold text-neutral-500">Lista de Itens</span>
                    <div className="flex items-center gap-1.5">
                      {editingItem && getSubRecords(editingItem).length > 0 && (
                        <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...expandedSubItems }
                              ;getSubRecords(editingItem).forEach((_: any, sIdx: number) => {
                                next[\`modal-\${editingItem.id || 'edit'}-\${sIdx}\`] = true
                              })
                              setExpandedSubItems(next)
                            }}
                            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded transition-colors"
                            title="Expandir Todos"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...expandedSubItems }
                              ;getSubRecords(editingItem).forEach((_: any, sIdx: number) => {
                                next[\`modal-\${editingItem.id || 'edit'}-\${sIdx}\`] = false
                              })
                              setExpandedSubItems(next)
                            }}
                            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded transition-colors"
                            title="Recolher Todos"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const newSub: any = { id: \`temp-\${Date.now()}\` }
                          const curItems = getSubRecords(editingItem)
                          setEditingSubItem({ subItem: newSub, sIdx: curItems.length, parentId: editingItem?.id || editingItem?.codigo || 'edit', subFields })
                        }}
                        className="p-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition-colors"
                        title="Adicionar Item"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {!editingItem || getSubRecords(editingItem).length === 0 ? (
                    <div className="border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl p-10 text-center bg-neutral-50/20 dark:bg-neutral-900/10">
                      <p className="text-xs italic text-neutral-400 dark:text-neutral-500">
                        Nenhum registro de Itens encontrado.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getSubRecords(editingItem).map((sub: any, sIdx: number) => {
                        const subKey = \`modal-\${editingItem.id || 'edit'}-\${sIdx}\`
                        const isSubExpanded = !!expandedSubItems[subKey]

                        return (
                          <SubItemAccordion
                            key={sIdx}
                            subItem={sub}
                            sIdx={sIdx}
                            subKey={subKey}
                            isSubExpanded={isSubExpanded}
                            subFields={subFields}
                            toggleSubItem={toggleSubItem}
                            formatDateForInput={formatDateForInput}
                            onSubItemChange={(field, val) => handleModalSubItemFieldChange(sIdx, field, val)}
                            onEditSubItem={(sub, sIndex) => setEditingSubItem({ subItem: sub, sIdx: sIndex, parentId: editingItem.id || editingItem.codigo || 'edit', subFields })}
                            onDeleteSubItem={(sub, sIndex) => setDeletingSubItem({ subItem: sub, sIdx: sIndex, parentId: editingItem.id || editingItem.codigo || 'edit' })}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Footer Único da Modal */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs tracking-wide transition-colors shadow-lg shadow-indigo-500/20"
                >
                  <Save className="w-4 h-4" /> {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Confirmação de Exclusão do Item Principal fiel à Web Produção (Imagem 3) */}
      {mounted && deletingItem && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Excluir Registro
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Esta ação não pode ser desfeita e removerá permanentemente os dados do banco.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400">
              <div className="p-2 bg-red-500/20 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold">Você tem certeza?</p>
                <p className="text-xs opacity-80 mt-0.5">
                  Você está prestes a excluir "\${String(deletingItem.id || deletingItem.codigo || deletingItem.nome || deletingItem.produto || 'este registro')}".
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-6 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
              >
                CANCELAR
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-colors shadow-lg shadow-red-500/20"
              >
                <Trash2 className="w-4 h-4" /> {isSubmitting ? 'Excluindo...' : 'CONFIRMAR EXCLUSÃO'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Edição de Sub-Item (Imagem 3 topo) */}
      {mounted && editingSubItem && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] p-8 sm:p-10 max-w-6xl w-full shadow-2xl relative space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    Editar Registro
                  </h3>
                  <p className="text-xs text-neutral-400 font-mono">
                    Registro #\${editingSubItem.subItem.id || editingSubItem.subItem.codigo || ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSubItem(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubItemFormSubmit} className="space-y-4">
              <div className="grid grid-cols-12 gap-4 max-h-[50vh] overflow-y-auto px-1 py-1">
                {editingSubItem.subFields.map(sf => {
                  const val = editingSubItem.subItem[sf.dbColumn] ?? editingSubItem.subItem[sf.dbColumn.split('.').pop()!]
                  const dt = (sf.dataType || '').toLowerCase()
                  const isDate = dt === 'date' || sf.dbColumn.includes('data') || sf.dbColumn.includes('date')
                  const isNumber = dt.includes('int') || dt.includes('num') || dt.includes('float') || dt.includes('decimal') || dt.includes('double')
                  const isSelect = sf.config?.options && sf.config.options.length > 0
                  const isQtd = sf.dbColumn.includes('quantidade') || sf.dbColumn.includes('qtd')
                  const isPreco = sf.dbColumn.includes('preco') || sf.dbColumn.includes('valor') || sf.dbColumn.includes('price')
                  const isTotalField = sf.dbColumn.includes('total') || sf.label.toLowerCase().includes('total')

                  const rawCols = sf.config?.modalGridSpan ?? sf.config?.gridSpan ?? sf.config?.columns ?? sf.config?.col_span ?? sf.config?.component?.modalGridSpan ?? sf.config?.component?.gridSpan ?? sf.config?.component?.columns ?? sf.config?.component?.col_span ?? sf.config?.colSpan
                  const numCols = typeof rawCols === 'number' ? rawCols : (typeof rawCols === 'string' && rawCols.match(/\d+/) ? parseInt(rawCols.match(/\d+/)![0], 10) : null)
                  const widthVal = sf.config?.width || sf.config?.component?.width || ''
                  
                  let colSpanClass = 'col-span-12 sm:col-span-6 lg:col-span-3'
                  if (numCols) {
                    if (numCols >= 12) colSpanClass = 'col-span-12'
                    else if (numCols === 9) colSpanClass = 'col-span-12 md:col-span-9'
                    else if (numCols === 8) colSpanClass = 'col-span-12 md:col-span-8'
                    else if (numCols === 7) colSpanClass = 'col-span-12 md:col-span-7'
                    else if (numCols === 6) colSpanClass = 'col-span-12 md:col-span-6'
                    else if (numCols === 5) colSpanClass = 'col-span-12 md:col-span-5'
                    else if (numCols === 4) colSpanClass = 'col-span-12 md:col-span-4'
                    else if (numCols === 3) colSpanClass = 'col-span-12 md:col-span-3'
                    else if (numCols === 2) colSpanClass = 'col-span-12 md:col-span-2'
                    else if (numCols === 1) colSpanClass = 'col-span-12 md:col-span-1'
                  } else if (widthVal === '75%') {
                    colSpanClass = 'col-span-12 md:col-span-9'
                  } else if (widthVal.includes('66')) {
                    colSpanClass = 'col-span-12 md:col-span-8'
                  } else if (widthVal === '50%' || widthVal === 'w-1/2' || sf.dbColumn.includes('produto')) {
                    colSpanClass = 'col-span-12 md:col-span-6'
                  } else if (widthVal === '33%' || widthVal === '33.33%') {
                    colSpanClass = 'col-span-12 md:col-span-4'
                  } else if (widthVal === '25%' || widthVal === 'w-1/4') {
                    colSpanClass = 'col-span-12 md:col-span-3'
                  } else if (widthVal.includes('16') || isQtd || isPreco || isTotalField) {
                    colSpanClass = 'col-span-12 md:col-span-2'
                  }

                  if (isSelect) {
                    return (
                      <div key={sf.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                        <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                          {sf.label}
                        </label>
                        <select
                          name={sf.dbColumn}
                          defaultValue={String(val ?? '')}
                          className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Selecione...</option>
                          {sf.config.options.map((opt: any, oIdx: number) => {
                            const optVal = typeof opt === 'object' ? (opt.value ?? opt.id) : opt
                            const optLabel = typeof opt === 'object' ? (opt.label || opt.value) : opt
                            return <option key={oIdx} value={String(optVal)}>{String(optLabel)}</option>
                          })}
                        </select>
                      </div>
                    )
                  }

                  if (isTotalField) {
                    const subModalTotal = subModalQtd * subModalPreco
                    return (
                      <div key={sf.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                        <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                          {sf.label}
                        </label>
                        <input
                          name={sf.dbColumn}
                          type="text"
                          readOnly
                          value={subModalTotal > 0 ? subModalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (val ? parseAnyNumber(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00')}
                          className="w-full bg-neutral-100/80 dark:bg-neutral-800/80 font-semibold cursor-not-allowed text-neutral-800 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm outline-none"
                        />
                      </div>
                    )
                  }

                  const mask = sf.config?.content?.mask || sf.config?.mask || (isPreco ? '0.000,00' : '')
                  let initialFormatted = isDate ? formatDateForInput(val) : String(val ?? '')
                  if (mask) {
                    initialFormatted = applyFieldMask(val, mask)
                  } else if (isPreco && val !== undefined && val !== null && val !== '') {
                    initialFormatted = applyFieldMask(val, '0.000,00')
                  }

                  return (
                    <div key={sf.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                      <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                        {sf.label}
                      </label>
                      <input
                        name={sf.dbColumn}
                        data-mask={mask}
                        type={isDate ? 'date' : (isNumber && !mask && !isPreco) ? 'number' : 'text'}
                        defaultValue={initialFormatted}
                        onChange={(e) => {
                          if (mask) {
                            e.target.value = formatMaskRealtime(e.target.value, mask)
                          }
                          if (isQtd) setSubModalQtd(Number(e.target.value) || 0)
                          if (isPreco) {
                            const cleanVal = parseAnyNumber(e.target.value)
                            setSubModalPreco(cleanVal)
                          }
                        }}
                        placeholder={sf.config?.placeholder || \`Digite o valor para \${sf.label}...\`}
                        className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingSubItem(null)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs tracking-wide transition-colors shadow-lg shadow-indigo-500/20"
                >
                  <Save className="w-4 h-4" /> {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Confirmação de Exclusão de Sub-Item (Imagem 3 fundo) */}
      {mounted && deletingSubItem && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Excluir Registro
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Esta ação não pode ser desfeita e removerá permanentemente os dados do banco.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeletingSubItem(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400">
              <div className="p-2 bg-red-500/20 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold">Você tem certeza?</p>
                <p className="text-xs opacity-80 mt-0.5">
                  Você está prestes a excluir "\${String(deletingSubItem.subItem.id || deletingSubItem.subItem.codigo || deletingSubItem.subItem.produto_nome || deletingSubItem.subItem.produto || 'este registro')}".
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSubItem(null)}
                className="px-6 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
              >
                CANCELAR
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDeleteSubItem}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-colors shadow-lg shadow-red-500/20"
              >
                <Trash2 className="w-4 h-4" /> {isSubmitting ? 'Excluindo...' : 'CONFIRMAR EXCLUSÃO'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast Notification */}
      {mounted && toastMessage && createPortal(
        <div className={\`fixed bottom-6 right-6 z-[10000] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md border animate-in slide-in-from-bottom-5 duration-300 \${
          toastType === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 bg-white/95 dark:bg-neutral-900/95'
            : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300 bg-white/95 dark:bg-neutral-900/95'
        }\`}>
          <div className={\`w-7 h-7 rounded-xl flex items-center justify-center \${
            toastType === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }\`}>
            {toastType === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>
          <span className="text-xs font-bold tracking-wide">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
`)
}
