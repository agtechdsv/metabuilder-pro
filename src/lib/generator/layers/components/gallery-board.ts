export function generateGalleryBoardComponent(files: Map<string, string>) {
  files.set('components/GalleryBoard.tsx', generateGalleryBoardCode())
}

function generateGalleryBoardCode(): string {
  return `'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  X,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Download,
  Printer,
  Eye,
  Pencil,
  Grid2X2,
  Grid3X3,
  Columns4,
  RotateCcw,
  FileText,
  ImageIcon,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DeleteButton } from '@/components/ui/delete-button'
import { CustomActionButton } from '@/components/ui/custom-action-button'

export interface GalleryConfig {
  imageField?: string
  titleField?: string
  cardFields?: string[]
  cardFieldsLabels?: Record<string, string>
  clickBehavior?: 'fullscreen' | 'thumbnail'
  // Compatibilidade snake_case
  image_field?: string
  title_field?: string
  card_fields?: string[]
  card_fields_labels?: Record<string, string>
}

export interface GalleryBoardProps {
  data: any[]
  fields?: any[]
  galleryConfig?: GalleryConfig
  galleryClickBehavior?: 'fullscreen' | 'thumbnail'
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  customActions?: any[]
  onCustomAction?: (action: any, row?: any) => void
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => Promise<void> | void
  onAdd?: () => void
  title?: string
}

export function GalleryBoard({
  data = [],
  fields = [],
  galleryConfig = {},
  galleryClickBehavior,
  relationalOptions = {},
  customActions = [],
  onCustomAction,
  onView,
  onEdit,
  onDelete,
  onAdd,
  title,
}: GalleryBoardProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'image' | 'document'>('all')
  const [gridCols, setGridCols] = useState<3 | 4 | 2>(4)
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null)
  const [previewZoom, setPreviewZoom] = useState(1.0)

  // Resolução dos campos configurados (camelCase com fallback snake_case)
  const imageCol = galleryConfig.imageField || galleryConfig.image_field || ''
  const titleCol = galleryConfig.titleField || galleryConfig.title_field || ''
  const cardCols = galleryConfig.cardFields || galleryConfig.card_fields || []
  const cardLabels = galleryConfig.cardFieldsLabels || galleryConfig.card_fields_labels || {}
  const clickBehavior = galleryClickBehavior || galleryConfig.clickBehavior || 'fullscreen'

  const getActionColorClasses = (color?: string) => {
    const normalized = color?.toLowerCase() || 'indigo'
    switch (normalized) {
      case 'emerald':
        return {
          text: 'text-emerald-600 dark:text-emerald-400',
          bg: 'bg-emerald-50 dark:bg-emerald-950/30',
          border: 'border-emerald-200 dark:border-emerald-800/50',
          hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300',
        }
      case 'amber':
        return {
          text: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-950/30',
          border: 'border-amber-200 dark:border-amber-800/50',
          hover: 'hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-300',
        }
      case 'red':
        return {
          text: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-950/30',
          border: 'border-red-200 dark:border-red-800/50',
          hover: 'hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300',
        }
      case 'rose':
        return {
          text: 'text-rose-600 dark:text-rose-400',
          bg: 'bg-rose-50 dark:bg-rose-950/30',
          border: 'border-rose-200 dark:border-rose-800/50',
          hover: 'hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-700 dark:hover:text-rose-300',
        }
      case 'blue':
        return {
          text: 'text-blue-600 dark:text-blue-400',
          bg: 'bg-blue-50 dark:bg-blue-950/30',
          border: 'border-blue-200 dark:border-blue-800/50',
          hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300',
        }
      case 'purple':
        return {
          text: 'text-purple-600 dark:text-purple-400',
          bg: 'bg-purple-50 dark:bg-purple-950/30',
          border: 'border-purple-200 dark:border-purple-800/50',
          hover: 'hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300',
        }
      default:
        return {
          text: 'text-indigo-600 dark:text-indigo-400',
          bg: 'bg-indigo-50 dark:bg-indigo-950/30',
          border: 'border-indigo-200 dark:border-indigo-800/50',
          hover: 'hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300',
        }
    }
  }

  // Helper para formatar base64 bruto sem prefixo dataURI
  const formatImageUrl = (val: any): string => {
    if (!val || typeof val !== 'string') return ''
    const clean = val.trim()
    if (clean.startsWith('data:') || clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('/')) {
      return clean
    }
    if (clean.startsWith('iVBORw0KGgo')) return \`data:image/png;base64,\${clean}\`
    if (clean.startsWith('/9j/')) return \`data:image/jpeg;base64,\${clean}\`
    if (clean.startsWith('R0lGOD')) return \`data:image/gif;base64,\${clean}\`
    if (clean.startsWith('UklGR')) return \`data:image/webp;base64,\${clean}\`
    if (clean.length > 50 && !clean.includes(' ') && !clean.includes('\\n')) {
      return \`data:image/jpeg;base64,\${clean}\`
    }
    return clean
  }

  // Normalização e extração de metadados dos registros
  const items = useMemo(() => {
    return data.map((row: any, index: number) => {
      // 1. Título
      let itemTitle = ''
      if (titleCol && row[titleCol] !== undefined && row[titleCol] !== null) {
        itemTitle = String(row[titleCol])
      } else {
        const foundField = fields.find((f: any) => !f.isPrimaryKey && (f.dataType === 'string' || f.dataType === 'text' || f.dataType === 'varchar'))
        if (foundField && row[foundField.dbColumn]) {
          itemTitle = String(row[foundField.dbColumn])
        } else {
          itemTitle = String(row.id || index + 1)
        }
      }

      // 2. Imagem / Arquivo (resolvido estritamente a partir da configuração ou dataType do schema)
      let rawImage = ''
      if (imageCol && row[imageCol]) {
        rawImage = row[imageCol]
      } else {
        const imgField = fields.find((f: any) =>
          f.dataType === 'image' ||
          f.dataType === 'file' ||
          f.config?.component?.type === 'image' ||
          f.config?.component?.type === 'file'
        )
        if (imgField && row[imgField.dbColumn]) {
          rawImage = row[imgField.dbColumn]
        }
      }

      const lowerImg = String(rawImage || '').toLowerCase()
      const isPdf = lowerImg.endsWith('.pdf') || lowerImg.includes('.pdf?') || lowerImg.includes('.pdf#')
      const isDoc = !isPdf && (
        lowerImg.endsWith('.doc') || lowerImg.endsWith('.docx') ||
        lowerImg.endsWith('.xls') || lowerImg.endsWith('.xlsx') ||
        lowerImg.endsWith('.csv') || lowerImg.endsWith('.txt')
      )
      const imageUrl = formatImageUrl(rawImage)
      const hasImage = Boolean(imageUrl) && !isPdf && !isDoc

      // Subtítulo / Nome do arquivo
      let fileName = ''
      if (rawImage && (rawImage.startsWith('http://') || rawImage.startsWith('https://'))) {
        try {
          const urlObj = new URL(rawImage)
          const lastSegment = urlObj.pathname.split('/').pop()
          if (lastSegment && (lastSegment.includes('.') || lastSegment.includes('-'))) {
            fileName = decodeURIComponent(lastSegment)
          }
        } catch {}
      }
      if (!fileName) {
        const cleanBase = itemTitle.toLowerCase().replace(/[^\\w\\s.-]/g, '').replace(/\\s+/g, '_')
        fileName = cleanBase + (isPdf ? '.pdf' : isDoc ? '.doc' : '.jpg')
      }

      // 3. Card metadata fields (conforme configurado no Studio)
      const metaEntries = cardCols.map((col: string) => {
        let val = row[col]
        let label = cardLabels[col]

        // Resolução dinâmica para campos relacionais em formato "tabela.coluna"
        if (col.includes('.')) {
          const [relTable, relCol] = col.split('.')
          if (!label) {
            label = relCol.toUpperCase()
          }
          if (val === undefined || val === null || val === '') {
            val = row[relTable]?.[relCol]
          }
          if (val === undefined || val === null || val === '') {
            // Procura dinamicamente a FK correspondente na linha
            for (const [rowKey, rowVal] of Object.entries(row)) {
              if (rowKey.endsWith('_id') && rowVal !== undefined && rowVal !== null) {
                const baseFk = rowKey.slice(0, -3)
                if (relTable.startsWith(baseFk) || baseFk.startsWith(relTable.replace(/s$/, ''))) {
                  const opts = relationalOptions[rowKey] || relationalOptions[relTable]
                  if (opts) {
                    const matched = opts.find(o => String(o.value) === String(rowVal))
                    if (matched) {
                      val = matched.label
                      break
                    }
                  }
                }
              }
            }
          }
        }

        if (!label) {
          label = fields.find((f: any) => f.dbColumn === col)?.label || col.toUpperCase()
        }

        let displayVal = val !== undefined && val !== null ? String(val) : ''

        // Lookup em relationalOptions
        if (relationalOptions[col]) {
          const matched = relationalOptions[col].find(opt => String(opt.value) === String(val))
          if (matched) displayVal = matched.label
        }

        return { col, label: label.toUpperCase(), value: displayVal }
      }).filter(m => m.value)

      return {
        raw: row,
        id: row.id || row.codigo || index,
        title: itemTitle,
        fileName,
        imageUrl,
        hasImage,
        isPdf,
        isDoc,
        metadata: metaEntries,
      }
    })
  }, [data, fields, imageCol, titleCol, cardCols, cardLabels, relationalOptions])

  // Filtros aplicados
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Filtro de tipo de mídia
      if (activeFilter === 'image' && !item.hasImage) return false
      if (activeFilter === 'document' && (!item.isPdf && !item.isDoc && item.hasImage)) return false

      // Busca por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const inTitle = item.title.toLowerCase().includes(q)
        const inFileName = item.fileName.toLowerCase().includes(q)
        const inId = String(item.id).toLowerCase().includes(q)
        const inMeta = item.metadata.some(m => m.value.toLowerCase().includes(q) || m.label.toLowerCase().includes(q))
        if (!inTitle && !inFileName && !inId && !inMeta) return false
      }

      return true
    })
  }, [items, activeFilter, searchQuery])

  // Reset zoom ao trocar asset selecionado
  useEffect(() => {
    setPreviewZoom(1.0)
  }, [selectedAsset])

  const handleCardClick = (item: any) => {
    if (clickBehavior === 'fullscreen' && item.hasImage) {
      setSelectedAsset(item)
    } else if (onView) {
      onView(item.raw)
    } else if (onEdit) {
      onEdit(item.raw)
    }
  }

  const handleDownloadImage = (url: string, filename: string) => {
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = filename || 'download'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      window.open(url, '_blank')
    }
  }

  const handlePrintImage = (url: string) => {
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(\`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;background:#000;"><img src="\${url}" style="max-width:100%;max-height:100vh;object-fit:contain;" onload="window.print();window.close();" /></body></html>\`)
      win.document.close()
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Barra Secundária da Galeria: Busca, Abas de Mídia e Densidade */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm backdrop-blur-md">
        {/* Campo de Pesquisa Local */}
        <div className="relative flex-1 max-w-md group">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar arquivos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-9 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 rounded-xl text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-neutral-900 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Abas e Controles de Grid */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-between sm:justify-end">
          {/* Seletores de Coluna da Grade */}
          <div className="hidden md:inline-flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 text-neutral-500">
            <button
              title="2 colunas"
              onClick={() => setGridCols(2)}
              className={cn(
                'p-1.5 rounded-lg transition-all cursor-pointer',
                gridCols === 2 ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              <Grid2X2 className="w-4 h-4" />
            </button>
            <button
              title="3 colunas"
              onClick={() => setGridCols(3)}
              className={cn(
                'p-1.5 rounded-lg transition-all cursor-pointer',
                gridCols === 3 ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              title="4 colunas"
              onClick={() => setGridCols(4)}
              className={cn(
                'p-1.5 rounded-lg transition-all cursor-pointer',
                gridCols === 4 ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              <Columns4 className="w-4 h-4" />
            </button>
          </div>

          {/* Abas: Todos, Imagens, Documentos (Fiel à Web Produção) */}
          <div className="inline-flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 text-xs font-semibold">
            <button
              onClick={() => setActiveFilter('all')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg transition-all cursor-pointer',
                activeFilter === 'all'
                  ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              Todos
            </button>
            <button
              onClick={() => setActiveFilter('image')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg transition-all cursor-pointer',
                activeFilter === 'image'
                  ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              Imagens
            </button>
            <button
              onClick={() => setActiveFilter('document')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg transition-all cursor-pointer',
                activeFilter === 'document'
                  ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              Documentos
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Cards da Galeria */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-neutral-900/50 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-3xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400">
            <ImageIcon className="w-8 h-8 opacity-40" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200">
              Nenhum registro encontrado
            </h3>
            <p className="text-xs text-neutral-400 max-w-sm">
              {searchQuery
                ? 'Nenhum resultado corresponde à sua pesquisa. Tente buscar com outros termos.'
                : 'Esta galeria ainda não possui registros cadastrados.'}
            </p>
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-1 cursor-pointer"
            >
              Limpar pesquisa
            </button>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-6',
            gridCols === 2 && 'grid-cols-1 sm:grid-cols-2',
            gridCols === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
            gridCols === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
          )}
        >
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group relative bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:border-indigo-500/50 transition-all duration-300 flex flex-col justify-between"
            >
              {/* Área de Visualização da Imagem / Thumbnail / Documento */}
              <div
                onClick={() => handleCardClick(item)}
                className={cn(
                  "relative aspect-[4/3] overflow-hidden cursor-pointer flex items-center justify-center select-none",
                  item.isPdf
                    ? "bg-gradient-to-br from-rose-50 to-rose-100/60 dark:from-rose-950/30 dark:to-rose-900/20"
                    : "bg-neutral-100 dark:bg-neutral-800/60"
                )}
              >
                {item.isPdf ? (
                  <div className="flex flex-col items-center justify-center gap-2 text-rose-500">
                    <FileText className="w-12 h-12 text-rose-500" />
                    <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300">
                      PDF
                    </span>
                  </div>
                ) : item.hasImage ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    onError={(e) => {
                      const target = e.currentTarget
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent) {
                        parent.classList.add('bg-gradient-to-br', 'from-neutral-100', 'to-neutral-200', 'dark:from-neutral-800', 'dark:to-neutral-900')
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-6 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800/80 text-neutral-400">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-200/60 dark:bg-neutral-700/50 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 opacity-40 text-neutral-500" />
                    </div>
                    <span className="text-[11px] font-medium text-neutral-400 tracking-wide uppercase">Sem imagem</span>
                  </div>
                )}

                {/* Badge de Tipo no canto superior esquerdo (Fiel à Web Produção: IMAGE / PDF) */}
                <div
                  className={cn(
                    "absolute top-3 left-3 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm pointer-events-none",
                    item.isPdf
                      ? "bg-rose-100/90 dark:bg-rose-950/90 text-rose-600 dark:text-rose-400 border border-rose-200/60"
                      : "bg-black/60 text-white"
                  )}
                >
                  {item.isPdf ? 'PDF' : (item.hasImage ? 'IMAGE' : 'DOC')}
                </div>

                {/* Overlay no hover com botão de preview fullscreen */}
                {item.hasImage && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedAsset(item)
                      }}
                      title="Visualizar em tela cheia"
                      className="w-10 h-10 rounded-full bg-white/90 dark:bg-neutral-900/90 text-neutral-900 dark:text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    {onView && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onView(item.raw)
                        }}
                        title="Ver detalhes"
                        className="w-10 h-10 rounded-full bg-white/90 dark:bg-neutral-900/90 text-neutral-900 dark:text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Corpo do Card: Título, Nome do arquivo e Metadados Verticais */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div>
                    <h3
                      onClick={() => handleCardClick(item)}
                      title={item.title}
                      className="font-bold text-neutral-900 dark:text-white text-base leading-snug line-clamp-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                    >
                      {item.title}
                    </h3>
                    <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 truncate font-mono mt-0.5" title={item.fileName}>
                      {item.fileName}
                    </p>
                  </div>

                  {/* Metadados adicionais em formato vertical fiel ao Studio */}
                  {item.metadata.length > 0 && (
                    <div className="flex flex-col gap-2.5 pt-1">
                      {item.metadata.map((meta: any, i: number) => (
                        <div key={i} className="flex flex-col gap-0.5">
                          <span className="font-black text-neutral-400 dark:text-neutral-500 uppercase text-[9px] tracking-widest">
                            {meta.label}
                          </span>
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 line-clamp-2">
                            {meta.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rodapé do Card com Ações CRUD e Custom Actions */}
                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    Detalhes
                  </span>

                  <div className="flex items-center gap-1">
                    {onView && (
                      <button
                        type="button"
                        onClick={() => onView(item.raw)}
                        title="Visualizar"
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(item.raw)}
                        title="Editar"
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onDelete && (
                      <DeleteButton
                        recordName={item.title}
                        onDelete={async () => {
                          await onDelete(item.raw)
                        }}
                      />
                    )}

                    {/* Ações Personalizadas da Linha (Clientes, Pedidos, etc.) */}
                    {customActions.filter(a => {
                      const ctxs = a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : (a.context ? [a.context] : (a.placement ? [a.placement] : ['row']))
                      return ctxs.includes('row') || ctxs.includes('row_search')
                    }).map(action => {
                      const colors = getActionColorClasses(action.color)
                      return (
                        <CustomActionButton
                          key={action.id}
                          action={action}
                          item={item.raw}
                          variant="plain"
                          className={cn(
                            "p-1.5 rounded-lg text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer",
                            colors.text,
                            colors.hover
                          )}
                          onClick={onCustomAction ? () => onCustomAction(action, item.raw) : undefined}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Fullscreen de Visualização do Asset */}
      <AnimatePresence>
        {selectedAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-5xl h-[90vh] bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
              {/* Header do Modal */}
              <div className="h-16 px-6 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900/90 backdrop-blur-sm z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-white truncate max-w-md">
                      {selectedAsset.title}
                    </h2>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {selectedAsset.fileName}
                    </span>
                  </div>
                </div>

                {/* Controles do Modal */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setPreviewZoom(z => Math.max(0.5, z - 0.25))}
                    title="Diminuir zoom"
                    className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-neutral-400 min-w-[3rem] text-center">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    onClick={() => setPreviewZoom(z => Math.min(3.0, z + 0.25))}
                    title="Aumentar zoom"
                    className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPreviewZoom(1.0)}
                    title="Resetar zoom"
                    className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <div className="h-4 w-px bg-neutral-800 mx-1" />

                  {selectedAsset.imageUrl && (
                    <>
                      <button
                        onClick={() => handleDownloadImage(selectedAsset.imageUrl, selectedAsset.fileName || 'imagem.png')}
                        title="Baixar imagem"
                        className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePrintImage(selectedAsset.imageUrl)}
                        title="Imprimir"
                        className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {onEdit && (
                    <button
                      onClick={() => {
                        const raw = selectedAsset.raw
                        setSelectedAsset(null)
                        onEdit(raw)
                      }}
                      title="Editar registro"
                      className="p-2 rounded-xl text-neutral-400 hover:text-indigo-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedAsset(null)}
                    title="Fechar (Esc)"
                    className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors ml-1 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Área Central de Visualização com Zoom */}
              <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-black/40">
                {selectedAsset.hasImage ? (
                  <div
                    style={{ transform: \`scale(\${previewZoom})\`, transition: 'transform 0.15s ease-out' }}
                    className="origin-center max-w-full max-h-full flex items-center justify-center"
                  >
                    <img
                      src={selectedAsset.imageUrl}
                      alt={selectedAsset.title}
                      className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 text-neutral-500">
                    <ImageIcon className="w-16 h-16 opacity-30" />
                    <span className="text-sm">Sem imagem disponível</span>
                  </div>
                )}
              </div>

              {/* Rodapé com Metadados */}
              {selectedAsset.metadata.length > 0 && (
                <div className="p-4 px-6 border-t border-neutral-800 bg-neutral-900/90 backdrop-blur-sm flex items-center gap-2 overflow-x-auto">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 shrink-0">
                    Metadados:
                  </span>
                  {selectedAsset.metadata.map((m: any, i: number) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-800/80 border border-neutral-700/60 text-xs text-neutral-200 shrink-0"
                    >
                      <span className="text-[10px] font-semibold text-neutral-400 uppercase">
                        {m.label}:
                      </span>
                      <span>{m.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default GalleryBoard
`
}
