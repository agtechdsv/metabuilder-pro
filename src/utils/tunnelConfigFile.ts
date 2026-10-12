/**
 * Acesso ao metabuilder.config.json local da IDE (AppData Local) — somente no desktop (Tauri).
 * Usado por telas que precisam ler/gravar uma configuração específica de um projeto sem abrir o editor completo.
 */

async function getConfigPath(): Promise<string> {
  const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
  const dir = await appLocalDataDir()
  return join(dir, 'metabuilder.config.json')
}

export async function readTunnelConfig(): Promise<any | null> {
  const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
  const configPath = await getConfigPath()
  if (!(await exists(configPath))) return null
  return JSON.parse(await readTextFile(configPath))
}

async function writeTunnelConfig(config: any): Promise<void> {
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  const configPath = await getConfigPath()
  await writeTextFile(configPath, JSON.stringify(config, null, 2))
}

export interface ProjectDbConnection {
  type: string
  user: string
  password: string
  host: string
  port: string
  database: string
}

/** Lê a connectionString do projeto no config e separa em usuário/senha/host/porta/banco. Prefere a do tipo informado. */
export async function getProjectDbConnection(projectId: string, preferredType?: string): Promise<ProjectDbConnection | null> {
  const config = await readTunnelConfig()
  const conn = (config?.connections || []).find((c: any) => c.projectId === projectId)
  const list: any[] = Array.isArray(conn?.connectionsString) ? conn.connectionsString : []
  const norm = (t: string) => {
    const s = String(t || '').toLowerCase()
    return s === 'postgresql' || s === 'postgres' ? 'postgres' : s === 'mssql' || s === 'sqlserver' ? 'sqlserver' : s
  }
  const entry = list.find(e => preferredType && norm(e?.type) === preferredType) || list[0]
  if (!entry?.connectionString) return null
  const type = norm(entry.type)
  const raw = String(entry.connectionString)
  try {
    if (type === 'sqlserver' && !raw.includes('://')) {
      const kv: Record<string, string> = {}
      raw.split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) kv[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim() })
      const [host, port] = (kv['server'] || kv['data source'] || '').split(',')
      return { type, user: kv['user id'] || kv['uid'] || '', password: kv['password'] || kv['pwd'] || '', host: host || '', port: port || '1433', database: kv['database'] || kv['initial catalog'] || '' }
    }
    const u = new URL(raw)
    return {
      type,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      host: u.hostname,
      port: u.port,
      database: decodeURIComponent(u.pathname.replace(/^\//, '')),
    }
  } catch {
    return null
  }
}

export interface ProjectDownloadPath {
  /** Caminho configurado especificamente para o projeto ('' se não houver) */
  projectPath: string
  /** Caminho global (padrão) do arquivo, usado quando o projeto não define o seu */
  globalPath: string
  /** Se o projeto existe no metabuilder.config.json */
  found: boolean
}

export async function getProjectDownloadPath(projectId: string): Promise<ProjectDownloadPath> {
  const config = await readTunnelConfig()
  const conn = (config?.connections || []).find((c: any) => c.projectId === projectId)
  // Valor que o projeto herdaria: workspace > global (defaults) > legado (raiz do arquivo)
  const ws = (config?.workspaces || []).find((w: any) => w?.workspaceId === conn?.workspaceId)
  const pick = (v: any) => (typeof v === 'string' && v.trim() ? v : '')
  return {
    projectPath: typeof conn?.downloadPath === 'string' ? conn.downloadPath : '',
    globalPath: pick(ws?.defaults?.downloadPath) || pick(config?.defaults?.downloadPath) || pick(config?.downloadPath),
    found: !!conn,
  }
}

/** Grava o downloadPath dentro da conexão do projeto. Retorna 'not_found' se o projeto não está no arquivo. */
export async function setProjectDownloadPath(projectId: string, downloadPath: string): Promise<'ok' | 'not_found'> {
  const config = await readTunnelConfig()
  const conn = (config?.connections || []).find((c: any) => c.projectId === projectId)
  if (!config || !conn) return 'not_found'
  conn.downloadPath = downloadPath.trim()
  await writeTunnelConfig(config)
  return 'ok'
}
