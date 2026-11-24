import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  IDE_ZOOM_DEFAULT, IDE_ZOOM_MAX, IDE_ZOOM_MIN, clampZoom, parseStoredZoom, stepZoom, zoomDirFromKey, zoomDirFromWheel, zoomPercent,
} from '../ideZoom'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

describe('zoom da IDE: regras', () => {
  it('a faixa é de 70% a 150%, em passos de 5%', () => {
    expect(IDE_ZOOM_MIN).toBe(0.7)
    expect(IDE_ZOOM_MAX).toBe(1.5)
    expect(stepZoom(1, 1)).toBe(1.05)
    expect(stepZoom(1, -1)).toBe(0.95)
  })

  it('não passa dos limites e não acumula erro de ponto flutuante', () => {
    expect(stepZoom(1.5, 1)).toBe(1.5)
    expect(stepZoom(0.7, -1)).toBe(0.7)
    let z = 1
    for (let i = 0; i < 40; i++) z = stepZoom(z, 1)
    expect(z).toBe(1.5)
    for (let i = 0; i < 40; i++) z = stepZoom(z, -1)
    expect(z).toBe(0.7)
    let w = 1
    for (let i = 0; i < 3; i++) w = stepZoom(w, 1)
    expect(w).toBe(1.15)
    // de 100% a 150% são exatamente 10 passos, e de 100% a 70% são 6
    let up = 1; let n = 0
    while (up < 1.5) { up = stepZoom(up, 1); n++ }
    expect(n).toBe(10)
    let down = 1; let m = 0
    while (down > 0.7) { down = stepZoom(down, -1); m++ }
    expect(m).toBe(6)
  })

  it('o passo 0 volta a 100%', () => {
    expect(stepZoom(1.4, 0)).toBe(IDE_ZOOM_DEFAULT)
    expect(stepZoom(0.7, 0)).toBe(1)
  })

  it('valor guardado inválido ou fora da faixa não passa', () => {
    expect(parseStoredZoom(null)).toBe(1)
    expect(parseStoredZoom('')).toBe(1)
    expect(parseStoredZoom('abc')).toBe(1)
    expect(parseStoredZoom('NaN')).toBe(1)
    expect(parseStoredZoom('9')).toBe(1.5)
    expect(parseStoredZoom('0.1')).toBe(0.7)
    expect(parseStoredZoom('1.2')).toBe(1.2)
    expect(parseStoredZoom('1.23')).toBe(1.25) // valor antigo ou torto encaixa no passo de 5%
    expect(clampZoom(undefined)).toBe(1)
  })

  it('mostra a porcentagem inteira', () => {
    expect(zoomPercent(1)).toBe('100%')
    expect(zoomPercent(1.3)).toBe('130%')
    expect(zoomPercent(0.7)).toBe('70%')
    expect(zoomPercent(1.05)).toBe('105%')
  })

  it('atalhos: Ctrl/Cmd com +, =, -, 0 e o teclado numérico; sem Ctrl ou com Alt não faz nada', () => {
    expect(zoomDirFromKey({ key: '+', ctrlKey: true })).toBe(1)
    expect(zoomDirFromKey({ key: '=', ctrlKey: true })).toBe(1)
    expect(zoomDirFromKey({ key: '-', ctrlKey: true })).toBe(-1)
    expect(zoomDirFromKey({ key: '0', metaKey: true })).toBe(0)
    expect(zoomDirFromKey({ key: 'Add', code: 'NumpadAdd', ctrlKey: true })).toBe(1)
    expect(zoomDirFromKey({ key: 'Subtract', code: 'NumpadSubtract', ctrlKey: true })).toBe(-1)
    expect(zoomDirFromKey({ key: '+' })).toBeNull()
    expect(zoomDirFromKey({ key: '-', ctrlKey: true, altKey: true })).toBeNull()
    expect(zoomDirFromKey({ key: 's', ctrlKey: true })).toBeNull()
  })

  it('Ctrl + roda do mouse: para cima aumenta, para baixo diminui; sem Ctrl não faz nada', () => {
    expect(zoomDirFromWheel({ deltaY: -100, ctrlKey: true })).toBe(1)
    expect(zoomDirFromWheel({ deltaY: 100, ctrlKey: true })).toBe(-1)
    expect(zoomDirFromWheel({ deltaY: 100 })).toBeNull()
    expect(zoomDirFromWheel({ deltaY: 0, ctrlKey: true })).toBeNull()
  })
})

describe('zoom da IDE: ligação', () => {
  it('a permissão do webview está nas capacidades da IDE', () => {
    const cap = JSON.parse(read('src-tauri/capabilities/desktop.json'))
    expect(cap.permissions).toContain('core:webview:allow-set-webview-zoom')
    // a IDE Local e os logs do túnel são janelas próprias: sem estar na lista, o setZoom é recusado em silêncio
    for (const w of ['main', 'ide-local', 'tunnel-logs']) expect(cap.windows, w).toContain(w)
  })

  it('o host e a barra ficam nos Providers, o ícone da lupa no cabeçalho depois do avatar, e tudo só age dentro do Tauri', () => {
    const providers = read('src/components/Providers.tsx')
    expect(providers).toContain('<IdeZoomHost />')
    expect(providers).toContain('<IdeZoomBar />')
    const header = read('src/components/layout/HeaderActions.tsx')
    expect(header).toContain('<IdeZoomToggle />')
    expect(header.indexOf('<UserMenu')).toBeLessThan(header.indexOf('<IdeZoomToggle />'))
    expect(read('src/components/auth/UserMenu.tsx')).not.toContain('IdeZoom')
    expect(read('src/components/tauri/IdeZoomHost.tsx')).toContain('if (!isTauri()) return')
    expect(read('src/components/tauri/IdeZoomToggle.tsx')).toContain('if (!desktop) return null')
    expect(read('src/components/tauri/IdeZoomBar.tsx')).toContain('if (!desktop || !bar.open || !vp.w) return null')
    expect(read('src/utils/ideZoom.ts')).toContain('if (!isTauri()) return z')
    // zoom de verdade do webview, não CSS (o CSS zoom desalinha o mouse em editores)
    expect(read('src/utils/ideZoom.ts')).toContain('getCurrentWebview().setZoom(z)')
  })

  it('a roda do mouse só dá zoom com o evento não passivo (senão o preventDefault é ignorado)', () => {
    expect(read('src/components/tauri/IdeZoomHost.tsx')).toContain("{ passive: false }")
  })

  it('os textos existem nos 3 idiomas', () => {
    for (const l of ['pt', 'en', 'es']) {
      const j = JSON.parse(read(`src/i18n/translations/${l}.json`))
      for (const k of ['label', 'out', 'in', 'reset', 'bar_show', 'bar_hide', 'bar_close', 'drag']) expect(typeof j.ide_zoom?.[k], `${l} ${k}`).toBe('string')
    }
  })
})
