import fs from 'node:fs'
import path from 'node:path'
import { alvosDeLimpeza, arquivoBase, assertSeguro, impressaoDigital, limparSobras, tabelasDoManifesto } from './lib/guard'
import type { TestManifest } from '../../src/lib/testing/manifestTypes'

/** Antes da rodada: confere que o banco é o de teste e guarda a impressão digital das tabelas dos casos de uso. */
export default async function globalSetup() {
  assertSeguro()
  const manifesto = process.env.E2E_MANIFEST || path.join(import.meta.dirname, 'manifests', 'vendas-pg.sample.json')
  const m = JSON.parse(fs.readFileSync(manifesto, 'utf8')) as TestManifest
  const tabelas = tabelasDoManifesto(m)
  // teste de integração: sobras de uma rodada anterior interrompida saem antes de guardar a impressão digital (a rodada começa limpa)
  const integracao = (process.env.E2E_TYPES || '').split(',').includes('integracao')
  const limpeza = integracao ? alvosDeLimpeza(m) : []
  if (limpeza.length > 0) await limparSobras(limpeza)
  fs.mkdirSync(path.dirname(arquivoBase()), { recursive: true })
  fs.writeFileSync(arquivoBase(), JSON.stringify({ tabelas, limpeza, antes: await impressaoDigital(tabelas) }))
}
