import fs from 'node:fs'
import path from 'node:path'
import { arquivoBase, assertSeguro, impressaoDigital, tabelasDoManifesto } from './lib/guard'
import type { TestManifest } from '../../src/lib/testing/manifestTypes'

/** Antes da rodada: confere que o banco é o de teste e guarda a impressão digital das tabelas dos casos de uso. */
export default async function globalSetup() {
  assertSeguro()
  const manifesto = process.env.E2E_MANIFEST || path.join(import.meta.dirname, 'manifests', 'vendas-pg.sample.json')
  const m = JSON.parse(fs.readFileSync(manifesto, 'utf8')) as TestManifest
  const tabelas = tabelasDoManifesto(m)
  fs.mkdirSync(path.dirname(arquivoBase()), { recursive: true })
  fs.writeFileSync(arquivoBase(), JSON.stringify({ tabelas, antes: await impressaoDigital(tabelas) }))
}
