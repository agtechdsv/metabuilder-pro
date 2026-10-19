import fs from 'node:fs'
import path from 'node:path'
import { contagemOriginal, limparTeste } from './guard'

const baseline = path.join(import.meta.dirname, '..', 'test-results', 'oracle-baseline.json')

export default async function globalTeardown() {
  await limparTeste()
  if (!fs.existsSync(baseline)) return
  const antes = JSON.parse(fs.readFileSync(baseline, 'utf8')) as Record<string, number>
  const depois = await contagemOriginal()
  const difs = Object.keys(antes).filter(t => antes[t] !== depois[t]).map(t => `${t}: ${antes[t]} -> ${depois[t]}`)
  if (difs.length > 0) {
    throw new Error('ATENÇÃO: a quantidade de linhas que NÃO são do teste mudou durante a rodada (' + difs.join('; ') + '). Confira o banco antes de rodar de novo.')
  }
  console.log('\nBanco Oracle intacto: as linhas que não são do teste continuam as mesmas (' + Object.entries(depois).map(([t, n]) => `${t} ${n}`).join(', ') + ').')
}
