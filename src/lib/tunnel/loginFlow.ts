import { randomUUID } from 'node:crypto'
import type { LoginSetup } from './loginSetup'
import { buildSession, type UserRow } from './endUserAuth'
import { MFA_PENDING_TTL, MFA_PROOF_TTL, signToken, verifyToken, type EndUserSession } from './sessionToken'
import { getProjectSecretToken, TunnelTimeoutError } from './server'
import { isRowActive } from './sessionLiveness'

/**
 * Passos do login do usuário final no servidor (sem Next, para poder testar).
 *
 *  1. performLogin: confere a senha PELO TÚNEL, vendo a resposta do Agente CLI. Se o projeto exige MFA/biometria,
 *     devolve um token "pendente" (5 min) em vez da sessão.
 *  2. O MFA/biometria é verificado pelas rotas de segurança, que devolvem uma "prova" (2 min) ao acertar.
 *  3. completeLogin: com o token pendente + a prova do MESMO usuário, emite a sessão.
 */

export interface LoginDeps {
  loadSetup(projectId: string): Promise<LoginSetup | null>
  /** envia o comando ao Agente CLI e devolve a resposta */
  call(projectId: string, payload: Record<string, any>): Promise<any>
  secretToken?(projectId: string): Promise<string | null>
  newId?(): string
}

export type LoginResult =
  | { kind: 'ok'; user: UserRow; session: EndUserSession; /** o projeto oferece cadastrar biometria (opcional): a tela mostra o convite depois do login */ offerPasskey?: boolean }
  | { kind: 'mfa'; user: UserRow; pendingToken: string }
  | { kind: 'error'; status: number; code: 'bad_request' | 'no_auth' | 'inactive' | 'tunnel_offline' | 'tunnel_error' | 'invalid_credentials'; message?: string }

const MAX_FIELD = 256

export async function performLogin(deps: LoginDeps, input: { projectId: string; email: unknown; password: unknown }): Promise<LoginResult> {
  const { projectId } = input
  if (typeof input.email !== 'string' || typeof input.password !== 'string' || !input.email || !input.password ||
      input.email.length > MAX_FIELD || input.password.length > MAX_FIELD) {
    return { kind: 'error', status: 400, code: 'bad_request' }
  }

  const setup = await deps.loadSetup(projectId)
  if (!setup) return { kind: 'error', status: 404, code: 'bad_request' }
  if (setup.project.is_active === false) return { kind: 'error', status: 403, code: 'inactive' }
  if (!setup.auth.auth_type || setup.auth.auth_type === 'none') return { kind: 'error', status: 400, code: 'no_auth' }

  const token = await (deps.secretToken ?? getProjectSecretToken)(projectId)
  if (!token) return { kind: 'error', status: 502, code: 'tunnel_error' }

  let res: any
  try {
    res = await deps.call(projectId, {
      queryId: (deps.newId ?? randomUUID)(),
      token,
      projectId,
      action: 'validate_login',
      schemaName: setup.schemaName,
      // a configuração vem do cadastro do projeto, nunca do navegador
      config: setup.auth,
      credentials: { email: input.email, password: input.password },
    })
  } catch (e) {
    return { kind: 'error', status: 504, code: e instanceof TunnelTimeoutError ? 'tunnel_offline' : 'tunnel_error' }
  }

  const user: UserRow | undefined = res?.success && Array.isArray(res.data) ? res.data[0] : undefined
  if (!user || typeof user !== 'object') {
    return { kind: 'error', status: 401, code: 'invalid_credentials', message: typeof res?.error === 'string' ? res.error.slice(0, 200) : undefined }
  }
  // usuário marcado como inativo no banco (coluna ativo/active...) não entra, mesmo com a senha certa
  if (!isRowActive(user)) return { kind: 'error', status: 401, code: 'invalid_credentials' }
  if (setup.auth.db_display_name_column && user[setup.auth.db_display_name_column]) user.__display_name = user[setup.auth.db_display_name_column]

  const session = buildSession(projectId, user, setup.auth.db_display_name_column)
  if (!session) return { kind: 'error', status: 502, code: 'tunnel_error' }

  // só o MFA é exigência: a biometria isolada é um convite opcional, mostrado com a sessão já emitida
  if (setup.security.mfa_enabled) {
    return { kind: 'mfa', user, pendingToken: signToken('mfa_pending', { pid: projectId, sub: session.sub, user }, MFA_PENDING_TTL) }
  }
  return { kind: 'ok', user, session, ...(setup.security.passkey_enabled ? { offerPasskey: true } : {}) }
}

export interface PendingData { pid: string; sub: string; user: UserRow }

/** Prova de que o usuário passou pelo MFA/biometria (emitida pelas rotas de segurança). */
export const issueMfaProof = (pid: string, sub: string) => signToken('mfa_proof', { pid, sub }, MFA_PROOF_TTL)

export function completeLogin(
  projectId: string,
  displayColumn: string | undefined,
  input: { pendingToken: unknown; proof: unknown },
): LoginResult {
  const pending = verifyToken<PendingData>('mfa_pending', typeof input.pendingToken === 'string' ? input.pendingToken : null)
  const proof = verifyToken<{ pid: string; sub: string }>('mfa_proof', typeof input.proof === 'string' ? input.proof : null)
  if (!pending || !proof || pending.pid !== projectId || proof.pid !== projectId || pending.sub !== proof.sub) {
    return { kind: 'error', status: 401, code: 'invalid_credentials' }
  }
  const session = buildSession(projectId, pending.user, displayColumn)
  return session && session.sub === pending.sub ? { kind: 'ok', user: pending.user, session } : { kind: 'error', status: 401, code: 'invalid_credentials' }
}

/**
 * Contexto das rotas de segurança do usuário final (MFA, biometria). Com o relay ligado, quem chama precisa provar
 * que é aquele usuário: com o token pendente do login ou com a sessão já emitida. Antes qualquer pessoa que
 * soubesse o id do projeto e do usuário conseguia ler o segredo do autenticador dele.
 */
export function securityContext(
  body: { projectId?: unknown; externalUserId?: unknown; pendingToken?: unknown },
  session: EndUserSession | null,
): { ok: true; pid: string; sub: string } | { ok: false; status: number; error: string } {
  const pending = verifyToken<PendingData>('mfa_pending', typeof body.pendingToken === 'string' ? body.pendingToken : null)
  const who = pending ? { pid: pending.pid, sub: pending.sub } : session ? { pid: session.pid, sub: session.sub } : null
  if (!who) return { ok: false, status: 401, error: 'Sessão expirada. Entre novamente.' }
  if (body.projectId !== who.pid || String(body.externalUserId ?? '') !== who.sub) return { ok: false, status: 403, error: 'Não autorizado.' }
  return { ok: true, pid: who.pid, sub: who.sub }
}

/**
 * Login por biometria (passkey): a biometria já foi verificada pelo servidor, que descobriu o `externalUserId`.
 * Aqui o servidor busca a linha do usuário pelo túnel (o navegador não faz mais essa consulta) e emite a sessão.
 * A biometria é um fator forte: não pede MFA de novo.
 */
export async function performPasskeyLogin(deps: LoginDeps, input: { projectId: string; externalUserId: string }): Promise<LoginResult> {
  const { projectId } = input
  const setup = await deps.loadSetup(projectId)
  if (!setup) return { kind: 'error', status: 404, code: 'bad_request' }
  if (setup.project.is_active === false) return { kind: 'error', status: 403, code: 'inactive' }
  if (!setup.auth.db_table_name) return { kind: 'error', status: 400, code: 'no_auth' }

  const token = await (deps.secretToken ?? getProjectSecretToken)(projectId)
  if (!token) return { kind: 'error', status: 502, code: 'tunnel_error' }

  let res: any
  try {
    res = await deps.call(projectId, {
      queryId: (deps.newId ?? randomUUID)(),
      token,
      projectId,
      action: 'select',
      table: setup.auth.db_table_name,
      schemaName: setup.schemaName,
      filters: { id: input.externalUserId },
    })
  } catch (e) {
    return { kind: 'error', status: 504, code: e instanceof TunnelTimeoutError ? 'tunnel_offline' : 'tunnel_error' }
  }

  const found: UserRow | undefined = res?.success && Array.isArray(res.data) ? res.data[0] : undefined
  if (!found || typeof found !== 'object') return { kind: 'error', status: 401, code: 'invalid_credentials' }

  // a consulta crua traz todas as colunas: a senha nunca pode seguir para a sessão nem para o navegador
  if (!isRowActive(found)) return { kind: 'error', status: 401, code: 'invalid_credentials' }
  const user: UserRow = { ...found }
  const pw = setup.auth.db_password_column
  if (pw) for (const k of Object.keys(user)) if (k.toLowerCase() === String(pw).toLowerCase()) delete user[k]
  if (setup.auth.db_display_name_column && user[setup.auth.db_display_name_column]) user.__display_name = user[setup.auth.db_display_name_column]

  const session = buildSession(projectId, user, setup.auth.db_display_name_column)
  return session ? { kind: 'ok', user, session } : { kind: 'error', status: 502, code: 'tunnel_error' }
}
