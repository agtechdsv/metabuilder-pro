"use client"

import { getMapTileConfig, getMapTilerExtraLayers, hasCustomTileProvider, isMapTilerProvider, OSM_URL, OSM_ATTRIBUTION } from '@/lib/mapTiles'
import React, { useEffect, useState } from 'react'
import { Eye, Pencil, Trash2, MapPin, Zap } from 'lucide-react'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { cn, getActionColorClasses } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import L from 'leaflet'
import { formatFieldValue } from '@/lib/formatters'

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
  customActions?: any[]
  onCustomAction?: (action: any, record?: any) => void
  relationalOptions?: Record<string, any[]>
}

export default function DynamicMap({ data, fields, mapConfig, onEdit, onDelete, onView, customActions = [], onCustomAction, relationalOptions = {} }: DynamicMapProps) {
  const { t } = useI18n()
  const [isMounted, setIsMounted] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [RL, setRL] = useState<any>(null)
  // Se o provedor configurado falhar repetidas vezes (cota estourada, domínio bloqueado...), cai para o OpenStreetMap
  const [tileErrors, setTileErrors] = useState(0)

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

  const { resolveDynamicFieldDef, extractRawValue } = require('@/lib/field-resolver');

  const latFieldDef = resolveDynamicFieldDef(mapConfig.lat_field, fields);
  const lngFieldDef = resolveDynamicFieldDef(mapConfig.lng_field, fields);
  const titleFieldDef = resolveDynamicFieldDef(mapConfig.title_field, fields);
  const descFieldDef = mapConfig.desc_field ? resolveDynamicFieldDef(mapConfig.desc_field, fields) : null;

  // Extract valid points
  const validPoints = data.filter(record => {
    const lat = extractRawValue(mapConfig.lat_field, record, latFieldDef);
    const lng = extractRawValue(mapConfig.lng_field, record, lngFieldDef);
    return lat !== null && lat !== undefined && lat !== '' && !isNaN(Number(lat)) && 
           lng !== null && lng !== undefined && lng !== '' && !isNaN(Number(lng)) &&
           // coordenadas fora do intervalo real (ex.: lat/lng trocados ou lixo) jogariam o zoom para o mundo todo
           Math.abs(Number(lat)) <= 85 && Math.abs(Number(lng)) <= 180
  }).map(record => {
    const rawTitle = extractRawValue(mapConfig.title_field, record, titleFieldDef);
    const rawDesc = mapConfig.desc_field ? extractRawValue(mapConfig.desc_field, record, descFieldDef) : null;
    return {
      record,
      lat: Number(extractRawValue(mapConfig.lat_field, record, latFieldDef)),
      lng: Number(extractRawValue(mapConfig.lng_field, record, lngFieldDef)),
      title: formatFieldValue(rawTitle, titleFieldDef, relationalOptions) || 'Sem Título',
      desc: mapConfig.desc_field ? formatFieldValue(rawDesc, descFieldDef, relationalOptions) : ''
    }
  })

  const baseTiles = getMapTileConfig()
  const usingFallback = hasCustomTileProvider() && tileErrors >= 5
  const tiles = usingFallback
    ? { standard: { url: OSM_URL, attribution: OSM_ATTRIBUTION }, dark: { url: OSM_URL, attribution: OSM_ATTRIBUTION, invert: true } }
    : baseTiles
  const extraLayers = usingFallback ? [] : getMapTilerExtraLayers()
  const onTileError = () => { if (hasCustomTileProvider()) setTileErrors(n => n + 1) }
  const hiddenPoints = data.length - validPoints.length

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
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
      }
    }, [map])
    return null
  }

  // O mapa nasce dentro de um container que muda de tamanho depois (layout, rascunho, abas): sem recalcular, só parte dos tiles é desenhada
  const MapResizer = () => {
    const map = RL.useMap()
    useEffect(() => {
      const refresh = () => map.invalidateSize()
      const timers = [setTimeout(refresh, 0), setTimeout(refresh, 300), setTimeout(refresh, 1000)]
      const observer = new ResizeObserver(refresh)
      observer.observe(map.getContainer())
      window.addEventListener('resize', refresh)
      return () => {
        timers.forEach(clearTimeout)
        observer.disconnect()
        window.removeEventListener('resize', refresh)
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

  const renderMarker = (point: any, idx: number) => (
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
                    className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors"
                    title={t('runtime.delete', 'Excluir')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {customActions.filter(a => (a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : [a.context]).includes('row')).map(action => {
                    const colors = getActionColorClasses(action.color)
                    return (
                      <button
                        key={action.id}
                        title={action.label}
                        onClick={(e) => { e.stopPropagation(); onCustomAction?.(action, point.record) }}
                        className={cn("p-1.5 rounded-md shadow-sm transition-colors", colors.bg, colors.text, colors.hover)}
                      >
                        {action.icon ? <DynamicIcon icon={action.icon} className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </RL.Popup>
          </RL.Marker>
  )

  // Agrupa pinos próximos (célula de 60px na tela). Clicar no grupo aproxima o zoom; em zoom alto mostra todos os pinos.
  const ClusteredMarkers = () => {
    const map = RL.useMap()
    const [, setTick] = useState(0)
    RL.useMapEvents({ zoomend: () => setTick(t => t + 1) })
    const zoom = map.getZoom()
    if (zoom >= 16) return <>{validPoints.map((p, i) => renderMarker(p, i))}</>

    const groups = new Map<string, { p: any; i: number }[]>()
    validPoints.forEach((p, i) => {
      const pt = map.project([p.lat, p.lng], zoom)
      const key = `${Math.floor(pt.x / 60)}:${Math.floor(pt.y / 60)}`
      const arr = groups.get(key) || []
      arr.push({ p, i })
      groups.set(key, arr)
    })

    return (
      <>
        {Array.from(groups.entries()).map(([key, items]) => {
          if (items.length === 1) return renderMarker(items[0].p, items[0].i)
          const lat = items.reduce((sum, it) => sum + it.p.lat, 0) / items.length
          const lng = items.reduce((sum, it) => sum + it.p.lng, 0) / items.length
          const icon = L.divIcon({
            html: `<div style="width:38px;height:38px;border-radius:9999px;background:#4f46e5;color:#fff;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:800 13px sans-serif">${items.length}</div>`,
            className: '',
            iconSize: [38, 38],
            iconAnchor: [19, 19],
          })
          return (
            <RL.Marker
              key={`cluster-${key}`}
              position={[lat, lng]}
              icon={icon}
              eventHandlers={{
                click: () => map.fitBounds(L.latLngBounds(items.map(it => [it.p.lat, it.p.lng] as [number, number])), { padding: [60, 60], maxZoom: 17 }),
              }}
            />
          )
        })}
      </>
    )
  }

  return (
    <div className="w-full h-[600px] max-h-full rounded-[2rem] overflow-hidden border-4 border-white dark:border-neutral-900 shadow-xl relative z-0">
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[500] flex flex-col items-center gap-1.5 pointer-events-none">
        {usingFallback && (
          <div className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-bold shadow">
            Provedor de mapas indisponível (cota ou domínio): exibindo mapa alternativo do OpenStreetMap
          </div>
        )}
        {hiddenPoints > 0 && (
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold shadow">
            {hiddenPoints} registro(s) sem coordenadas válidas não aparecem no mapa
          </div>
        )}
      </div>
      {isMapTilerProvider() && !usingFallback && (
        <a href="https://www.maptiler.com/" target="_blank" rel="noopener noreferrer" className="absolute bottom-3 left-3 z-[500]" title="MapTiler">
          <img src="https://api.maptiler.com/resources/logo.svg" alt="MapTiler" className="h-6 w-auto" />
        </a>
      )}
      <RL.MapContainer 
        center={center} 
        zoom={5} 
        className="w-full h-full absolute inset-0 z-0"
        scrollWheelZoom={true}
      >
        <RL.LayersControl key={isDarkMode ? 'dark-ctrl' : 'light-ctrl'} position="topright">
          <RL.LayersControl.BaseLayer checked={!isDarkMode} name="Mapa Padrão">
            <RL.TileLayer
              attribution={tiles.standard.attribution}
              url={tiles.standard.url}
              maxZoom={19}
              eventHandlers={{ tileerror: onTileError }}
            />
          </RL.LayersControl.BaseLayer>

          <RL.LayersControl.BaseLayer name="Visualização Satélite">
            <RL.TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </RL.LayersControl.BaseLayer>

          {extraLayers.map(layer => (
            <RL.LayersControl.BaseLayer key={layer.name} name={layer.name}>
              <RL.TileLayer
                attribution={baseTiles.standard.attribution}
                url={layer.url}
                maxZoom={19}
              />
            </RL.LayersControl.BaseLayer>
          ))}

          <RL.LayersControl.BaseLayer checked={isDarkMode} name="Modo Escuro">
            <RL.TileLayer
              attribution={tiles.dark.attribution}
              url={tiles.dark.url}
              className={tiles.dark.invert ? 'metabuilder-dark-tiles' : undefined}
              maxZoom={19}
              eventHandlers={{ tileerror: onTileError }}
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
        <MapResizer />
        <AttributionTargetBlank />

        <ClusteredMarkers />
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
