/**
 * Escala do painel de BI (botões Pequeno / Normal / Grande / Extra Grande).
 *
 * Antes a escala era só um zoom do CSS: o painel continuava com 3 cards por linha, apenas menores. Agora cada tamanho
 * muda a DENSIDADE: quantos cards cabem por linha (colunas de uma grade de 12), a altura mínima, a altura dos gráficos
 * e o zoom do texto — como na galeria de Produtos (Pequeno = mais cards e mais compactos, para quem quer economizar
 * tela e abrir o card na lupa quando precisar).
 */

export type ScaleKey = 'small' | 'normal' | 'large' | 'xl'
export type WidthKey = 'full' | 'half' | 'third' | 'quarter'

export interface ScalePreset {
  key: ScaleKey
  label: string
  /** zoom do texto e dos espaçamentos */
  zoom: number
  /** colunas (de 12) ocupadas por cada largura de widget */
  spans: Record<WidthKey, number>
  /** altura dos gráficos dentro do card */
  chartHeight: number
}

export const SCALE_PRESETS: ScalePreset[] = [
  { key: 'small', label: 'Pequeno', zoom: 0.9, spans: { full: 6, half: 3, third: 2, quarter: 2 }, chartHeight: 170 },
  { key: 'normal', label: 'Normal', zoom: 1, spans: { full: 12, half: 6, third: 4, quarter: 3 }, chartHeight: 250 },
  { key: 'large', label: 'Grande', zoom: 1.05, spans: { full: 12, half: 12, third: 6, quarter: 4 }, chartHeight: 300 },
  { key: 'xl', label: 'Extra Grande', zoom: 1.2, spans: { full: 12, half: 12, third: 12, quarter: 6 }, chartHeight: 380 },
]

export function presetOf(key: ScaleKey | string | undefined): ScalePreset {
  return SCALE_PRESETS.find(p => p.key === key) || SCALE_PRESETS[1]
}

export function widthKey(width: string | undefined): WidthKey {
  return width === 'full' || width === 'half' || width === 'third' || width === 'quarter' ? width : 'third'
}

/** Colunas (de 12) que o widget ocupa na escala escolhida. */
export function spanFor(width: string | undefined, key: ScaleKey | string | undefined): number {
  return presetOf(key).spans[widthKey(width)]
}

/** Largura "efetiva" do widget na escala (a fonte do KPI acompanha o espaço real que ele tem). */
export function widthOfSpan(span: number): WidthKey {
  if (span >= 12) return 'full'
  if (span >= 6) return 'half'
  if (span >= 4) return 'third'
  return 'quarter'
}
