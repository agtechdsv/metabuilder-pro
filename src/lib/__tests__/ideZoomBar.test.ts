import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_ZOOM_BAR, ZOOM_BAR_SIZE, ZOOM_BAR_STORAGE_KEY, barCssPosition, clamp01, fractionsFromCssPosition, parseZoomBarState,
} from '../ideZoomBar'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const ZOOMS = [0.7, 0.85, 1, 1.15, 1.3, 1.5]

describe('barra flutuante do zoom: tamanho e lugar fixos na tela', () => {
  it('desenhada com o inverso do zoom: ocupa sempre o mesmo tamanho na tela', () => {
    for (const z of ZOOMS) {
      const { scale } = barCssPosition({ fx: 0.5, fy: 0.5 }, 1280 / z, 720 / z, z)
      expect(scale * z).toBeCloseTo(1, 10)
      // tamanho na tela = tamanho em pixels CSS × escala × zoom do webview
      expect(ZOOM_BAR_SIZE.w * scale * z).toBeCloseTo(ZOOM_BAR_SIZE.w, 6)
    }
  })

  it('a mesma fração cai no mesmo lugar da tela em qualquer zoom (os botões não "andam" quando se clica várias vezes)', () => {
    const screenW = 1280; const screenH = 720
    const spots = ZOOMS.map(z => {
      const p = barCssPosition({ fx: 0.98, fy: 0.97 }, screenW / z, screenH / z, z)
      return { x: Math.round(p.left * z), y: Math.round(p.top * z) } // posição na tela, em pixels
    })
    for (const s of spots) expect(s).toEqual(spots[0])
  })

  it('nunca sai da janela, nem nos cantos nem com a janela pequena', () => {
    for (const z of ZOOMS) {
      for (const f of [0, 1]) {
        const vw = 800 / z; const vh = 500 / z
        const p = barCssPosition({ fx: f, fy: f }, vw, vh, z)
        expect(p.left).toBeGreaterThanOrEqual(0)
        expect(p.top).toBeGreaterThanOrEqual(0)
        expect(p.left + (ZOOM_BAR_SIZE.w / z)).toBeLessThanOrEqual(vw + 1e-9)
        expect(p.top + (ZOOM_BAR_SIZE.h / z)).toBeLessThanOrEqual(vh + 1e-9)
      }
    }
    // janela menor que a barra: encosta no canto (0), sem número negativo
    expect(barCssPosition({ fx: 1, fy: 1 }, 100, 20, 1)).toMatchObject({ left: 0, top: 0 })
  })

  it('arrastar e soltar guarda a fração certa (ida e volta) e fora da janela é puxado para dentro', () => {
    for (const z of ZOOMS) {
      const vw = 1280 / z; const vh = 720 / z
      const p = barCssPosition({ fx: 0.3, fy: 0.7 }, vw, vh, z)
      const f = fractionsFromCssPosition(p.left, p.top, vw, vh, z)
      expect(f.fx).toBeCloseTo(0.3, 10)
      expect(f.fy).toBeCloseTo(0.7, 10)
    }
    expect(fractionsFromCssPosition(-500, 9999, 1280, 720, 1)).toEqual({ fx: 0, fy: 1 })
    expect(fractionsFromCssPosition(10, 10, 100, 20, 1)).toEqual({ fx: 0, fy: 0 })
  })

  it('zoom inválido não quebra a conta (vira 100%)', () => {
    expect(barCssPosition({ fx: 0.5, fy: 0.5 }, 1280, 720, 0).scale).toBe(1)
    expect(barCssPosition({ fx: 0.5, fy: 0.5 }, 1280, 720, NaN).scale).toBe(1)
  })
})

describe('barra flutuante do zoom: estado guardado', () => {
  it('começa fechada, no canto inferior direito', () => {
    expect(DEFAULT_ZOOM_BAR.open).toBe(false)
    expect(DEFAULT_ZOOM_BAR.fx).toBeGreaterThan(0.9)
    expect(DEFAULT_ZOOM_BAR.fy).toBeGreaterThan(0.9)
    expect(parseZoomBarState(null)).toEqual(DEFAULT_ZOOM_BAR)
    expect(parseZoomBarState('')).toEqual(DEFAULT_ZOOM_BAR)
  })

  it('lembra se estava aberta e onde estava', () => {
    expect(parseZoomBarState(JSON.stringify({ open: true, fx: 0.2, fy: 0.4 }))).toEqual({ open: true, fx: 0.2, fy: 0.4 })
    expect(parseZoomBarState(JSON.stringify({ open: false, fx: 0, fy: 1 }))).toEqual({ open: false, fx: 0, fy: 1 })
  })

  it('lixo, tipos errados e frações fora de 0 a 1 não passam', () => {
    expect(parseZoomBarState('não é json')).toEqual(DEFAULT_ZOOM_BAR)
    expect(parseZoomBarState('null')).toEqual(DEFAULT_ZOOM_BAR)
    expect(parseZoomBarState('42')).toEqual(DEFAULT_ZOOM_BAR)
    expect(parseZoomBarState(JSON.stringify({ open: 'sim', fx: 'x', fy: null }))).toEqual({ ...DEFAULT_ZOOM_BAR, open: false })
    expect(parseZoomBarState(JSON.stringify({ open: true, fx: 7, fy: -3 }))).toEqual({ open: true, fx: 1, fy: 0 })
    expect(clamp01(NaN)).toBe(0)
  })
})

describe('barra flutuante do zoom: ligação', () => {
  it('o ícone alterna a barra, a barra arrasta pela alça e guarda só ao soltar', () => {
    const toggle = read('src/components/tauri/IdeZoomToggle.tsx')
    expect(toggle).toContain('toggleZoomBar()')
    expect(toggle).toContain('aria-pressed={open}')
    const bar = read('src/components/tauri/IdeZoomBar.tsx')
    expect(bar).toContain('setPointerCapture')
    expect(bar).toContain('onPointerUp={onUp}')
    // enquanto arrasta só muda o estado local; guardar é ao soltar
    const move = bar.slice(bar.indexOf('const onMove'), bar.indexOf('const onUp'))
    expect(move).not.toContain('setZoomBar')
    expect(bar.slice(bar.indexOf('const onUp'))).toContain('setZoomBar({ fx: latest.current.fx, fy: latest.current.fy })')
    // tamanho fixo na tela: escala inversa do zoom, ancorada no canto
    expect(bar).toContain('transform: `scale(${pos.scale})`')
    expect(bar).toContain("transformOrigin: 'top left'")
    expect(read('src/utils/ideZoomBar.ts')).toContain('ZOOM_BAR_STORAGE_KEY') // guarda e lê pela mesma chave
    expect(ZOOM_BAR_STORAGE_KEY).toBe('mb_ide_zoom_bar')
  })

  it('o ícone e a barra também têm de aparecer só na IDE', () => {
    expect(read('src/components/tauri/IdeZoomBar.tsx')).toContain('if (!isTauri()) return')
    expect(read('src/components/tauri/IdeZoomToggle.tsx')).toContain('if (!isTauri()) return')
  })
})
