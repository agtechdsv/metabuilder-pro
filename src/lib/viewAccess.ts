/**
 * Permissão de uma tela (caso de uso) para um grupo de acesso: nenhum, leitura ou escrita.
 *
 * Fica em project_role_permissions (can_read, can_write):
 *  - sem linha            → escrita (telas normais são liberadas por padrão; Automações é o contrário: sem linha = nenhum)
 *  - can_read = false     → nenhum (some do menu e a rota é bloqueada)
 *  - can_read, !can_write → leitura (vê a tela, mas não cria, edita nem exclui)
 *  - can_read, can_write  → escrita
 */
export type AccessLevel = 'none' | 'read' | 'write'

export interface PermissionRow { role_id?: string; view_id?: string; can_read?: boolean | null; can_write?: boolean | null }

export function accessLevelOf(row: PermissionRow | null | undefined, opts: { defaultDeny?: boolean } = {}): AccessLevel {
  if (!row) return opts.defaultDeny ? 'none' : 'write'
  if (row.can_read === false) return 'none'
  // Automações só tem liberado/negado: uma linha com can_read = true é a liberação
  if (opts.defaultDeny) return 'write'
  return row.can_write === true ? 'write' : 'read'
}

/** Colunas de project_role_permissions que representam o nível escolhido (escrita = sem linha nas telas normais). */
export function rowForLevel(level: AccessLevel): { can_read: boolean; can_write: boolean } | null {
  if (level === 'none') return { can_read: false, can_write: false }
  if (level === 'read') return { can_read: true, can_write: false }
  return null
}

/** Botões de gravação que a tela esconde para quem só tem leitura. */
const WRITE_BUTTON_IDS = new Set(['add', 'edit', 'delete'])

/** Configuração de botões de uma tela para quem só pode ler: sem criar/editar/excluir, e "Visualizar" ligado para ainda abrir o registro. */
export function readOnlyButtons(buttons: any[]): any[] {
  const list = Array.isArray(buttons) ? buttons : []
  const mapped = list.map(b => (b && WRITE_BUTTON_IDS.has(b.id) ? { ...b, visible: false } : b))
  return mapped.map(b => (b && b.id === 'view' ? { ...b, visible: true } : b))
}

/**
 * Tabelas em que o grupo NÃO pode gravar: o projeto tem telas dessa tabela e o grupo não tem escrita em nenhuma delas.
 * Tabelas sem nenhuma tela ficam como estão (nada a restringir).
 */
export function writeRestrictedTables(
  views: Array<{ id: string; table: string | null | undefined; slug?: string }>,
  permissions: PermissionRow[],
): string[] {
  const byView = new Map(permissions.map(p => [String(p.view_id), p]))
  const writable = new Set<string>()
  const seen = new Set<string>()
  for (const v of views) {
    const table = String(v.table || '').toLowerCase()
    if (!table) continue
    seen.add(table)
    if (accessLevelOf(byView.get(v.id), { defaultDeny: v.slug === 'automations' }) === 'write') writable.add(table)
  }
  return [...seen].filter(t => !writable.has(t))
}
