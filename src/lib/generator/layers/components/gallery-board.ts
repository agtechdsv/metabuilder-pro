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
  Minimize2,
  ZoomIn,
  ZoomOut,
  Download,
  Printer,
  Eye,
  Pencil,
  Trash2,
  Plus,
  ImageIcon,
  FileText,
  Sparkles,
  LayoutGrid,
  Grid2X2,
  Grid3X3,
  Columns4,
  ExternalLink,
  RotateCcw,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DeleteButton } from '@/components/ui/delete-button'

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
  onView,
  onEdit,
  onDelete,
  onAdd,
  title,
}: GalleryBoardProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'with_image' | 'no_image'>('all')
  const [gridCols, setGridCols] = useState<3 | 4 | 2>(4)
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null)
  const [previewZoom, setPreviewZoom] = useState(1.0)

  // Resolução dos campos configurados (camelCase com fallback snake_case)
  const imageCol = galleryConfig.imageField || galleryConfig.image_field || ''
  const titleCol = galleryConfig.titleField || galleryConfig.title_field || ''
  const cardCols = galleryConfig.cardFields || galleryConfig.card_fields || []
  const cardLabels = galleryConfig.cardFieldsLabels || galleryConfig.card_fields_labels || {}
  const clickBehavior = galleryClickBehavior || galleryConfig.clickBehavior || 'fullscreen'

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
        const foundField = fields.find((f: any) =>
          f.dbColumn !== 'id' &&
          (f.dbColumn.includes('nome') || f.dbColumn.includes('name') || f.dbColumn.includes('titulo') || f.dbColumn.includes('title'))
        )
        if (foundField && row[foundField.dbColumn]) {
          itemTitle = String(row[foundField.dbColumn])
        } else {
          itemTitle = row.nome || row.name || row.titulo || row.title || row.descricao || row.description || \`Item #\${row.id || index + 1}\`
        }
      }

      // 2. Imagem
      let rawImage = ''
      if (imageCol && row[imageCol]) {
        rawImage = row[imageCol]
      } else {
        // Auto-busca por campo de imagem
        const imgField = fields.find((f: any) =>
          f.dataType === 'image' ||
          f.dbColumn.includes('foto') ||
          f.dbColumn.includes('imagem') ||
          f.dbColumn.includes('image') ||
          f.dbColumn.includes('avatar') ||
          f.dbColumn.includes('capa')
        )
        if (imgField && row[imgField.dbColumn]) {
          rawImage = row[imgField.dbColumn]
        }
      }
      const imageUrl = formatImageUrl(rawImage)
      const hasImage = Boolean(imageUrl)

      // 3. Card metadata fields
      const metaEntries = cardCols.map((col: string) => {
        const val = row[col]
        const label = cardLabels[col] || fields.find((f: any) => f.dbColumn === col)?.label || col
        let displayVal = val !== undefined && val !== null ? String(val) : ''

        // Lookup em relationalOptions
        if (relationalOptions[col]) {
          const matched = relationalOptions[col].find(opt => String(opt.value) === String(val))
          if (matched) displayVal = matched.label
        }

        return { col, label, value: displayVal }
      }).filter(m => m.value)

      return {
        raw: row,
        id: row.id || row.codigo || index,
        title: itemTitle,
        imageUrl,
        hasImage,
        metadata: metaEntries,
      }
    })
  }, [data, fields, imageCol, titleCol, cardCols, cardLabels, relationalOptions])

  // Filtros aplicados
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Filtro de tipo
      if (activeFilter === 'with_image' && !item.hasImage) return false
      if (activeFilter === 'no_image' && item.hasImage) return false

      // Busca por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const inTitle = item.title.toLowerCase().includes(q)
        const inId = String(item.id).toLowerCase().includes(q)
        const inMeta = item.metadata.some(m => m.value.toLowerCase().includes(q) || m.label.toLowerCase().includes(q))
        if (!inTitle && !inId && !inMeta) return false
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
      {/* Barra Superior: Busca, Filtros de Imagem e Densidade */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm backdrop-blur-md">
        {/* Campo de Pesquisa */}
        <div className="relative flex-1 max-w-md group">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder="Pesquisar por título, ID ou metadados..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-9 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 rounded-xl text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-neutral-900 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros de Tipo e Controles de Grid */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-between sm:justify-end">
          {/* Tabs com/sem imagem */}
          <div className="inline-flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 text-xs font-semibold">
            <button
              onClick={() => setActiveFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all',
                activeFilter === 'all'
                  ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              Todos ({items.length})
            </button>
            <button
              onClick={() => setActiveFilter('with_image')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all',
                activeFilter === 'with_image'
                  ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              Com Imagem ({items.filter(i => i.hasImage).length})
            </button>
          </div>

          {/* Seletores de Coluna da Grade */}
          <div className="hidden md:inline-flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 text-neutral-500">
            <button
              title="2 colunas"
              onClick={() => setGridCols(2)}
              className={cn(
                'p-1.5 rounded-lg transition-all',
                gridCols === 2 ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              <Grid2X2 className="w-4 h-4" />
            </button>
            <button
              title="3 colunas"
              onClick={() => setGridCols(3)}
              className={cn(
                'p-1.5 rounded-lg transition-all',
                gridCols === 3 ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              title="4 colunas"
              onClick={() => setGridCols(4)}
              className={cn(
                'p-1.5 rounded-lg transition-all',
                gridCols === 4 ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              <Columns4 className="w-4 h-4" />
            </button>
          </div>

          {onAdd && (
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo
            </button>
          )}
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
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
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
            gridCols === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          )}
        >
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group relative bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:border-indigo-500/50 transition-all duration-300 flex flex-col justify-between"
            >
              {/* Área de Visualização da Imagem / Thumbnail */}
              <div
                onClick={() => handleCardClick(item)}
                className="relative aspect-[4/3] bg-neutral-100 dark:bg-neutral-800/60 overflow-hidden cursor-pointer flex items-center justify-center"
              >
                {item.hasImage ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    onError={(e) => {
                      // Fallback em caso de erro no carregamento da imagem
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

                {/* Badge de ID no canto superior esquerdo */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-mono font-bold text-white shadow-sm pointer-events-none">
                  #{item.id}
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
                      className="w-10 h-10 rounded-full bg-white/90 dark:bg-neutral-900/90 text-neutral-900 dark:text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
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
                        className="w-10 h-10 rounded-full bg-white/90 dark:bg-neutral-900/90 text-neutral-900 dark:text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Corpo do Card: Título e Metadados */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3
                    onClick={() => handleCardClick(item)}
                    title={item.title}
                    className="font-bold text-neutral-900 dark:text-white text-base leading-snug line-clamp-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                  >
                    {item.title}
                  </h3>

                  {/* Metadados adicionais em chips */}
                  {item.metadata.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.metadata.map((meta, i) => (
                        <div
                          key={i}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 max-w-full truncate border border-neutral-200/50 dark:border-neutral-700/50"
                        >
                          <span className="font-semibold text-neutral-400 dark:text-neutral-500 uppercase text-[9px] tracking-wider shrink-0">
                            {meta.label}:
                          </span>
                          <span className="truncate">{meta.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rodapé do Card com Ações */}
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
                      #{selectedAsset.id}
                    </span>
                  </div>
                </div>

                {/* Controles do Modal */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setPreviewZoom(z => Math.max(0.5, z - 0.25))}
                    title="Diminuir zoom"
                    className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-neutral-400 min-w-[3rem] text-center">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    onClick={() => setPreviewZoom(z => Math.min(3.0, z + 0.25))}
                    title="Aumentar zoom"
                    className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPreviewZoom(1.0)}
                    title="Resetar zoom"
                    className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <div className="h-4 w-px bg-neutral-800 mx-1" />

                  {selectedAsset.imageUrl && (
                    <>
                      <button
                        onClick={() => handleDownloadImage(selectedAsset.imageUrl, \`\${selectedAsset.title || 'imagem'}.png\`)}
                        title="Baixar imagem"
                        className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePrintImage(selectedAsset.imageUrl)}
                        title="Imprimir"
                        className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
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
                      className="p-2 rounded-xl text-neutral-400 hover:text-indigo-400 hover:bg-neutral-800 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedAsset(null)}
                    title="Fechar (Esc)"
                    className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors ml-1"
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
