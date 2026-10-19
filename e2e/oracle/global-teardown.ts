import fs from 'node:fs'
import path from 'node:path'
import { contagemOriginal, limparTeste } from './guard'

const baseline = path.join(import.meta.dirname, '..', 'test-results', 'oracle-baseline.json')

export default async function globalTeardown() {
  await limparTeste()
  if (!fs.existsSync(baseline)) return
  const antes = JSON.parse(fs.readFileSync(baseline, 'utf8')) as Record<string, number | string>
  const depois = await contagemOriginal()
  const difs = Object.keys(antes).filter(t => antes[t] !== depois[t]).map(t => t.startsWith('fp_') ? `${t.slice(3)}: linhas reais foram ALTERADAS ou religadas` : `${t}: ${antes[t]} -> ${depois[t]}`)
  if (difs.length > 0) {
    throw new Error('ATENÇÃO: as linhas que NÃO são do teste mudaram durante a rodada (quantidade ou ligações) (' + difs.join('; ') + '). Confira o banco antes de rodar de novo.')
  }
  console.log('\nBanco Oracle intacto: as linhas que não são do teste continuam as mesmas (' + Object.entries(depois).filter(([t]) => !t.startsWith('fp_')).map(([t, n]) => `${t} ${n}`).join(', ') + '; ligações das linhas reais conferidas).')
}
