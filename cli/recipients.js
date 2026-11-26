'use strict'

/**
 * Destinatários "usuários e grupos do sistema" do nó de e-mail → lista de e-mails (separados por vírgula).
 *
 * Função pura: recebe a configuração (vinda do servidor) e uma função `query` para o banco do cliente, para poder ser testada.
 *  - `data.emailGroupsUsers`: { "<grupo>": "all" | [ids de usuários] }.
 *  - Grupos "legados" (tabelas do próprio cliente, ex.: perfis / perfis_usuarios): lê o banco do cliente.
 *  - Sem grupos legados: usa os perfis da plataforma (`config.roles` e `config.userRoles`).
 *  - Os e-mails vêm da tabela de usuários do login (`config.auth.db_table_name` / `db_email_column`).
 */

const safeIdent = (s) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(s || '')) ? String(s) : null)

async function resolveSystemRecipientEmails({ data, config, query, dialect = 'postgres', log = {} }) {
  const auth = (config && config.auth) || {}
  const ph = (i) => (dialect === 'oracle' ? `:${i}` : `$${i}`)
  const limit1 = dialect === 'oracle' ? 'FETCH FIRST 1 ROWS ONLY' : 'LIMIT 1'
  const warn = typeof log.warn === 'function' ? log.warn : () => {}
  const userIds = []

  for (const [groupName, selection] of Object.entries((data && data.emailGroupsUsers) || {})) {
    if (Array.isArray(selection)) { userIds.push(...selection); continue }
    if (selection !== 'all') continue
    try {
      const groupsTable = safeIdent(auth.groups_table)
      const linkTable = safeIdent(auth.user_roles_table)
      const oneToN = auth.user_groups_type && auth.user_groups_type !== 'n_to_n'
      if (auth.sync_legacy_groups && groupsTable && oneToN && safeIdent(auth.user_role_column) && safeIdent(auth.db_table_name)) {
        // o perfil é uma coluna da própria tabela de usuários (ex.: usuarios.perfil_id)
        const nameCol = safeIdent(auth.groups_name_column) || 'name'
        const roleCol = safeIdent(auth.user_role_column)
        const groupRows = await query(`SELECT * FROM "${groupsTable}" WHERE "${nameCol}" = ${ph(1)} ${limit1}`, [groupName])
        const groupId = groupRows[0] && (groupRows[0].id ?? groupRows[0][groupsTable + '_id'] ?? groupRows[0]['id_' + groupsTable])
        if (groupId === undefined || groupId === null) {
          warn(`[BPM] Grupo "${groupName}" não encontrado na tabela ${groupsTable}.`)
          continue
        }
        const members = await query(`SELECT "id" FROM "${safeIdent(auth.db_table_name)}" WHERE "${roleCol}" = ${ph(1)}`, [groupId])
        userIds.push(...members.map((r) => r.id))
      } else if (auth.sync_legacy_groups && groupsTable && linkTable) {
        const nameCol = safeIdent(auth.groups_name_column) || 'name'
        const userCol = safeIdent(auth.user_roles_user_col) || 'user_id'
        const roleCol = safeIdent(auth.user_roles_role_col) || 'group_id'
        const groupRows = await query(`SELECT * FROM "${groupsTable}" WHERE "${nameCol}" = ${ph(1)} ${limit1}`, [groupName])
        const groupId = groupRows[0] && (groupRows[0].id ?? groupRows[0][groupsTable + '_id'] ?? groupRows[0]['id_' + groupsTable])
        if (groupId === undefined || groupId === null) {
          warn(`[BPM] Grupo "${groupName}" não encontrado na tabela ${groupsTable}.`)
          continue
        }
        const links = await query(`SELECT "${userCol}" FROM "${linkTable}" WHERE "${roleCol}" = ${ph(1)}`, [groupId])
        userIds.push(...links.map((r) => r[userCol]))
      } else {
        const role = ((config && config.roles) || []).find((r) => r.name === groupName)
        if (!role) { warn(`[BPM] Perfil "${groupName}" não encontrado.`); continue }
        for (const ur of (config && config.userRoles) || []) {
          if (ur.role_id === role.id) userIds.push(ur.external_user_id)
        }
      }
    } catch (err) {
      warn(`[BPM] Erro ao resolver o grupo "${groupName}": ${err.message}`)
    }
  }

  const ids = [...new Set(userIds.filter((v) => v !== undefined && v !== null && v !== ''))]
  if (ids.length === 0) return ''

  const usersTable = safeIdent(auth.db_table_name)
  const emailCol = safeIdent(auth.db_email_column) || 'email'
  if (!usersTable) { warn('[BPM] Tabela de usuários do login não configurada: não dá para achar os e-mails.'); return '' }
  try {
    const placeholders = ids.map((_, i) => ph(i + 1)).join(',')
    const rows = await query(`SELECT "${emailCol}" FROM "${usersTable}" WHERE "id" IN (${placeholders})`, ids)
    return [...new Set(rows.map((r) => r[emailCol]).filter(Boolean))].join(',')
  } catch (err) {
    warn(`[BPM] Erro ao buscar os e-mails dos usuários: ${err.message}`)
    return ''
  }
}

module.exports = { resolveSystemRecipientEmails }
