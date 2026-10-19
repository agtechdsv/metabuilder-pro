import fs from 'node:fs'
import { arquivoBase, diferencas, impressaoDigital, limparSobras, type Impressao } from './lib/guard'

/** Depois da rodada: a impressão digital das tabelas tem de ser a mesma do início; senão a rodada falha e avisa. */
export default async function globalTeardown() {
  if (!fs.existsSync(arquivoBase())) return
  const { tabelas, antes, limpeza = [] } = JSON.parse(fs.readFileSync(arquivoBase(), 'utf8')) as { tabelas: string[]; antes: Impressao; limpeza?: Array<{ tabela: string; coluna: string }> }
  if (limpeza.length > 0) await limparSobras(limpeza) // o que um teste de integração deixou para trás sai antes da conferência
  const difs = diferencas(antes, await impressaoDigital(tabelas))
  if (difs.length > 0) {
    throw new Error(`ATENÇÃO: os dados do banco mudaram durante a rodada (${difs.join('; ')}). Confira o banco de teste antes de rodar de novo.`)
  }
  console.log(`\nBanco intacto: ${tabelas.length} tabela(s) dos casos de uso continuam exatamente como estavam (quantidade e conteúdo conferidos).`)
}
