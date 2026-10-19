import fs from 'node:fs'
import path from 'node:path'
import { limparSegurancaDoBanco } from './lib/seguranca'
import { alvosDeLimpeza, arquivoBase, assertSeguro, impressaoDigital, limparSobras, tabelasDoManifesto } from './lib/guard'
import type { TestManifest } from '../../src/lib/testing/manifestTypes'

/** Antes da rodada: confere que o banco é o de teste e guarda a impressão digital das tabelas dos casos de uso. */
export default async function globalSetup() {
  assertSeguro()
  const manifesto = process.env.E2E_MANIFEST || path.join(import.meta.dirname, 'manifests', 'vendas-pg.sample.json')
  const m = JSON.parse(fs.readFileSync(manifesto, 'utf8')) as TestManifest
  const tabelas = tabelasDoManifesto(m)
  // teste de integração: sobras de uma rodada anterior interrompida saem antes de guardar a impressão digital (a rodada começa limpa)
  const tipos = (process.env.E2E_TYPES || '').split(',')
  const gravaDados = tipos.includes('integracao') || tipos.includes('seguranca')
  const limpeza = gravaDados ? alvosDeLimpeza(m) : []
  if (limpeza.length > 0) await limparSobras(limpeza)
  const seguranca = tipos.includes('seguranca') ? m.auth ?? null : null
  if (seguranca) await limparSegurancaDoBanco(seguranca) // usuários e grupos temporários de uma rodada interrompida
  fs.mkdirSync(path.dirname(arquivoBase()), { recursive: true })
  fs.writeFileSync(arquivoBase(), JSON.stringify({ tabelas, limpeza, seguranca, antes: await impressaoDigital(tabelas) }))
}
