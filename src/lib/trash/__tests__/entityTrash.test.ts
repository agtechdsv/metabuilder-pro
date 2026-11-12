import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { entityTrashErrorCode } from '../entityTrash'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

describe('códigos de erro da lixeira de projetos e workspaces', () => {
  it('reconhece cada erro levantado pelas funções SQL', () => {
    for (const c of ['delete_not_allowed', 'slug_in_use', 'trash_expired', 'trash_not_found', 'already_exists', 'plan_limit', 'workspace_missing', 'owner_missing']) {
      expect(entityTrashErrorCode({ message: `ERROR: ${c}` }), c).toBe(c)
    }
    expect(entityTrashErrorCode({ message: 'project_not_found' })).toBe('not_found')
    expect(entityTrashErrorCode({ message: 'workspace_not_found' })).toBe('not_found')
    expect(entityTrashErrorCode({ message: 'algo inesperado' })).toBe('unknown')
    expect(entityTrashErrorCode(null)).toBe('unknown')
  })
})

describe('SQL da lixeira de projetos e workspaces (scripts/lixeira-projetos-workspaces.sql)', () => {
  const sql = read('scripts/lixeira-projetos-workspaces.sql')

  it('cria a tabela sem FK para o projeto (ele é apagado) e sem acesso direto pelo cliente', () => {
    expect(sql).toContain('create table if not exists public.mb_entity_trash')
    expect(sql).toMatch(/workspace_id\s+uuid not null,/) // sem "references": o workspace também pode ter sido apagado
    expect(sql).not.toMatch(/mb_entity_trash \([^;]*references public\.(projects|workspaces)/)
    expect(sql).toContain('alter table public.mb_entity_trash enable row level security')
    expect(sql).toContain('revoke all on public.mb_entity_trash from anon, authenticated')
    expect(sql).not.toMatch(/create policy [^;]*mb_entity_trash/)
  })

  it('cada função abre e fecha o bloco $$ (um $ sozinho quebra o script no SQL Editor)', () => {
    const n = (sql.match(/\$\$/g) || []).length
    expect(n % 2).toBe(0)
    expect(n).toBe((sql.match(/create or replace function/g) || []).length * 2)
    expect(sql).not.toMatch(/ as \$(?!\$)/)
  })

  it('as funções que mexem na lixeira são security definer e conferem a permissão sozinhas', () => {
    for (const fn of ['mb_trash_project', 'mb_trash_workspace', 'mb_restore_entity', 'mb_delete_entity_trash']) {
      const i = sql.indexOf(`create or replace function public.${fn}(`)
      expect(i, fn).toBeGreaterThan(0)
      const body = sql.slice(i, i + 1400)
      expect(body, fn).toContain('security definer')
      expect(body, fn).toMatch(/delete_not_allowed/)
    }
  })

  it('só chama quem está logado (nada é liberado para anon ou public)', () => {
    expect(sql).not.toMatch(/grant execute[^;]*\bto\b[^;]*\b(anon|public)\b/)
    for (const fn of ['mb_trash_project(uuid)', 'mb_trash_workspace(uuid)', 'mb_restore_entity(uuid)', 'mb_list_entity_trash(text, uuid)', 'mb_delete_entity_trash(uuid)']) {
      expect(sql, fn).toContain(`grant execute on function public.${fn} to authenticated`)
    }
    // o Supabase dá EXECUTE a anon e authenticated em toda função nova: as de apoio (copiar, recriar, conferir permissão) precisam revogar dos dois,
    // senão qualquer pessoa leria a configuração de um projeto alheio ou inseriria linhas em projects
    for (const fn of ['mb_snapshot_project(uuid)', 'mb_restore_project_payload(jsonb)', 'mb_can_delete_project(uuid, uuid)', 'mb_can_delete_workspace(uuid, uuid)', 'mb_can_manage_entity_trash(public.mb_entity_trash, uuid)']) {
      expect(sql, fn).toContain(`revoke all on function public.${fn} from public, anon, authenticated`)
      expect(sql, fn).not.toContain(`grant execute on function public.${fn}`)
    }
    // as públicas revogam de anon (só quem está logado chama)
    for (const fn of ['mb_trash_project(uuid)', 'mb_trash_workspace(uuid)', 'mb_restore_entity(uuid)', 'mb_list_entity_trash(text, uuid)', 'mb_delete_entity_trash(uuid)', 'mb_purge_expired_entity_trash()']) {
      expect(sql, fn).toContain(`revoke all on function public.${fn} from public, anon;`)
    }
  })

  it('a cópia de um projeto cobre todas as tabelas filhas em cascata (menos telemetria)', () => {
    const spec = sql.slice(sql.indexOf('mb_project_trash_spec'), sql.indexOf('mb_snapshot_project'))
    for (const t of ['models', 'fields', 'relations', 'project_roles', 'ui_views', 'ui_components', 'project_role_permissions', 'project_user_roles', 'bpm_workflows',
      'agents', 'agent_tasks', 'project_auth_config', 'tenant_users', 'project_users_security', 'project_enumerations', 'ui_custom_components', 'ai_builder_sessions',
      'ai_builder_messages', 'mb_trash', 'workspace_member_projects']) {
      expect(spec, t).toContain(`'${t}'`)
    }
    expect(spec).not.toContain("'activity_logs'")
    expect(spec).not.toContain("'bpm_runs'")
  })

  it('restaurar confere prazo, slug, plano, dono e workspace, e as tabelas entram na ordem das chaves estrangeiras', () => {
    for (const s of ['trash_expired', 'slug_in_use', 'already_exists', 'plan_limit', 'owner_missing', 'workspace_missing']) expect(sql, s).toContain(`'${s}'`)
    const order = ['models', 'fields', 'project_roles', 'ui_views', 'ui_components', 'project_role_permissions', 'bpm_workflows', 'workspace_member_projects']
    const spec = sql.slice(sql.indexOf('mb_project_trash_spec'), sql.indexOf('mb_snapshot_project'))
    const pos = order.map(t => spec.indexOf(`'${t}'`))
    expect(pos).toEqual([...pos].sort((a, b) => a - b))
  })

  it('permissões espelham a regra das telas: dono, convidado global, can_delete e o can_delete do projeto', () => {
    expect(sql).toContain("access_level = 'global'")
    expect(sql).toContain('can_delete is true')
    expect(sql).toContain('workspace_member_projects where project_id = p_project_id')
  })
})

describe('telas ligadas à lixeira de projetos e workspaces', () => {
  it('excluir projeto e workspace vai para a lixeira (nada de delete direto na tabela)', () => {
    const pm = read('src/components/workspace/ProjectManager.tsx')
    expect(pm).toContain('moveProjectToTrash(')
    expect(pm).not.toMatch(/\.from\('projects'\)\s*\.delete\(/)
    const wm = read('src/components/workspace/WorkspaceManager.tsx')
    expect(wm).toContain('moveWorkspaceToTrash(')
    expect(wm).not.toMatch(/\.from\('workspaces'\)\s*\.delete\(/)
  })

  it('o cron também limpa a lixeira de projetos e workspaces', () => {
    expect(read('src/app/api/cron/empty-trash/route.ts')).toContain("from('mb_entity_trash')")
  })
})
