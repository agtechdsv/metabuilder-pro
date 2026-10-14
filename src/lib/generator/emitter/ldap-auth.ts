/**
 * Login via LDAP / Active Directory do app exportado (opção "LDAP / AD" da exportação).
 * lib/ldap.ts: procura o usuário com a conta de serviço e confere a senha tentando autenticar como o próprio usuário.
 * Texto bruto (String.raw): as barras invertidas valem como estão no código gerado.
 */
export const LDAP_LIB_SOURCE = String.raw`// ARQUIVO GERADO pelo MetaBuilder — login por LDAP / Active Directory.
// Variáveis (.env.local): LDAP_URL, LDAP_BASE_DN, LDAP_BIND_DN, LDAP_BIND_PASSWORD, LDAP_SEARCH_FILTER.
import { Client } from 'ldapts'

export interface LdapUser { email: string; name: string }

export class LdapConfigError extends Error {}

// o que o usuário digita entra num filtro LDAP: caracteres especiais são escapados (RFC 4515)
function escapeFilter(v: string): string {
  return v
    .split('\\').join('\\5c')
    .split('*').join('\\2a')
    .split('(').join('\\28')
    .split(')').join('\\29')
    .split(String.fromCharCode(0)).join('\\00')
}

const first = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : String(v))

/** Devolve o usuário se a senha confere; null se o usuário não existe ou a senha está errada. */
export async function authenticateLdap(username: string, password: string): Promise<LdapUser | null> {
  const url = process.env.LDAP_URL
  const baseDn = process.env.LDAP_BASE_DN
  if (!url || !baseDn) throw new LdapConfigError('LDAP_URL e LDAP_BASE_DN não configurados')
  if (!username || !password) return null

  const filterTemplate = process.env.LDAP_SEARCH_FILTER || '(sAMAccountName={{username}})'
  const filter = filterTemplate.split('{{username}}').join(escapeFilter(username))

  const service = new Client({ url, timeout: 8000, connectTimeout: 8000 })
  let entry: Record<string, unknown> | undefined
  try {
    if (process.env.LDAP_BIND_DN) await service.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_PASSWORD || '')
    const { searchEntries } = await service.search(baseDn, {
      scope: 'sub',
      filter,
      attributes: ['dn', 'cn', 'mail', 'displayName', 'userPrincipalName', 'sAMAccountName'],
      sizeLimit: 2,
    })
    // usuário inexistente ou filtro ambíguo (mais de um resultado): não entra
    if (searchEntries.length !== 1) return null
    entry = searchEntries[0] as Record<string, unknown>
  } finally {
    await service.unbind().catch(() => {})
  }

  const user = new Client({ url, timeout: 8000, connectTimeout: 8000 })
  try {
    await user.bind(String(entry.dn), password)
  } catch {
    return null
  } finally {
    await user.unbind().catch(() => {})
  }

  const email = first(entry.mail) || first(entry.userPrincipalName) || username
  const name = first(entry.displayName) || first(entry.cn) || username
  return { email, name }
}
`
