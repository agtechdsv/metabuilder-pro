'use client'

import { useState, useRef } from 'react'
import { UploadCloud, Link as LinkIcon, Image as ImageIcon, FileText, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'

interface FileUploaderInputProps {
  value: string
  onChange: (val: string) => void
  disabled?: boolean
  type?: 'image' | 'document' | 'any'
  maxSizeMB?: number
}

export function FileUploaderInput({ 
  value, 
  onChange, 
  disabled = false,
  type = 'image',
  maxSizeMB = 5
}: FileUploaderInputProps) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isImageMode = type === 'image'
  const isAnyMode = type === 'any'
  const acceptTypes = isImageMode ? 'image/*' : isAnyMode ? 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv' : '.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv'

  const handleFile = (file: File) => {
    setError(null)
    
    // Check size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`O arquivo é muito grande. O limite é de ${maxSizeMB}MB.`)
      return
    }

    // Check type
    if (isImageMode && !file.type.startsWith('image/')) {
      setError('Por favor, selecione apenas arquivos de imagem.')
      return
    }
    if (type === 'document' && file.type.startsWith('image/')) {
      setError('Por favor, selecione apenas documentos, não imagens.')
      return
    }

    // Compress image if it's an image file (except SVGs which don't compress well on canvas)
    if (file.type.startsWith('image/') && !file.type.includes('svg')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.src = e.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 1600
          const MAX_HEIGHT = 1600
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            // Fill white background in case of transparent PNG to WebP conversion
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(0, 0, width, height)
            ctx.drawImage(img, 0, 0, width, height)
          }

          // Compress to WebP at 80% quality (extremely efficient)
          const compressedBase64 = canvas.toDataURL('image/webp', 0.8)
          onChange(compressedBase64)
        }
        img.onerror = () => {
          setError('Erro ao processar a imagem para compressão.')
        }
      }
      reader.onerror = () => setError('Erro ao ler o arquivo de imagem.')
      reader.readAsDataURL(file)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const base64String = e.target?.result as string
      onChange(base64String)
    }
    reader.onerror = () => {
      setError('Erro ao processar o arquivo. Tente novamente.')
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const clearValue = () => {
    onChange('')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const isBase64 = value?.startsWith('data:')
  const isUrl = value?.startsWith('http')
  const hasValue = !!value

  // For 'any' type, we dynamically check if the value is an image to render the preview
  const renderAsImage = isImageMode || (isAnyMode && (value?.startsWith('data:image/') || !!value?.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i)))

  return (
    <div className="w-full space-y-2">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900/50 p-1 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
            activeTab === 'upload' 
              ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm" 
              : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50"
          )}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          Upload (Base64)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
            activeTab === 'url' 
              ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm" 
              : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50"
          )}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          Link (URL)
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg text-xs font-bold">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Content Area */}
      {activeTab === 'url' ? (
        <div className="space-y-3">
          <input
            type="url"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={isImageMode ? "https://exemplo.com/imagem.jpg" : isAnyMode ? "https://exemplo.com/arquivo" : "https://exemplo.com/documento.pdf"}
            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
          />
          {hasValue && isUrl && renderAsImage && (
            <div className="relative w-full h-40 bg-neutral-100 dark:bg-neutral-900 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="Preview" className="w-full h-full object-contain" />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {!hasValue || isUrl ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !disabled && fileInputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl transition-all",
                disabled ? "opacity-50 cursor-not-allowed border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900" : "cursor-pointer",
                isDragging ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 bg-neutral-100/50 dark:bg-neutral-900"
              )}
            >
              <div className="flex flex-col items-center justify-center p-5 text-center">
                <div className="p-3 bg-white dark:bg-neutral-800 rounded-full shadow-sm mb-3">
                  {isImageMode ? <ImageIcon className="w-6 h-6 text-indigo-500" /> : <FileText className="w-6 h-6 text-indigo-500" />}
                </div>
                <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                  {isDragging ? 'Solte o arquivo aqui...' : 'Clique ou arraste um arquivo'}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {isImageMode ? 'JPG, PNG, GIF, WEBP' : isAnyMode ? 'Qualquer formato' : 'PDF, DOC, XLS, CSV'} (Max {maxSizeMB}MB)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={acceptTypes}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                disabled={disabled}
              />
            </div>
          ) : (
            <div className="relative w-full border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50 dark:bg-neutral-900">
              {renderAsImage && isBase64 ? (
                <div className="relative h-40 w-full flex items-center justify-center bg-black/5 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={value} alt="Preview Base64" className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300 truncate w-full text-center px-4">
                    Documento Anexado (Base64)
                  </p>
                  <p className="text-[10px] font-mono text-neutral-500 mt-2 bg-white dark:bg-neutral-800 px-2 py-1 rounded">
                    {(value.length / 1024).toFixed(1)} KB
                  </p>
                </div>
              )}
              
              {!disabled && (
                <div className="absolute top-2 right-2 flex gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <button
                    type="button"
                    onClick={clearValue}
                    className="p-1.5 bg-red-500 text-white rounded-md shadow-md hover:bg-red-600 transition-colors"
                    title="Remover"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
