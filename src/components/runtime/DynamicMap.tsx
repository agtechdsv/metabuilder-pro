"use client"

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Eye, Pencil, Trash2, MapPin } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import L from 'leaflet'

// Dynamic import for react-leaflet components since they don't support SSR well
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })

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

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null

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
    const { useMap } = require('react-leaflet')
    const map = useMap()
    useEffect(() => {
      if (bounds && validPoints.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    }, [map])
    return null
  }

  return (
    <div className="w-full h-[600px] rounded-[2rem] overflow-hidden border-4 border-white dark:border-neutral-900 shadow-xl relative z-0">
      <MapContainer 
        center={center} 
        zoom={5} 
        className="w-full h-full absolute inset-0 z-0"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        {bounds && validPoints.length > 0 && <BoundsFitter />}

        {validPoints.map((point, idx) => (
          <Marker 
            key={point.record.id || idx} 
            position={[point.lat, point.lng]}
            icon={customIcon}
          >
            <Popup className="metabuilder-popup">
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
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
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
