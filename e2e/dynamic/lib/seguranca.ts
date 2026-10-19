import crypto from 'node:crypto'
import { CONFIG } from './config'
import * as acesso from './acesso.mjs'
import { abrirBanco } from './banco.mjs'
import type { ManifestAuth } from '../../../src/lib/testing/manifestTypes'

/** Ligação dos testes de segurança com o banco de teste (Postgres ou Oracle): usuários, grupos e níveis de acesso temporários (tudo em lib/acesso.mjs). */

type Banco = Awaited<ReturnType<typeof abrirBanco>>

export async function comBanco<T>(fn: (d: Banco) => Promise<T>): Promise<T> {
  const d = await abrirBanco(CONFIG.dbUrl)
  try { return await fn(d) } finally { await d.fechar() }
}

export interface UsuarioTemporario { id: string; email: string; senha: string; grupoId?: string }

/** Sufixo único desta rodada (para os nomes dos usuários e grupos temporários). */
export const unico = () => crypto.randomBytes(4).toString('hex')

/**
 * Cria um usuário temporário (e2e_seg_...) e, se pedido, um grupo temporário (E2E-Perm...) com o nível de acesso dado numa tela.
 * Devolve o que o teste precisa para entrar e para limpar depois.
 */
export async function criarUsuarioTemporario(auth: ManifestAuth, opts: { nivel?: { viewSlug: string; nivel: 'none' | 'read' | 'write' }; grupoSemRestricao?: boolean } = {}): Promise<UsuarioTemporario> {
  const sufixo = unico()
  const email = `e2e_seg_${sufixo}@metabuilder.local`
  const senha = crypto.randomBytes(12).toString('base64url')
  return comBanco(async d => {
    let grupoId: string | undefined
    // com a gestão de acesso ligada, quem não está em nenhum grupo não acessa tela nenhuma: o usuário temporário precisa de um grupo (sem linhas de permissão = telas liberadas)
    if ((opts.nivel || opts.grupoSemRestricao) && auth.access) {
      grupoId = await acesso.criarGrupo(d, auth, `E2E-Perm-${sufixo}`)
      if (opts.nivel) await acesso.definirNivel(d, auth, grupoId, opts.nivel.viewSlug, opts.nivel.nivel)
    }
    const u = await acesso.upsertUsuario(d, auth, { email, nome: `E2E Seg ${sufixo}`, senha })
    if (grupoId) await acesso.colocarNoGrupo(d, auth, u.id, grupoId)
    return { id: u.id, email, senha, grupoId }
  })
}

/** Apaga o usuário e o grupo temporários (e o que pendura neles). */
export async function removerUsuarioTemporario(auth: ManifestAuth, u: UsuarioTemporario) {
  await comBanco(async d => {
    await acesso.apagarUsuario(d, auth, u.id).catch(() => {})
    if (u.grupoId) await acesso.apagarGrupo(d, auth, u.grupoId).catch(() => {})
  })
}

/** Valor do usuário que a regra por linha compara. */
export async function valorDaRegra(auth: ManifestAuth, userId: string, source: string, attr?: string): Promise<string | null> {
  return comBanco(d => acesso.valorDoUsuario(d, auth, userId, source, attr))
}

export async function limparSegurancaDoBanco(auth: ManifestAuth | undefined) {
  if (!auth || auth.type !== 'database') return
  await comBanco(d => acesso.limparSeguranca(d, auth))
}
