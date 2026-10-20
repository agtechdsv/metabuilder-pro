import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cleanScript, confirmMessage, isSafeToClean, parsePlan, planScript, PRESERVADOS } from '../cleanExportFolder'

const HOME = 'C:\\Users\\Alexandre'

describe('limpar a pasta antes de exportar: travas', () => {
  it('aceita a pasta de um app dentro de pastas comuns, mas nunca a pasta comum em si', () => {
    expect(isSafeToClean('C:\\Users\\Alexandre\\Downloads\\Vendas_PG_Node', HOME)).toBe(true)
    expect(isSafeToClean('C:/Users/Alexandre/Downloads/Vendas_PG_Node/', HOME)).toBe(true)
    expect(isSafeToClean('C:\\AgTech\\Apps\\meu-app', HOME)).toBe(true)
    expect(isSafeToClean('C:\\Users\\Alexandre\\Downloads', HOME)).toBe(false)
    expect(isSafeToClean('C:\\Users\\Alexandre\\Documents', HOME)).toBe(false)
    expect(isSafeToClean('C:\\Users\\Alexandre\\Desktop', HOME)).toBe(false)
    expect(isSafeToClean('C:\\Users\\Alexandre', HOME)).toBe(false)
  })

  it('recusa raiz de disco, pastas rasas, a pasta acima do usuário e caminho vazio', () => {
    for (const p of ['C:\\', 'C:', 'D:/', 'C:\\Users', 'C:\\Projetos', '', '   ']) expect(isSafeToClean(p, HOME), p).toBe(false)
  })

  it('o que nunca é apagado inclui dependências, histórico do Git e caches de compilação', () => {
    expect([...PRESERVADOS]).toEqual(['node_modules', '.git', '.next', 'target'])
  })

  it('a confirmação diz quantos arquivos, onde, quais pastas e o que fica', () => {
    const msg = confirmMessage('C:\\x\\app', { existe: true, exportado: true, arquivos: 7, entradas: ['app', 'lib'] }, 'Apagar {count} arquivo(s) em {dir}: {entries}. Fica: {kept}.')
    expect(msg).toBe('Apagar 7 arquivo(s) em C:\\x\\app: app, lib. Fica: node_modules, .git, .next, target.')
  })

  it('o plano que o PowerShell devolve é lido (e ignora ruído antes do JSON)', () => {
    expect(parsePlan('aviso qualquer\n{"existe":true,"exportado":true,"arquivos":3,"entradas":["app"]}\n')).toEqual({ existe: true, exportado: true, arquivos: 3, entradas: ['app'] })
    expect(parsePlan('sem json')).toBeNull()
  })
})

// roda os scripts de verdade no PowerShell, numa pasta temporária (só no Windows)
describe.skipIf(process.platform !== 'win32')('limpar a pasta antes de exportar: scripts no PowerShell', () => {
  const ps = (script: string) => spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' })
  const grava = (raiz: string, rel: string) => { const f = join(raiz, rel); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, 'x') }

  function montar() {
    const raiz = mkdtempSync(join(tmpdir(), 'mb-limpar-'))
    for (const rel of [
      'package.json', 'app/page.tsx', 'app/velha/tela.ts', 'lib/a.ts',
      'node_modules/x/y.js', '.git/HEAD', '.next/cache/z', 'frontend/node_modules/m.js', 'frontend/app/a.ts',
      'backend/pom.xml', 'backend/src/A.java', 'backend/target/b.jar',
    ]) grava(raiz, rel)
    return raiz
  }

  it('descreve o que seria apagado sem apagar nada, e reconhece um app exportado', () => {
    const raiz = montar()
    try {
      const plano = parsePlan(ps(planScript(raiz)).stdout)!
      expect(plano.existe && plano.exportado).toBe(true)
      expect(plano.arquivos).toBe(7) // package.json, app/page.tsx, app/velha/tela.ts, lib/a.ts, frontend/app/a.ts, backend/pom.xml, backend/src/A.java
      expect(plano.entradas).toEqual(['app', 'backend', 'frontend', 'lib', 'package.json'])
      expect(existsSync(join(raiz, 'app/page.tsx'))).toBe(true)
    } finally { rmSync(raiz, { recursive: true, force: true }) }
  })

  it('apaga o resto, mantém node_modules, .git, .next e target e remove as pastas que ficaram vazias', () => {
    const raiz = montar()
    try {
      const r = ps(cleanScript(raiz))
      expect(r.stdout).toContain('ok')
      for (const rel of ['package.json', 'app', 'lib', 'backend/pom.xml', 'backend/src', 'frontend/app']) expect(existsSync(join(raiz, rel)), `${rel} some`).toBe(false)
      for (const rel of ['node_modules/x/y.js', '.git/HEAD', '.next/cache/z', 'frontend/node_modules/m.js', 'backend/target/b.jar']) expect(existsSync(join(raiz, rel)), `${rel} fica`).toBe(true)
      expect(readdirSync(raiz).sort()).toEqual(['.git', '.next', 'backend', 'frontend', 'node_modules'])
    } finally { rmSync(raiz, { recursive: true, force: true }) }
  })

  it('uma pasta que não existe não quebra o plano', () => {
    const plano = parsePlan(ps(planScript(join(tmpdir(), 'mb-nao-existe-' + Date.now()))).stdout)!
    expect(plano.existe).toBe(false)
  })

  it('pasta sem package.json nem backend/pom.xml não é tida como app exportado', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'mb-outra-'))
    try {
      grava(raiz, 'fotos/ferias.jpg')
      const plano = parsePlan(ps(planScript(raiz)).stdout)!
      expect(plano.exportado).toBe(false)
    } finally { rmSync(raiz, { recursive: true, force: true }) }
  })
})
