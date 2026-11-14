import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

/**
 * Os arquivos únicos das Edge Functions (para colar no painel do Supabase) juntam vários módulos de _shared num só arquivo. Dois módulos com o mesmo
 * nome no topo (ex.: `const num`) derrubam a função na partida (BOOT_ERROR) e o webhook do Asaas para de funcionar. Este teste gera os arquivos e
 * COMPILA cada um, para isso nunca mais chegar à produção.
 */
describe('Edge Functions em arquivo único (colar no painel)', () => {
  const root = process.cwd()
  const outDir = path.join(root, 'supabase', 'functions-dashboard')

  it('o gerador roda sem apontar nomes repetidos e cada arquivo compila', () => {
    execFileSync(process.execPath, [path.join(root, 'scripts', 'bundle-edge-functions.mjs')], { cwd: root, stdio: 'pipe' })
    const names = readdirSync(outDir).filter(n => existsSync(path.join(outDir, n, 'index.ts')))
    expect(names.sort()).toEqual(['asaas-cancel', 'asaas-checkout', 'asaas-update-subscription', 'asaas-webhook', 'iclub-release', 'partner-payout', 'partner-transfer-validation'])
    for (const name of names) {
      const src = readFileSync(path.join(outDir, name, 'index.ts'), 'utf8')
      const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
        .replace(/^import [^\n]*\n/gm, '').replace(/^export\s+/gm, '')
      expect(() => new vm.Script('(async function(){' + js + '\n})'), name).not.toThrow()
    }
  }, 60_000)

  it('o webhook e o cancelamento levam junto o código dos avisos de cobrança (senão chamariam funções que não existem)', () => {
    for (const name of ['asaas-webhook', 'asaas-cancel']) {
      const src = readFileSync(path.join(outDir, name, 'index.ts'), 'utf8')
      expect(src, name).toContain('async function billingSettings')
      expect(src, name).toContain('async function queueNotice')
      expect(src, name).toMatch(/const noticeRef = /)
    }
    // e nenhum nome do módulo de comissões colide com o de preços
    expect(readFileSync('supabase/functions/_shared/partnerCommission.ts', 'utf8')).not.toMatch(/^const num = /m)
  })
})
