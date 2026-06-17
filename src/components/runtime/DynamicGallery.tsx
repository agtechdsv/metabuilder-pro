'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Eye, 
  Download, 
  ExternalLink, 
  Search, 
  FileText, 
  FileSpreadsheet, 
  FileArchive, 
  FileCode, 
  File, 
  Pencil, 
  Trash2, 
  Calendar, 
  Hash, 
  Type,
  LayoutGrid,
  FileIcon, 
  ImageIcon, 
  Maximize2,
  Minimize2,
  ZoomIn,
  RefreshCw,
  Printer,
  Zap
} from 'lucide-react'
import { cn, getActionColorClasses } from '@/lib/utils'
import { useDynamicGalleryLogic } from './hooks/useDynamicGalleryLogic'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { formatFieldValue, getNestedValue } from '@/lib/formatters'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'

interface DynamicGalleryProps {
  fields: any[]
  data: any[]
  buttonsConfig?: any[]
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
  relationalOptions?: Record<string, any[]>
  galleryClickBehavior?: 'fullscreen' | 'thumbnail'
  galleryConfig?: {
    image_field?: string
    title_field?: string
    card_fields?: string[]
    card_fields_labels?: Record<string, string>
  }
  customActions?: any[]
  onCustomAction?: (action: any, row?: any) => void
}

export default function DynamicGallery({
  fields,
  data,
  buttonsConfig = [],
  onView,
  onEdit,
  onDelete,
  relationalOptions = {},
  galleryClickBehavior = 'fullscreen',
  galleryConfig = {},
  customActions = [],
  onCustomAction
}: DynamicGalleryProps) {
  const { t } = useI18n()
  const { toast } = useToast()
  
  const {
    searchQuery, setSearchQuery,
    activeFilter, setActiveFilter,
    selectedAsset, setSelectedAsset,
    scale, setScale,
    filteredAssets,
    handleDownload,
    handleRedirect
  } = useDynamicGalleryLogic({ fields, data, relationalOptions, galleryConfig })
  const scales = [
    { value: 0.8, icon: <Minimize2 className="w-3.5 h-3.5" />, label: t('runtime.scale_small', 'Pequeno') },
    { value: 1.0, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: t('runtime.scale_normal', 'Normal') },
    { value: 1.2, icon: <Maximize2 className="w-3.5 h-3.5" />, label: t('runtime.scale_large', 'Grande') },
    { value: 1.5, icon: <ZoomIn className="w-3.5 h-3.5" />, label: t('runtime.scale_xl', 'Extra Grande') }
  ]

  const canView = buttonsConfig.find((b: any) => b.id === 'view')?.visible === true
  const canEdit = buttonsConfig.find((b: any) => b.id === 'edit')?.visible === true
  const canDelete = buttonsConfig.find((b: any) => b.id === 'delete')?.visible === true



  const getTypeColorClasses = (type: string) => {
    switch (type) {
      case 'pdf':
        return {
          bg: 'bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/20 dark:to-rose-900/10',
          text: 'text-rose-500 dark:text-rose-450',
          border: 'border-rose-200/50 dark:border-rose-800/30',
          badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-350'
        }
      case 'spreadsheet':
        return {
          bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10',
          text: 'text-emerald-500 dark:text-emerald-450',
          border: 'border-emerald-200/50 dark:border-emerald-800/30',
          badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-350'
        }
      case 'archive':
        return {
          bg: 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10',
          text: 'text-amber-500 dark:text-amber-450',
          border: 'border-amber-200/50 dark:border-amber-800/30',
          badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-350'
        }
      case 'code':
        return {
          bg: 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/20 dark:to-indigo-900/10',
          text: 'text-indigo-500 dark:text-indigo-450',
          border: 'border-indigo-200/50 dark:border-indigo-800/30',
          badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-350'
        }
      case 'document':
        return {
          bg: 'bg-gradient-to-br from-sky-50 to-sky-100/50 dark:from-sky-950/20 dark:to-sky-900/10',
          text: 'text-sky-500 dark:text-sky-450',
          border: 'border-sky-200/50 dark:border-sky-800/30',
          badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-350'
        }
      default:
        return {
          bg: 'bg-gradient-to-br from-neutral-50 to-neutral-100/50 dark:from-neutral-900/20 dark:to-neutral-850/10',
          text: 'text-neutral-500 dark:text-neutral-400',
          border: 'border-neutral-200/50 dark:border-neutral-800/30',
          badge: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
        }
    }
  }

  const renderFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-10 h-10 text-rose-500" />
      case 'spreadsheet':
        return <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
      case 'archive':
        return <FileArchive className="w-10 h-10 text-amber-500" />
      case 'code':
        return <FileCode className="w-10 h-10 text-indigo-500" />
      default:
        return <File className="w-10 h-10 text-neutral-400" />
    }
  }

  if (data.length === 0) {
    return (
      <div className="col-span-full py-20 text-center bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
        <p className="text-neutral-500">Nenhum registro encontrado na galeria.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sub-Header Controls local da Galeria */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-neutral-900/40 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm backdrop-blur-sm">
        <div className="relative w-full sm:w-auto flex-grow max-w-xs">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Buscar arquivos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-medium focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-200"
          />
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto justify-center sm:justify-end flex-wrap sm:flex-nowrap">
          {/* Slider de Escala */}
          <div className="flex items-center gap-1">
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 hidden md:flex">
              {scales.map(s => (
                <button
                  key={s.value}
                  onClick={() => setScale(s.value)}
                  title={s.label}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    scale === s.value 
                      ? "bg-white dark:bg-neutral-700 text-rose-500 dark:text-rose-400 shadow-sm" 
                      : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  )}
                >
                  {s.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Filtros em Abas */}
          <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-900/80 p-1 rounded-xl w-full sm:w-auto justify-center sm:justify-start border border-neutral-200/50 dark:border-neutral-800/80">
            {(['all', 'image', 'document'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all capitalize",
                  activeFilter === filter
                    ? 'bg-white dark:bg-neutral-800 text-rose-500 dark:text-rose-400 shadow-sm border border-neutral-200/20'
                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-350'
                )}
              >
                {filter === 'all' ? 'Todos' : filter === 'image' ? 'Imagens' : 'Documentos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de Cards da Galeria */}
      <div 
        className="grid gap-6"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(200, 320 * scale)}px, 1fr))`
        }}
      >
        <AnimatePresence mode="popLayout">
          {filteredAssets.length > 0 ? (
            filteredAssets.map((asset) => (
              <motion.div 
                key={asset.id} 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="group relative bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl hover:border-rose-500/30 transition-all duration-300 flex flex-col h-full backdrop-blur-sm"
              >
                {/* Area Visual de Preview */}
                <div 
                  onClick={() => {
                    if (galleryClickBehavior === 'thumbnail') {
                      const targetUrl = asset.url || asset.downloadUrl || asset.externalUrl
                      if (targetUrl) {
                        window.open(targetUrl, '_blank')
                      } else {
                        toast('Nenhum link ou visualização disponível para este item.', 'info')
                      }
                    }
                  }}
                  className={cn(
                    "aspect-video w-full relative overflow-hidden border-b border-neutral-100 dark:border-neutral-800/50 flex items-center justify-center select-none",
                    galleryClickBehavior === 'thumbnail' ? 'cursor-zoom-in' : '',
                    asset.type !== 'image' ? getTypeColorClasses(asset.type).bg : 'bg-neutral-50 dark:bg-neutral-950'
                  )}
                >
                  {asset.type === 'image' && asset.url ? (
                    <img 
                      src={asset.url} 
                      alt={asset.title} 
                      onClick={(e) => {
                        if (galleryClickBehavior === 'thumbnail') {
                          e.stopPropagation()
                          window.open(asset.url, '_blank')
                        }
                      }}
                      className={cn(
                        "w-full h-full transition-transform duration-500",
                        galleryClickBehavior === 'thumbnail' ? "object-contain p-2 group-hover:scale-105" : "object-cover group-hover:scale-105"
                      )} 
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                        const parent = (e.target as HTMLElement).parentElement
                        if (parent) {
                          const placeholder = parent.querySelector('.image-fallback')
                          if (placeholder) placeholder.classList.remove('hidden')
                        }
                      }}
                    />
                  ) : null}

                  {/* Fallback visual caso não seja imagem ou falhe o load */}
                  <div className={cn(
                    "image-fallback flex flex-col items-center gap-2 p-4 text-center select-none absolute inset-0 flex items-center justify-center",
                    asset.type === 'image' && asset.url ? 'hidden' : '',
                    asset.type !== 'image' ? getTypeColorClasses(asset.type).text : ''
                  )}>
                    {renderFileIcon(asset.type)}
                    <span className={cn(
                      "text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded shadow-sm",
                      asset.type !== 'image' ? getTypeColorClasses(asset.type).badge : 'bg-neutral-100 text-neutral-450 dark:bg-neutral-800'
                    )}>
                      {asset.format}
                    </span>
                  </div>

                  {/* Overlay de Hover para visualizar */}
                  {galleryClickBehavior !== 'thumbnail' && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedAsset(asset)
                        }}
                        className="px-4 py-2 bg-white text-neutral-900 rounded-xl hover:bg-neutral-100 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider"
                      >
                        <Eye className="w-4 h-4 text-rose-500" />
                        <span>Visualizar</span>
                      </button>
                    </div>
                  )}

                  {/* Tag Superior Esquerda indicando o tipo */}
                  <div className={cn(
                    "absolute top-3 left-3 px-2 py-1 backdrop-blur-sm rounded-lg border text-[8px] font-black uppercase tracking-wider shadow-sm z-10",
                    asset.type !== 'image' 
                      ? `${getTypeColorClasses(asset.type).badge} ${getTypeColorClasses(asset.type).border}` 
                      : "bg-white/80 dark:bg-neutral-950/80 border-neutral-200/50 dark:border-neutral-800 text-neutral-600 dark:text-neutral-450"
                  )}>
                    {asset.type}
                  </div>

                  {/* Botões de Ação CRUD Superior Direito */}
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-250"
                  >
                    {canView && (
                      <button 
                        onClick={() => onView?.(asset.raw)}
                        className="p-1.5 rounded-lg bg-white/90 dark:bg-neutral-950/90 text-neutral-500 dark:text-neutral-400 hover:text-indigo-500 transition-colors shadow-sm"
                        title="Ver Detalhes"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canEdit && (
                      <button 
                        onClick={() => onEdit?.(asset.raw)}
                        className="p-1.5 rounded-lg bg-white/90 dark:bg-neutral-950/90 text-neutral-500 dark:text-neutral-400 hover:text-rose-500 transition-colors shadow-sm"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button 
                        onClick={() => onDelete?.(asset.raw)}
                        className="p-1.5 rounded-lg bg-white/90 dark:bg-neutral-950/90 text-neutral-500 dark:text-neutral-400 hover:text-red-500 transition-colors shadow-sm"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {customActions.filter(a => (a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : [a.context]).includes('row')).map(action => {
                      const colors = getActionColorClasses(action.color)
                      return (
                        <button
                          key={action.id}
                          title={action.label}
                          onClick={(e) => { e.stopPropagation(); onCustomAction?.(action, asset.raw) }}
                          className={cn("p-1.5 rounded-lg shadow-sm transition-colors", colors.bg, colors.text, colors.hover)}
                        >
                          {action.icon ? <DynamicIcon icon={action.icon} className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Corpo do Card */}
                <div className="p-5 flex-grow flex flex-col justify-between gap-4">
                  <div className="space-y-1">
                    <h4 
                      className="font-black text-neutral-800 dark:text-white leading-snug line-clamp-2 min-h-[2rem]"
                      style={{ fontSize: `${12 * scale}px` }}
                    >
                      {asset.title}
                    </h4>
                    <p 
                      className="font-bold text-neutral-400 dark:text-neutral-500 font-mono truncate" title={asset.fileName}
                      style={{ fontSize: `${9 * scale}px` }}
                    >
                      {asset.fileName}
                    </p>
                  </div>

                  {galleryConfig && Array.isArray(galleryConfig.card_fields) && galleryConfig.card_fields.length > 0 && asset.metadata.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2">
                      {asset.metadata.map((meta, idx) => (
                        <div key={idx} className="flex flex-col gap-0.5">
                          <span 
                            className="font-black text-neutral-400 uppercase tracking-widest"
                            style={{ fontSize: `${8 * scale}px` }}
                          >
                            {meta.label}
                          </span>
                          <span 
                            className="font-bold text-neutral-700 dark:text-neutral-300 line-clamp-2"
                            style={{ fontSize: `${10 * scale}px` }}
                          >
                            {meta.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-neutral-100 dark:border-neutral-850/60 pt-3 mt-auto">
                    {asset.size && asset.size !== 'N/A' ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Tamanho</span>
                        <span className="text-[10px] font-black text-neutral-700 dark:text-neutral-300">{asset.size}</span>
                      </div>
                    ) : <div />}

                    <div className="flex gap-1.5">
                      {asset.downloadUrl && (
                        <button 
                          type="button"
                          onClick={() => handleDownload(asset)}
                          className="p-2 hover:bg-rose-500/10 hover:text-rose-500 text-neutral-400 dark:text-neutral-500 dark:hover:text-rose-400 rounded-xl transition-all hover:scale-105 active:scale-95"
                          title="Baixar arquivo"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {asset.externalUrl && (
                        <button 
                          type="button"
                          onClick={() => handleRedirect(asset)}
                          className="p-2 hover:bg-rose-500/10 hover:text-rose-500 text-neutral-400 dark:text-neutral-500 dark:hover:text-rose-400 rounded-xl transition-all hover:scale-105 active:scale-95"
                          title="Acessar link externo"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-16 text-center text-neutral-400 italic text-xs bg-white dark:bg-neutral-900/10 border border-dashed border-neutral-200 dark:border-neutral-850 rounded-[2rem]">
              Nenhum arquivo correspondente aos filtros da busca.
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Lightbox / Preview Modal */}
      <AnimatePresence>
        {selectedAsset && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
            onClick={() => setSelectedAsset(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="w-full max-w-lg bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-neutral-450 tracking-widest flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5 text-rose-500" />
                  Visualizar Recurso
                </span>
                <button 
                  type="button"
                  onClick={() => setSelectedAsset(null)}
                  className="text-xs font-black text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 transition-colors uppercase tracking-wider"
                >
                  Fechar
                </button>
              </div>
              
              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/80 flex items-center justify-center relative group">
                  {selectedAsset.type === 'image' && selectedAsset.url ? (
                    <>
                      <img src={selectedAsset.url} alt="" className="w-full h-full object-contain" />
                      <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleDownload(selectedAsset)}
                          className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-all shadow-md"
                          title="Baixar Imagem"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            const w = window.open('')
                            if (w) {
                              w.document.write(`<img src="${selectedAsset.url}" style="max-width:100%;" onload="window.print();window.close();" />`)
                              w.document.close()
                            }
                          }}
                          className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-all shadow-md"
                          title="Imprimir Imagem"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (selectedAsset.type === 'pdf' || selectedAsset.type === 'document' || selectedAsset.type === 'code') && (selectedAsset.url || selectedAsset.downloadUrl) ? (
                    <iframe src={selectedAsset.url || selectedAsset.downloadUrl} className="w-full h-full border-0 bg-white" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 select-none">
                      {renderFileIcon(selectedAsset.type)}
                      <span className="text-[10px] font-mono font-black uppercase text-neutral-450 bg-neutral-150 dark:bg-neutral-850 px-2.5 py-0.5 rounded">
                        {selectedAsset.format}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h5 className="font-black text-sm text-neutral-800 dark:text-white leading-snug">
                      {selectedAsset.title}
                    </h5>
                    <p className="text-[10px] text-neutral-400 font-mono mt-1 break-all select-all">
                      {selectedAsset.fileName}
                    </p>
                  </div>

                  {/* Metadata Info Panel */}
                  <div className="grid grid-cols-2 gap-4 text-[11px] bg-neutral-50/50 dark:bg-neutral-900/60 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-850">
                    <div>
                      <span className="text-neutral-400 block text-[8px] font-black uppercase tracking-wider">Formato</span>
                      <span className="font-bold text-neutral-700 dark:text-neutral-350 uppercase">{selectedAsset.type} ({selectedAsset.format})</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[8px] font-black uppercase tracking-wider">Tamanho</span>
                      <span className="font-bold text-neutral-700 dark:text-neutral-350">{selectedAsset.size}</span>
                    </div>

                    {selectedAsset.metadata && selectedAsset.metadata.length > 0 && (
                      <div className="col-span-2 border-t border-neutral-200/30 dark:border-neutral-800/50 pt-3 mt-1 grid grid-cols-2 gap-3">
                        {selectedAsset.metadata.map((meta: any, idx: number) => (
                          <div key={idx}>
                            <span className="text-neutral-400 block text-[8px] font-black uppercase tracking-wider">{meta.label}</span>
                            <span className="font-bold text-neutral-700 dark:text-neutral-350 break-words">{meta.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-900/40 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-end gap-3">
                {selectedAsset.downloadUrl && (
                  <button
                    type="button"
                    onClick={() => handleDownload(selectedAsset)}
                    className="h-10 px-5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-rose-500/20 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                )}
                {selectedAsset.externalUrl && (
                  <button
                    type="button"
                    onClick={() => handleRedirect(selectedAsset)}
                    className="h-10 px-5 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-150 dark:hover:bg-neutral-700/80 rounded-xl font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-700 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Acessar Link
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
