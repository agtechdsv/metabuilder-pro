export function parseConnString(type: string, str: string) {
  let user = '', pass = '', host = '', port = '', db = '';
  if (!str) return { user, pass, host, port, db };

  try {
    let withoutProtocol = str;
    const protoIndex = str.indexOf('://');
    if (protoIndex !== -1) {
      withoutProtocol = str.substring(protoIndex + 3);
    }

    const atIndex = withoutProtocol.lastIndexOf('@');
    let authPart = '';
    let hostPathPart = withoutProtocol;
    
    if (atIndex !== -1) {
      authPart = withoutProtocol.substring(0, atIndex);
      hostPathPart = withoutProtocol.substring(atIndex + 1);
      
      const colonAuthIndex = authPart.indexOf(':');
      if (colonAuthIndex !== -1) {
        user = decodeURIComponent(authPart.substring(0, colonAuthIndex));
        pass = decodeURIComponent(authPart.substring(colonAuthIndex + 1));
      } else {
        user = decodeURIComponent(authPart);
      }
    }

    const slashIndex = hostPathPart.indexOf('/');
    let hostPortPart = hostPathPart;
    if (slashIndex !== -1) {
      hostPortPart = hostPathPart.substring(0, slashIndex);
      db = decodeURIComponent(hostPathPart.substring(slashIndex + 1));
    }

    const colonHostIndex = hostPortPart.indexOf(':');
    if (colonHostIndex !== -1) {
      host = hostPortPart.substring(0, colonHostIndex);
      port = hostPortPart.substring(colonHostIndex + 1);
    } else {
      host = hostPortPart;
    }
  } catch (e) {
    console.error("Error parsing conn string", e);
  }

  return { user, pass, host, port, db };
}

export function buildConnString(type: string, parsed: {user: string, pass: string, host: string, port: string, db: string}) {
  const protocol = type === 'postgres' ? 'postgresql' : type || 'postgresql';
  const u = encodeURIComponent(parsed.user);
  const p = encodeURIComponent(parsed.pass);
  const auth = (u || p) ? `${u}:${p}@` : '';
  const port = parsed.port ? `:${parsed.port}` : '';
  const db = parsed.db ? `/${encodeURIComponent(parsed.db)}` : '';
  return `${protocol}://${auth}${parsed.host}${port}${db}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cascata de configuração: projeto > workspace > global (blocos herdados por inteiro)
// Formato: { defaults:{...}, workspaces:[{workspaceId,name,defaults:{...}}], connections:[{projectId,workspaceId,secretToken,...}] }
// ─────────────────────────────────────────────────────────────────────────────

export type ConfigBlockKey = 'connectionsString' | 'downloadPath' | 'ldap'

export interface ConfigScope {
  type: 'global' | 'workspace' | 'project'
  workspaceId?: string
  workspaceName?: string
  projectId?: string
  projectName?: string
  secretToken?: string
}

export type InheritOrigin = 'workspace' | 'global'

/** Um bloco "existe" no nível quando tem conteúdo útil (lista não vazia, texto não vazio ou ldap definido). */
export function hasOwnBlock(container: any, key: ConfigBlockKey): boolean {
  if (!container) return false
  const v = container[key]
  if (key === 'connectionsString') return Array.isArray(v) && v.length > 0
  if (key === 'downloadPath') return typeof v === 'string' && v.trim() !== ''
  return v !== undefined && v !== null
}

/** Migra o formato antigo (ldap/downloadPath na raiz) para defaults, sem perder nada. */
export function normalizeTunnelConfig(cfg: any): any {
  if (!cfg || typeof cfg !== 'object') return cfg
  const out = { ...cfg }
  const defaults = { ...(out.defaults || {}) }
  if (out.ldap !== undefined && defaults.ldap === undefined) defaults.ldap = out.ldap
  if (typeof out.downloadPath === 'string' && out.downloadPath.trim() && !defaults.downloadPath) defaults.downloadPath = out.downloadPath
  delete out.ldap
  delete out.downloadPath
  out.defaults = defaults
  if (!Array.isArray(out.workspaces)) out.workspaces = []
  if (!Array.isArray(out.connections)) out.connections = []
  return out
}

/** Container editável do escopo (global: defaults; workspace: workspaces[].defaults; projeto: a entrada em connections). */
export function getScopeContainer(cfg: any, scope: ConfigScope, create = false): any | null {
  if (scope.type === 'global') {
    if (!cfg.defaults && create) cfg.defaults = {}
    return cfg.defaults || null
  }
  if (scope.type === 'workspace') {
    if (!Array.isArray(cfg.workspaces)) { if (!create) return null; cfg.workspaces = [] }
    let ws = cfg.workspaces.find((w: any) => w?.workspaceId === scope.workspaceId)
    if (!ws && create) {
      ws = { workspaceId: scope.workspaceId, name: scope.workspaceName || '', defaults: {} }
      cfg.workspaces.push(ws)
    }
    if (ws && !ws.defaults && create) ws.defaults = {}
    return ws?.defaults || null
  }
  if (!Array.isArray(cfg.connections)) { if (!create) return null; cfg.connections = [] }
  let conn = cfg.connections.find((c: any) => c?.projectId === scope.projectId)
  if (!conn && create) {
    conn = { projectId: scope.projectId, workspaceId: scope.workspaceId, secretToken: scope.secretToken || '' }
    cfg.connections.push(conn)
  }
  return conn || null
}

/** Valor que o escopo atual herdaria dos níveis acima (projeto olha workspace e global; workspace olha global). */
export function resolveInheritedBlock(
  cfg: any,
  scope: ConfigScope,
  key: ConfigBlockKey
): { value: any; origin: InheritOrigin | null } {
  if (scope.type === 'project') {
    const ws = (cfg.workspaces || []).find((w: any) => w?.workspaceId === scope.workspaceId)
    if (hasOwnBlock(ws?.defaults, key)) return { value: ws.defaults[key], origin: 'workspace' }
  }
  if (scope.type !== 'global' && hasOwnBlock(cfg.defaults, key)) return { value: cfg.defaults[key], origin: 'global' }
  return { value: null, origin: null }
}

/** Há alguma string de conexão efetiva (própria, do workspace ou global) para o projeto? */
export function hasEffectiveConnection(cfg: any, projectId: string, workspaceId?: string): boolean {
  const conn = (cfg.connections || []).find((c: any) => c?.projectId === projectId)
  if (hasOwnBlock(conn, 'connectionsString') || (conn && typeof conn.connectionString === 'string' && conn.connectionString.trim())) return true
  const ws = (cfg.workspaces || []).find((w: any) => w?.workspaceId === (workspaceId || conn?.workspaceId))
  if (hasOwnBlock(ws?.defaults, 'connectionsString')) return true
  return hasOwnBlock(cfg.defaults, 'connectionsString')
}

/** Resumo legível (sem senha) de uma string de conexão, para exibir valores herdados. */
export function summarizeConnection(c: any): string {
  const p = parseConnString(c?.type || 'postgres', c?.connectionString || '')
  const hostPort = p.host ? `${p.host}${p.port ? ':' + p.port : ''}` : ''
  return `${c?.name || '—'} (${c?.type || 'postgres'}) · ${p.user ? p.user + '@' : ''}${hostPort}${p.db ? '/' + p.db : ''}`
}

export const defaultTunnelConfigTemplate = `{
  "defaults": {
    "downloadPath": "C:\\\\AgTech\\\\DownloadsMetaBuilder",
    "ldap": {
      "enabled": false,
      "url": "ldap://10.0.0.15:389",
      "baseDn": "dc=empresa,dc=local",
      "bindDn": "cn=metabuilder_service,ou=Services,dc=empresa,dc=local",
      "bindPassword": "senha_secreta_do_bind",
      "searchFilter": "(sAMAccountName={{username}})"
    }
  },
  "workspaces": [],
  "connections": []
}`
