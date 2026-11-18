import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// A página inicial escolhe entre a da IDE e a do site pela classe `is-tauri` no <html>. O script do <head> a posta ao carregar; o roteador
// confere de novo depois (rede de segurança para o caso visto em 18/11/2026: "Entrar novamente" na IDE caiu na página do site).
const src = readFileSync(resolve(__dirname, '../HomeClientRouter.tsx'), 'utf8')

describe('HomeClientRouter: rede de segurança da classe is-tauri', () => {
  it('confere o ambiente do Tauri depois de carregar e tenta de novo por alguns instantes', () => {
    expect(src).toContain("import { isTauri } from '@/utils/tauriUtils'")
    expect(src).toContain("document.documentElement.classList.add('is-tauri')")
    expect(src).toMatch(/\[100, 300, 800, 2000\]/)
    expect(src).toContain('timers.forEach(window.clearTimeout)') // limpa os temporizadores ao desmontar
  })

  it('só marca como IDE quando o Tauri existe (no site comum não muda nada)', () => {
    const mark = src.slice(src.indexOf('const mark'), src.indexOf('if (mark()) return'))
    expect(mark).toContain('if (isTauri())')
    expect(src).not.toMatch(/classList\.remove\('is-tauri'\)/)
  })

  it('o CSS de escolha continua dependendo só da classe', () => {
    expect(src).toContain('.is-tauri .web-only-content { display: none !important; }')
    expect(src).toContain('html:not(.is-tauri) .ide-only-content { display: none !important; }')
  })
})
