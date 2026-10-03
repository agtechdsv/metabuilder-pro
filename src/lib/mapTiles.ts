/**
 * Configuração dos tiles dos mapas (Visão de Mapa). Troque de provedor só pelas variáveis de ambiente:
 *
 *   NEXT_PUBLIC_MAP_TILE_URL          URL dos tiles do mapa padrão (ex.: https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=SUA_CHAVE)
 *   NEXT_PUBLIC_MAP_TILE_URL_DARK     (opcional) URL dos tiles do modo escuro; sem ela, o mapa padrão é usado com as cores invertidas
 *   NEXT_PUBLIC_MAP_TILE_ATTRIBUTION  (opcional) texto/HTML de atribuição exigido pelo provedor
 *
 * Sem nenhuma variável, usa o OpenStreetMap (adequado só para demo / pouco tráfego).
 * As variáveis NEXT_PUBLIC_* precisam ser lidas literalmente (process.env.NEXT_PUBLIC_X) para o Next embuti-las no cliente.
 */
export const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export function getMapTileConfig() {
  const url = process.env.NEXT_PUBLIC_MAP_TILE_URL || OSM_URL
  const darkUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL_DARK || ''
  const attribution = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
    || (process.env.NEXT_PUBLIC_MAP_TILE_URL ? '' : OSM_ATTRIBUTION)

  return {
    standard: { url, attribution },
    // com URL própria para o escuro não precisa inverter; senão inverte as cores do mapa padrão
    dark: darkUrl
      ? { url: darkUrl, attribution, invert: false }
      : { url, attribution, invert: true },
  }
}

/** true quando o provedor configurado não é o OpenStreetMap padrão (então faz sentido ter fallback para ele) */
export function hasCustomTileProvider() {
  return Boolean(process.env.NEXT_PUBLIC_MAP_TILE_URL)
}

/** true quando o provedor configurado é o MapTiler (exige o logo no mapa) */
export function isMapTilerProvider() {
  return (process.env.NEXT_PUBLIC_MAP_TILE_URL || '').includes('api.maptiler.com')
}

/**
 * Camadas extras do MapTiler, derivadas da mesma URL/chave configurada em NEXT_PUBLIC_MAP_TILE_URL.
 * Se o id de algum mapa não existir na conta, só aquela camada fica em branco.
 */
export function getMapTilerExtraLayers(): { name: string; url: string }[] {
  const url = process.env.NEXT_PUBLIC_MAP_TILE_URL || ''
  const m = url.match(/^(https:\/\/api\.maptiler\.com\/maps\/)[^/]+\/\{z\}\/\{x\}\/\{y\}(?:@2x)?\.(?:png|jpg|webp)(\?.*)?$/)
  if (!m) return []
  const base = m[1]
  const query = m[2] || ''
  return [
    { name: 'Satélite Híbrido (MapTiler)', url: `${base}hybrid/{z}/{x}/{y}.jpg${query}` },
    { name: 'Dataviz (MapTiler)', url: `${base}dataviz/{z}/{x}/{y}.png${query}` },
    { name: 'Outdoor (MapTiler)', url: `${base}outdoor-v2/{z}/{x}/{y}.png${query}` },
  ]
}
