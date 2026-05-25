"use client"

import React, { useEffect, useState } from 'react'
import { Eye, Pencil, Trash2, MapPin } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import L from 'leaflet'

// Custom marker icon to fix default leaflet icon issues in React
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

export interface DynamicMapProps {
  data: any[]
  fields: any[]
  mapConfig: {
    lat_field: string
    lng_field: string
    title_field: string
    desc_field?: string
  }
  onEdit: (record: any) => void
  onDelete: (record: any) => void
  onView: (record: any) => void
}

export default function DynamicMap({ data, fields, mapConfig, onEdit, onDelete, onView }: DynamicMapProps) {
  const { t } = useI18n()
  const [isMounted, setIsMounted] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [RL, setRL] = useState<any>(null)

  useEffect(() => {
    setIsMounted(true)
    
    // Check initial dark mode theme
    const checkDark = document.documentElement.classList.contains('dark')
    setIsDarkMode(checkDark)

    // Observe theme switch dynamically
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    import('react-leaflet').then(module => {
      setRL(module)
    })

    return () => observer.disconnect()
  }, [])

  if (!isMounted || !RL) return null

  // Helper to get real field name
  const getFieldKey = (id: string) => {
    const field = fields?.find(f => f.id === id)
    return field?.db_column_name || id
  }

  const latField = getFieldKey(mapConfig.lat_field)
  const lngField = getFieldKey(mapConfig.lng_field)
  const titleField = getFieldKey(mapConfig.title_field)
  const descField = mapConfig.desc_field ? getFieldKey(mapConfig.desc_field) : null

  // Extract valid points
  const validPoints = data.filter(record => {
    const lat = record[latField]
    const lng = record[lngField]
    return lat !== null && lat !== undefined && !isNaN(Number(lat)) && 
           lng !== null && lng !== undefined && !isNaN(Number(lng))
  }).map(record => {
    return {
      record,
      lat: Number(record[latField]),
      lng: Number(record[lngField]),
      title: record[titleField] || 'Sem Título',
      desc: descField ? record[descField] : ''
    }
  })

  let center: [number, number] = [-23.5505, -46.6333] // Default: São Paulo
  let bounds: L.LatLngBounds | null = null

  if (validPoints.length > 0) {
    const latLngs = validPoints.map(p => L.latLng(p.lat, p.lng))
    bounds = L.latLngBounds(latLngs)
    center = [bounds.getCenter().lat, bounds.getCenter().lng]
  }

  // Component to automatically fit bounds when data changes
  const BoundsFitter = () => {
    const map = RL.useMap()
    useEffect(() => {
      if (bounds && validPoints.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    }, [map])
    return null
  }

  // Component to dynamically set target="_blank" on leaflet attribution links
  const AttributionTargetBlank = () => {
    const map = RL.useMap()
    useEffect(() => {
      const updateLinks = () => {
        const container = map.getContainer()
        const links = container.querySelectorAll('.leaflet-control-attribution a')
        links.forEach((link: any) => {
          link.setAttribute('target', '_blank')
          link.setAttribute('rel', 'noopener noreferrer')
        })
      }
      
      updateLinks()
      
      // Also run when base layers change as it updates the attribution content
      map.on('baselayerchange', () => {
        setTimeout(updateLinks, 100)
      })
    }, [map])
    return null
  }

  return (
    <div className="w-full h-[600px] rounded-[2rem] overflow-hidden border-4 border-white dark:border-neutral-900 shadow-xl relative z-0">
      <RL.MapContainer 
        center={center} 
        zoom={5} 
        className="w-full h-full absolute inset-0 z-0"
        scrollWheelZoom={true}
      >
        <RL.LayersControl key={isDarkMode ? 'dark-ctrl' : 'light-ctrl'} position="topright">
          <RL.LayersControl.BaseLayer checked={!isDarkMode} name="Mapa Padrão">
            <RL.TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
          </RL.LayersControl.BaseLayer>

          <RL.LayersControl.BaseLayer name="Visualização Satélite">
            <RL.TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </RL.LayersControl.BaseLayer>

          <RL.LayersControl.BaseLayer checked={isDarkMode} name="Modo Escuro">
            <RL.TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </RL.LayersControl.BaseLayer>

          {/* Overlays / Camadas de Dados */}
          {validPoints.length > 1 && (
            <RL.LayersControl.Overlay name="Conectar Obras (Rota)">
              <RL.Polyline 
                positions={validPoints.map(p => [p.lat, p.lng])} 
                pathOptions={{ color: '#6366f1', weight: 3, dashArray: '5, 10' }}
              />
            </RL.LayersControl.Overlay>
          )}

          {validPoints.length > 0 && (
            <RL.LayersControl.Overlay name="Raio de Influência (10km)">
              <RL.FeatureGroup>
                {validPoints.map((point, idx) => (
                  <RL.Circle 
                    key={`circle-${point.record.id || idx}`}
                    center={[point.lat, point.lng]}
                    radius={10000} // 10km
                    pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 1.5 }}
                  />
                ))}
              </RL.FeatureGroup>
            </RL.LayersControl.Overlay>
          )}
        </RL.LayersControl>
        
        {bounds && validPoints.length > 0 && <BoundsFitter />}
        <AttributionTargetBlank />

        {validPoints.map((point, idx) => (
          <RL.Marker 
            key={point.record.id || idx} 
            position={[point.lat, point.lng]}
            icon={customIcon}
          >
            <RL.Popup className="metabuilder-popup">
              <div className="flex flex-col gap-2 min-w-[200px]">
                <h3 className="font-bold text-sm text-neutral-900 m-0">{point.title}</h3>
                {point.desc && (
                  <p className="text-xs text-neutral-500 m-0 line-clamp-3">{point.desc}</p>
                )}
                
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-100">
                  <button
                    onClick={() => onView(point.record)}
                    className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-indigo-600 transition-colors"
                    title={t('runtime.view', 'Visualizar')}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEdit(point.record)}
                    className="p-1.5 rounded-md hover:bg-indigo-50 text-indigo-500 transition-colors"
                    title={t('runtime.edit', 'Editar')}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(point.record)}
                    className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors ml-auto"
                    title={t('runtime.delete', 'Excluir')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </RL.Popup>
          </RL.Marker>
        ))}
      </RL.MapContainer>
      
      {validPoints.length === 0 && (
        <div className="absolute inset-0 z-[1000] bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-2">
            <MapPin className="w-8 h-8 text-neutral-400 mx-auto" />
            <h3 className="font-bold text-neutral-900 dark:text-white">Nenhum ponto no mapa</h3>
            <p className="text-sm text-neutral-500 max-w-sm">
              Não encontramos coordenadas válidas (Latitude e Longitude) nos registros para plotar os marcadores no mapa.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
