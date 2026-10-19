import fs from 'node:fs'
import { limparSegurancaDoBanco } from './lib/seguranca'
import { arquivoBase, diferencas, impressaoDigital, limparDiario, limparSobras, type Impressao } from './lib/guard'

/** Depois da rodada: a impressão digital das tabelas tem de ser a mesma do início; senão a rodada falha e avisa. */
export default async function globalTeardown() {
  if (!fs.existsSync(arquivoBase())) return
  const { tabelas, antes, limpeza = [], seguranca, gravaDados } = JSON.parse(fs.readFileSync(arquivoBase(), 'utf8')) as { tabelas: string[]; antes: Impressao; limpeza?: Array<{ tabela: string; coluna: string }>; seguranca?: any; gravaDados?: boolean }
  if (gravaDados) await limparDiario() // registros criados sem marcador e não excluídos
  if (limpeza.length > 0) await limparSobras(limpeza) // o que um teste de integração deixou para trás sai antes da conferência
  if (seguranca) await limparSegurancaDoBanco(seguranca) // e os usuários e grupos temporários dos testes de segurança
  const difs = diferencas(antes, await impressaoDigital(tabelas))
  if (difs.length > 0) {
    throw new Error(`ATENÇÃO: os dados do banco mudaram durante a rodada (${difs.join('; ')}). Confira o banco de teste antes de rodar de novo.`)
  }
  console.log(`\nBanco intacto: ${tabelas.length} tabela(s) dos casos de uso continuam exatamente como estavam (quantidade e conteúdo conferidos).`)
}
