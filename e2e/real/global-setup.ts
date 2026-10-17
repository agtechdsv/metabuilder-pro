import fs from 'node:fs'
import path from 'node:path'
import { assertSeguro, contagemOriginal, limparTeste } from './guard'

const baseline = path.join(import.meta.dirname, '..', 'test-results', 'real-baseline.json')

export default async function globalSetup() {
  assertSeguro()
  await limparTeste() // sobras de uma rodada anterior interrompida (só o que tem o prefixo E2E-)
  fs.mkdirSync(path.dirname(baseline), { recursive: true })
  fs.writeFileSync(baseline, JSON.stringify(await contagemOriginal()))
}
