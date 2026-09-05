export function generateMapBoardComponent(files: Map<string, string>) {
  files.set('components/MapBoard.tsx', generateMapBoardCode())
}

function generateMapBoardCode(): string {
  return `'use client'

import React, { useEffect, useState, useMemo } from 'react'
import {
  Eye,
  Pencil,
  Trash2,
  MapPin,
  Search,
  Zap,
  Navigation,
  Layers,
  Map as MapIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DynamicIcon } from '@/app/components/DynamicIcon'

export interface MapConfig {
  lat_field?: string
  latField?: string
  lng_field?: string
  lngField?: string
  title_field?: string
  titleField?: string
  desc_field?: string
  descField?: string
  zoom?: number
}

export interface MapBoardProps {
  data: any[]
  fields?: any[]
  mapConfig?: MapConfig
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => Promise<void> | void
  customActions?: any[]
  onCustomAction?: (action: any, row: any) => void
}

export function MapBoard({
  data = [],
  fields = [],
  mapConfig = {},
  relationalOptions = {},
  onView,
  onEdit,
  onDelete,
  customActions = [],
  onCustomAction,
}: MapBoardProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [activeCenter, setActiveCenter] = useState<[number, number] | null>(null)
  const [activeZoom, setActiveZoom] = useState<number | null>(null)

  // Módulos dinâmicos para evitar SSR error "window is not defined"
  const [RL, setRL] = useState<any>(null)
  const [leafletLib, setLeafletLib] = useState<any>(null)

  useEffect(() => {
    setIsMounted(true)
    const checkDark = document.documentElement.classList.contains('dark')
    setIsDarkMode(checkDark)

    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    // Import dinâmico simultâneo de leaflet e react-leaflet
    Promise.all([
      import('leaflet'),
      import('react-leaflet'),
    ]).then(([L, reactLeaflet]) => {
      setLeafletLib(L.default || L)
      setRL(reactLeaflet)
    }).catch(err => {
      console.error('Erro ao carregar Leaflet / React-Leaflet:', err)
    })

    return () => observer.disconnect()
  }, [])

  const latCol = mapConfig.latField || mapConfig.lat_field || 'latitude'
  const lngCol = mapConfig.lngField || mapConfig.lng_field || 'longitude'
  const titleCol = mapConfig.titleField || mapConfig.title_field || 'nome'
  const descCol = mapConfig.descField || mapConfig.desc_field

  // Extrai marcadores válidos com latitude e longitude numéricas
  const markers = useMemo(() => {
    if (!data || data.length === 0) return []

    return data.map((row, index) => {
      const rawLat = row[latCol] ?? row[latCol.replace(/_/g, '.')] ?? row.lat ?? row.latitude
      const rawLng = row[lngCol] ?? row[lngCol.replace(/_/g, '.')] ?? row.lng ?? row.lon ?? row.longitude

      const lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat || ''))
      const lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng || ''))

      const rawTitle = row[titleCol] ?? row[titleCol.replace(/_/g, '.')] ?? row.nome ?? row.descricao ?? row.title ?? ''
      let title = String(rawTitle || '')
      if (relationalOptions[titleCol]) {
        const found = relationalOptions[titleCol].find((opt: any) => opt.value === String(rawTitle))
        if (found) title = found.label
      }
      if (!title) title = 'Item #' + (row.id ?? index + 1)

      let desc = ''
      if (descCol) {
        const rawDesc = row[descCol] ?? row[descCol.replace(/_/g, '.')]
        desc = String(rawDesc || '')
        if (relationalOptions[descCol]) {
          const found = relationalOptions[descCol].find((opt: any) => opt.value === String(rawDesc))
          if (found) desc = found.label
        }
      }

      const isValid = !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180

      return {
        id: String(row.id ?? index),
        raw: row,
        lat,
        lng,
        title,
        desc,
        isValid,
      }
    })
  }, [data, latCol, lngCol, titleCol, descCol, relationalOptions])

  const validMarkers = useMemo(() => markers.filter(m => m.isValid), [markers])

  const filteredMarkers = useMemo(() => {
    if (!searchTerm.trim()) return markers
    const q = searchTerm.toLowerCase().trim()
    return markers.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.desc.toLowerCase().includes(q) ||
      String(m.lat).includes(q) ||
      String(m.lng).includes(q)
    )
  }, [markers, searchTerm])

  // Centro padrão
  const defaultCenter = useMemo<[number, number]>(() => {
    if (validMarkers.length > 0) {
      const sumLat = validMarkers.reduce((acc, m) => acc + m.lat, 0)
      const sumLng = validMarkers.reduce((acc, m) => acc + m.lng, 0)
      return [sumLat / validMarkers.length, sumLng / validMarkers.length]
    }
    return [-14.235, -51.925] // Ponto central Brasil
  }, [validMarkers])

  const customIcon = useMemo(() => {
    if (!leafletLib) return null
    return new leafletLib.Icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    })
  }, [leafletLib])

  const getActionColorClasses = (color?: string) => {
    const normalized = color?.toLowerCase() || 'indigo'
    switch (normalized) {
      case 'emerald':
        return 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
      case 'amber':
        return 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
      case 'red':
        return 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
      default:
        return 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
    }
  }

  // Componente interno para atualizar a câmera do mapa ao selecionar item
  const ChangeView = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
    const map = RL?.useMap()
    useEffect(() => {
      if (map && center) {
        map.flyTo(center, zoom, { duration: 1.2 })
      }
    }, [map, center, zoom])
    return null
  }

  if (!isMounted || !RL || !leafletLib) {
    return (
      <div className="w-full h-[600px] flex flex-col items-center justify-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
          Carregando motor geoespacial...
        </p>
      </div>
    )
  }

  const { MapContainer, TileLayer, Marker, Popup } = RL

  const currentCenter = activeCenter || defaultCenter
  const currentZoom = activeZoom || mapConfig.zoom || 13

  return (
    <div className="w-full flex flex-col bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
      {/* Folha de estilos oficial do Leaflet para renderização perfeita de blocos */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

      {/* TOOLBAR */}
      <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50/50 dark:bg-neutral-900/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
            <MapIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-neutral-900 dark:text-white">Visão Geoespacial</h3>
            <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-widest">
              {validMarkers.length} de {markers.length} registros com coordenadas mapeadas
            </p>
          </div>
        </div>

        {/* Busca Rápida */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por título, endereço, lat/lng..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-neutral-400"
          />
        </div>
      </div>

      <div className="flex relative w-full h-[650px] overflow-hidden">
        {/* SIDEBAR - LISTA DE REGISTROS */}
        <div className="w-80 flex-shrink-0 border-r border-neutral-200 dark:border-neutral-800 z-10 bg-white dark:bg-[#0a0a0a] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/30 dark:bg-neutral-900/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Registros ({filteredMarkers.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/50">
            {filteredMarkers.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                Nenhum registro encontrado.
              </div>
            ) : (
              filteredMarkers.map(m => {
                const isSelected = selectedRecordId === m.id
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedRecordId(m.id)
                      if (m.isValid) {
                        setActiveCenter([m.lat, m.lng])
                        setActiveZoom(16)
                      }
                    }}
                    className={cn(
                      "p-4 transition-all cursor-pointer group hover:bg-neutral-50 dark:hover:bg-neutral-900/40",
                      isSelected && "bg-indigo-50/50 dark:bg-indigo-950/20 border-l-4 border-indigo-600"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 line-clamp-1">
                        {m.title}
                      </h4>
                      {m.isValid ? (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 text-[9px] font-mono font-bold">
                          GPS OK
                        </span>
                      ) : (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 text-[9px] font-mono font-bold">
                          SEM GPS
                        </span>
                      )}
                    </div>

                    {m.desc && (
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                        {m.desc}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800/40 text-[10px] text-neutral-400 font-mono">
                      <span>
                        {m.isValid ? \`\${m.lat.toFixed(4)}, \${m.lng.toFixed(4)}\` : 'Sem coordenadas'}
                      </span>

                      {/* Botões de Ação na Lista */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        {onView && (
                          <button
                            type="button"
                            onClick={() => onView(m.raw)}
                            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 hover:text-indigo-600 cursor-pointer"
                            title="Visualizar"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(m.raw)}
                            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 hover:text-blue-600 cursor-pointer"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(m.raw)}
                            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 hover:text-red-600 cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* MAP CANVAS LEAFLET */}
        <div className="flex-1 relative z-0">
          <MapContainer
            center={currentCenter}
            zoom={currentZoom}
            scrollWheelZoom={true}
            style={{ width: '100%', height: '100%' }}
          >
            <ChangeView center={currentCenter} zoom={currentZoom} />

            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url={
                isDarkMode
                  ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              }
            />

            {validMarkers.map(m => (
              <Marker
                key={m.id}
                position={[m.lat, m.lng]}
                icon={customIcon || undefined}
              >
                <Popup className="custom-leaflet-popup">
                  <div className="p-2 min-w-[200px] space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                      <h4 className="text-xs font-bold text-neutral-900 leading-tight">
                        {m.title}
                      </h4>
                    </div>

                    {m.desc && (
                      <p className="text-[11px] text-neutral-600 leading-snug">
                        {m.desc}
                      </p>
                    )}

                    <div className="text-[9px] font-mono text-neutral-400 bg-neutral-100 p-1 rounded">
                      Lat: {m.lat.toFixed(5)} | Lng: {m.lng.toFixed(5)}
                    </div>

                    {/* Ações no Popup */}
                    <div className="flex items-center justify-end gap-1 pt-2 border-t border-neutral-100">
                      {onView && (
                        <button
                          type="button"
                          onClick={() => onView(m.raw)}
                          className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Ver</span>
                        </button>
                      )}
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(m.raw)}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Editar</span>
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(m.raw)}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      {customActions.map(action => (
                        <button
                          key={action.id}
                          type="button"
                          title={action.label}
                          onClick={() => onCustomAction?.(action, m.raw)}
                          className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors",
                            getActionColorClasses(action.color)
                          )}
                        >
                          {action.icon ? <DynamicIcon icon={action.icon} size={12} /> : <Zap className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  )
}

export default MapBoard
`
}
