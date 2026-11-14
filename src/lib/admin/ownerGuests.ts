/**
 * Convidados de cada dono, sem repetir pessoa. Usado pela lista de clientes do painel do SuperAdmin.
 *
 * Um convidado "global" vale para TODOS os workspaces do dono e pode também ser membro de vários: continua sendo UMA licença consumida.
 * (A conta antiga somava os convidados workspace por workspace, então 1 convidado em 2 workspaces aparecia como 2 licenças a mais.)
 */
export interface WorkspaceRef { id: string; owner_id: string }
export interface MemberRef { workspace_id: string; user_id: string }
export interface OwnerGuestRef { owner_id: string; user_id: string }

/** dono -> conjunto dos convidados (membros de algum workspace dele, fora o próprio dono, mais os convidados do dono) */
export function buildOwnerGuestIds(workspaces: WorkspaceRef[], members: MemberRef[], ownerGuests: OwnerGuestRef[]): Map<string, Set<string>> {
  const byWorkspace = new Map(workspaces.map(w => [w.id, w.owner_id]))
  const map = new Map<string, Set<string>>()
  const add = (ownerId: string, userId: string) => {
    if (!map.has(ownerId)) map.set(ownerId, new Set())
    map.get(ownerId)!.add(userId)
  }
  for (const m of members) {
    const owner = byWorkspace.get(m.workspace_id)
    if (owner && owner !== m.user_id) add(owner, m.user_id)
  }
  for (const g of ownerGuests) add(g.owner_id, g.user_id)
  return map
}

/** Licenças consumidas por um dono: ele mesmo mais os convidados distintos. */
export function consumedLicenses(guests: Set<string> | undefined): number {
  return 1 + (guests ? guests.size : 0)
}
