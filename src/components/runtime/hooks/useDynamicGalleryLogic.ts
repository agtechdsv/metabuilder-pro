import { useState, useMemo } from 'react'
import { formatFieldValue, getNestedValue } from '@/lib/formatters'
import { useToast } from '@/components/ui/Toast'

export interface UseDynamicGalleryLogicProps {
  fields: any[];
  data: any[];
  relationalOptions?: Record<string, any[]>;
  galleryConfig?: {
    image_field?: string;
    title_field?: string;
    card_fields?: string[];
    card_fields_labels?: Record<string, string>;
  };
}

export function useDynamicGalleryLogic({
  fields,
  data,
  relationalOptions = {},
  galleryConfig = {}
}: UseDynamicGalleryLogicProps) {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'image' | 'document'>('all')
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null)
  const [scale, setScale] = useState(1.0)

  // Mapeia uma linha genérica para o formato ideal de asset de galeria
  const mappedAssets = useMemo(() => {
    return data.map((row) => {
      // 1. Coleta todas as propriedades da linha e do mapeamento de campos
      const allValues: Record<string, any> = { ...row }
      fields.forEach(f => {
        allValues[f.db_column_name] = getNestedValue(row, f.db_column_name)
      })

      // Helper para formatar base64 bruto sem prefixo dataURI
      const formatBase64 = (str: string) => {
        if (!str) return str
        if (str.startsWith('data:')) return str
        const clean = str.trim()
        if (clean.startsWith('iVBORw0KGgo')) return `data:image/png;base64,${clean}`
        if (clean.startsWith('/9j/')) return `data:image/jpeg;base64,${clean}`
        if (clean.startsWith('R0lGOD')) return `data:image/gif;base64,${clean}`
        if (clean.startsWith('UklGR')) return `data:image/webp;base64,${clean}`
        return str
      }

      // 1. Identificar título
      let title = ''
      const titleField = fields.find(f => {
        if (galleryConfig?.title_field) return f.db_column_name === galleryConfig.title_field || f.id === galleryConfig.title_field
        const col = f.db_column_name.toLowerCase()
        return col === 'title' || col === 'name' || col === 'nome' || col === 'titulo' || col === 'label'
      })
      let titleFieldObj = titleField;
      
      if (titleField) {
        title = formatFieldValue(allValues[titleField.db_column_name], titleField, relationalOptions) || ''
      } else if (galleryConfig?.title_field && getNestedValue(allValues, galleryConfig.title_field) !== undefined) {
        title = String(getNestedValue(allValues, galleryConfig.title_field))
      } else {
        const titleKey = Object.keys(allValues).find(key => {
          const k = key.toLowerCase()
          return k === 'title' || k === 'name' || k === 'nome' || k === 'titulo' || k === 'label'
        })
        if (titleKey) {
          titleFieldObj = fields.find(f => f.db_column_name === titleKey);
          title = titleFieldObj ? formatFieldValue(allValues[titleKey], titleFieldObj, relationalOptions) : String(allValues[titleKey] || '')
        } else {
          const textFields = fields.filter(f => {
            const col = f.db_column_name.toLowerCase()
            return !col.includes('id') && !col.includes('url') && !col.includes('image') && !col.includes('imagem') && !col.includes('link')
          })
          if (textFields.length > 0) {
            titleFieldObj = textFields[0];
            title = formatFieldValue(allValues[textFields[0].db_column_name], textFields[0], relationalOptions) || ''
          } else {
            const firstStringKey = Object.keys(allValues).find(key => {
              const val = allValues[key]
              const k = key.toLowerCase()
              return typeof val === 'string' && val.length > 0 && !k.includes('id') && !k.includes('url') && !k.includes('image') && !k.includes('imagem') && !k.includes('link') && !val.startsWith('http') && !val.startsWith('data:')
            })
            if (firstStringKey) {
              titleFieldObj = fields.find(f => f.db_column_name === firstStringKey);
              title = titleFieldObj ? formatFieldValue(allValues[firstStringKey], titleFieldObj, relationalOptions) : String(allValues[firstStringKey] || '')
            } else {
              title = `Asset #${row.id || ''}`
            }
          }
        }
      }

      // 2. Identificar imagem de preview / url principal
      let previewUrl = ''
      const imageField = fields.find(f => {
        if (galleryConfig?.image_field) return f.db_column_name === galleryConfig.image_field || f.id === galleryConfig.image_field
        const col = f.db_column_name.toLowerCase()
        return col.includes('image') || col.includes('imagem') || col.includes('avatar') || col.includes('thumbnail') || col.includes('thumb') || col.includes('foto') || col.includes('capa') || col.includes('preview')
      })
      if (imageField && allValues[imageField.db_column_name]) {
        previewUrl = formatBase64(String(allValues[imageField.db_column_name]))
      } else if (galleryConfig?.image_field && getNestedValue(allValues, galleryConfig.image_field)) {
        previewUrl = formatBase64(String(getNestedValue(allValues, galleryConfig.image_field)))
      } else {
        const imageKey = Object.keys(allValues).find(key => {
          const col = key.toLowerCase()
          return col.includes('image') || col.includes('imagem') || col.includes('avatar') || col.includes('thumbnail') || col.includes('thumb') || col.includes('foto') || col.includes('capa') || col.includes('preview')
        })
        if (imageKey && allValues[imageKey]) {
          previewUrl = formatBase64(String(allValues[imageKey]))
        } else {
          // Varredura por conteúdo (base64 ou URL de imagem)
          for (const key of Object.keys(allValues)) {
            const val = String(allValues[key] || '')
            if (val.startsWith('data:image/') || val.startsWith('iVBORw0KGgo') || val.startsWith('/9j/') || val.startsWith('R0lGOD') || val.startsWith('UklGR') || (val.startsWith('http') && (
              val.includes('.jpg') || val.includes('.jpeg') || val.includes('.png') || 
              val.includes('.gif') || val.includes('.webp') || val.includes('.svg') || 
              val.includes('images.unsplash.com') || val.includes('picsum.photos') || val.includes('avatar')
            ))) {
              previewUrl = formatBase64(val)
              break
            }
          }
        }
      }

      // 3. Identificar link de redirecionamento externo
      let externalUrl = ''
      const linkField = fields.find(f => {
        const col = f.db_column_name.toLowerCase()
        return (col.includes('link') || col.includes('url') || col.includes('website') || col.includes('redirect') || col.includes('external') || col.includes('site')) && !col.includes('image') && !col.includes('imagem') && !col.includes('avatar') && !col.includes('thumbnail') && !col.includes('thumb') && !col.includes('foto')
      })
      if (linkField && allValues[linkField.db_column_name]) {
        externalUrl = String(allValues[linkField.db_column_name])
      } else {
        const linkKey = Object.keys(allValues).find(key => {
          const col = key.toLowerCase()
          return (col.includes('link') || col.includes('url') || col.includes('website') || col.includes('redirect') || col.includes('external') || col.includes('site')) && !col.includes('image') && !col.includes('imagem') && !col.includes('avatar') && !col.includes('thumbnail') && !col.includes('thumb') && !col.includes('foto')
        })
        if (linkKey && allValues[linkKey]) {
          externalUrl = String(allValues[linkKey])
        } else {
          for (const key of Object.keys(allValues)) {
            const val = String(allValues[key] || '')
            if (val.startsWith('http') && val !== previewUrl && !val.includes('.jpg') && !val.includes('.png') && !val.includes('.jpeg') && !val.includes('.webp') && !val.includes('.gif')) {
              externalUrl = val
              break
            }
          }
        }
      }

      // 4. Identificar URL de download
      let downloadUrl = ''
      const downloadField = fields.find(f => {
        const col = f.db_column_name.toLowerCase()
        return col.includes('download') || col.includes('file') || col.includes('arquivo') || col.includes('pdf') || col.includes('anexo') || col.includes('attachment') || col.includes('doc')
      })
      if (downloadField && allValues[downloadField.db_column_name]) {
        downloadUrl = String(allValues[downloadField.db_column_name])
      } else {
        const downloadKey = Object.keys(allValues).find(key => {
          const col = key.toLowerCase()
          return col.includes('download') || col.includes('file') || col.includes('arquivo') || col.includes('pdf') || col.includes('anexo') || col.includes('attachment') || col.includes('doc')
        })
        if (downloadKey && allValues[downloadKey]) {
          downloadUrl = String(allValues[downloadKey])
        } else {
          for (const key of Object.keys(allValues)) {
            const val = String(allValues[key] || '')
            if (val.startsWith('http') || val.startsWith('data:application/')) {
              const lowerVal = val.toLowerCase()
              if (lowerVal.includes('.pdf') || lowerVal.includes('.zip') || lowerVal.includes('.rar') || lowerVal.includes('.xls') || lowerVal.includes('.xlsx') || lowerVal.includes('.csv') || lowerVal.includes('.doc') || lowerVal.includes('.docx') || lowerVal.includes('.txt')) {
                downloadUrl = val
                break
              }
            }
          }
        }
      }

      // Se detectou previewUrl que aponta para um PDF/arquivo e não tem downloadUrl, copia
      if (previewUrl && !previewUrl.startsWith('data:image/') && !downloadUrl) {
        const lowerPrev = previewUrl.toLowerCase()
        if (lowerPrev.includes('.pdf') || lowerPrev.includes('.zip') || lowerPrev.includes('.rar') || lowerPrev.includes('.xlsx') || lowerPrev.includes('.xls') || lowerPrev.includes('.csv') || lowerPrev.includes('.docx') || lowerPrev.includes('.doc') || lowerPrev.includes('.txt')) {
          downloadUrl = previewUrl
        }
      }

      // 5. Identificar nome do arquivo
      let fileName = ''
      const fileNameField = fields.find(f => {
        const col = f.db_column_name.toLowerCase()
        return col.includes('file_name') || col.includes('filename') || col.includes('nome_arquivo')
      })
      if (fileNameField) {
        fileName = String(allValues[fileNameField.db_column_name] || '')
      } else {
        const fileNameKey = Object.keys(allValues).find(key => {
          const col = key.toLowerCase()
          return col.includes('file_name') || col.includes('filename') || col.includes('nome_arquivo')
        })
        if (fileNameKey) {
          fileName = String(allValues[fileNameKey] || '')
        } else {
          const targetUrlForName = downloadUrl || previewUrl
          if (targetUrlForName && targetUrlForName.startsWith('http')) {
            try {
              const urlObj = new URL(targetUrlForName)
              fileName = urlObj.pathname.split('/').pop() || ''
            } catch {
              fileName = ''
            }
          }
          if (!fileName) {
            fileName = title.toLowerCase().replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_') + (previewUrl && previewUrl.startsWith('data:image/') ? '.jpg' : previewUrl && previewUrl.includes('.pdf') ? '.pdf' : '.dat')
          }
        }
      }

      // 6. Identificar tamanho do arquivo
      let size = 'N/A'
      const sizeField = fields.find(f => {
        const col = f.db_column_name.toLowerCase()
        return col.includes('size') || col.includes('tamanho') || col.includes('kb') || col.includes('mb') || col.includes('bytes')
      })
      const rawSize = sizeField ? allValues[sizeField.db_column_name] : Object.keys(allValues).map(k => k.toLowerCase().includes('size') || k.toLowerCase().includes('tamanho') ? allValues[k] : null).find(v => v !== null)
      
      if (typeof rawSize === 'number') {
        if (rawSize > 1024 * 1024) {
          size = `${(rawSize / (1024 * 1024)).toFixed(1)} MB`
        } else if (rawSize > 1024) {
          size = `${(rawSize / 1024).toFixed(0)} KB`
        } else {
          size = `${rawSize} B`
        }
      } else if (rawSize) {
        size = String(rawSize)
      }

      // 7. Identificar tipo/formato do arquivo
      let fileType: 'image' | 'pdf' | 'spreadsheet' | 'archive' | 'code' | 'document' | 'other' = 'other'
      let format = 'unknown'
      const typeField = fields.find(f => {
        const col = f.db_column_name.toLowerCase()
        return col === 'type' || col === 'tipo' || col === 'format' || col === 'ext' || col === 'extension' || col === 'mime'
      })
      const typeValue = typeField ? String(allValues[typeField.db_column_name] || '').toLowerCase() : ''
      
      // Tentamos deduzir pela URL de download ou de preview
      const targetUrlForType = downloadUrl || previewUrl
      let extFromUrl = ''
      if (targetUrlForType && (targetUrlForType.startsWith('http') || targetUrlForType.startsWith('data:'))) {
        if (targetUrlForType.startsWith('data:')) {
          const match = targetUrlForType.match(/^data:([^;]+);/)
          if (match) {
            const mime = match[1].toLowerCase()
            if (mime.startsWith('image/')) {
              fileType = 'image'
              format = mime.split('/')[1]
            } else if (mime === 'application/pdf') {
              fileType = 'pdf'
              format = 'pdf'
            } else if (mime === 'text/plain') {
              fileType = 'document'
              format = 'txt'
            } else if (mime === 'text/csv' || mime.includes('spreadsheet') || mime.includes('excel')) {
              fileType = 'spreadsheet'
              format = 'csv'
            } else if (mime.includes('zip') || mime.includes('compressed')) {
              fileType = 'archive'
              format = 'zip'
            }
          }
        } else {
          try {
            const pathname = new URL(targetUrlForType).pathname
            extFromUrl = pathname.split('.').pop()?.toLowerCase() || ''
          } catch {
            const lastPart = targetUrlForType.split('?')[0].split('/').pop() || ''
            if (lastPart.includes('.')) {
              extFromUrl = lastPart.split('.').pop()?.toLowerCase() || ''
            }
          }
        }
      }

      const finalTypeInfo = typeValue || extFromUrl || fileName.split('.').pop()?.toLowerCase() || ''
      
      if (fileType === 'other') {
        if (previewUrl && (previewUrl.startsWith('data:image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extFromUrl) || previewUrl.includes('images.unsplash.com') || previewUrl.includes('picsum.photos'))) {
          fileType = 'image'
          format = extFromUrl || 'image'
        } else if (finalTypeInfo.includes('pdf') || finalTypeInfo === 'pdf') {
          fileType = 'pdf'
          format = 'pdf'
        } else if (finalTypeInfo.includes('sheet') || finalTypeInfo.includes('excel') || ['xlsx', 'xls', 'csv'].includes(finalTypeInfo)) {
          fileType = 'spreadsheet'
          format = finalTypeInfo || 'csv'
        } else if (finalTypeInfo.includes('zip') || finalTypeInfo.includes('rar') || finalTypeInfo.includes('tar') || ['zip', 'rar', 'tar', 'gz'].includes(finalTypeInfo)) {
          fileType = 'archive'
          format = finalTypeInfo || 'zip'
        } else if (finalTypeInfo.includes('code') || finalTypeInfo.includes('json') || ['json', 'js', 'ts', 'html', 'css'].includes(finalTypeInfo)) {
          fileType = 'code'
          format = finalTypeInfo || 'code'
        } else if (finalTypeInfo.includes('text') || finalTypeInfo === 'txt' || ['txt', 'doc', 'docx'].includes(finalTypeInfo)) {
          fileType = 'document'
          format = finalTypeInfo || 'doc'
        } else if (previewUrl) {
          fileType = 'image'
          format = extFromUrl || 'image'
        }
      }

      // Se for imagem mas a url não for válida/setada como imagem
      if (fileType === 'image' && !previewUrl) {
        fileType = 'other'
      }

      // 8. Coletar metadata
      const metadata: Array<{ label: string; value: string }> = []
      fields.forEach(f => {
        const col = f.db_column_name
        
        // Se gallery_card_fields estiver definido, usar apenas os campos selecionados
        if (galleryConfig && Array.isArray(galleryConfig.card_fields) && galleryConfig.card_fields.length > 0) {
          if (galleryConfig.card_fields.includes(col) || galleryConfig.card_fields.includes(f.id)) {
            const val = getNestedValue(row, col)
            if (val !== undefined && val !== null && val !== '') {
              metadata.push({
                label: galleryConfig?.card_fields_labels?.[col] || galleryConfig?.card_fields_labels?.[f.id] || f.display_name,
                value: formatFieldValue(val, f, relationalOptions) || String(val)
              })
            }
          }
        } else {
          // Fallback nativo: mostrar tudo que sobrar
          if (
            col !== titleField?.db_column_name &&
            col !== imageField?.db_column_name &&
            col !== linkField?.db_column_name &&
            col !== downloadField?.db_column_name &&
            col !== fileNameField?.db_column_name &&
            col !== sizeField?.db_column_name &&
            col !== typeField?.db_column_name &&
            col !== 'id'
          ) {
            const lowerCol = col.toLowerCase()
            if (!lowerCol.includes('id') && !lowerCol.includes('image') && !lowerCol.includes('imagem') && !lowerCol.includes('foto') && !lowerCol.includes('file') && !lowerCol.includes('arquivo') && !lowerCol.includes('created') && !lowerCol.includes('updated')) {
              const val = getNestedValue(row, col)
              if (val !== undefined && val !== null && val !== '') {
                metadata.push({
                  label: galleryConfig?.card_fields_labels?.[col] || galleryConfig?.card_fields_labels?.[f.id] || f.display_name,
                  value: formatFieldValue(val, f, relationalOptions) || String(val)
                })
              }
            }
          }
        }
      })

      return {
        id: row.id,
        title,
        fileName,
        url: previewUrl,
        externalUrl,
        downloadUrl,
        size,
        type: fileType,
        format,
        metadata,
        raw: row
      }
    })
  }, [data, fields])

  // Filtragem local baseada na busca e abas de filtro
  const filteredAssets = useMemo(() => {
    return mappedAssets.filter(asset => {
      const matchesSearch = 
        asset.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesTab = 
        activeFilter === 'all' ||
        (activeFilter === 'image' && asset.type === 'image') ||
        (activeFilter === 'document' && asset.type !== 'image')

      return matchesSearch && matchesTab
    })
  }, [mappedAssets, searchQuery, activeFilter])

  const handleDownload = async (asset: any) => {
    const targetUrl = asset.downloadUrl || asset.url
    if (!targetUrl) {
      toast('Nenhum link de download disponível para este arquivo.', 'info')
      return
    }
    
    toast(`Iniciando download de ${asset.fileName}...`, 'success')
    
    if (targetUrl.startsWith('data:')) {
      const a = document.createElement('a')
      a.href = targetUrl
      a.download = asset.fileName || 'download'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } else {
      try {
        const response = await fetch(targetUrl)
        if (!response.ok) throw new Error('Falha na resposta do servidor')
        
        const blob = await response.blob()
        const objectUrl = window.URL.createObjectURL(blob)
        
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = asset.fileName || 'download'
        document.body.appendChild(a)
        a.click()
        
        document.body.removeChild(a)
        window.URL.revokeObjectURL(objectUrl)
      } catch (err) {
        console.warn('Falha no download via fetch (CORS ou erro). Usando fallback window.open:', err)
        window.open(targetUrl, '_blank')
      }
    }
  }

  const handleRedirect = (asset: any) => {
    if (!asset.externalUrl) {
      toast('Nenhum link externo configurado para este registro.', 'info')
      return
    }
    toast(`Redirecionando para ${asset.externalUrl}...`, 'success')
    window.open(asset.externalUrl, '_blank')
  }


  return {
    searchQuery, setSearchQuery,
    activeFilter, setActiveFilter,
    selectedAsset, setSelectedAsset,
    scale, setScale,
    mappedAssets,
    filteredAssets,
    handleDownload,
    handleRedirect
  }
}
