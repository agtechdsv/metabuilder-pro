/**
 * Histórico do Ambiente de Testes no disco do usuário (IDE Desktop): C:\Users\<usuário>\.metabuilder\testes\historico\<projeto>\<AAAAMMDD-HHMMSS>.json.
 * Fica dentro da pasta do usuário, que o Tauri sempre libera (não depende de o dev escolher a pasta de novo ao reabrir a IDE).
 */
import type { HistoryRun } from '@/lib/testing/history'

const safe = (s: string) => (s || 'projeto').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80)

async function dirOf(projectSlug: string): Promise<string> {
  const { homeDir, join } = await import('@tauri-apps/api/path')
  return join(await homeDir(), '.metabuilder', 'testes', 'historico', safe(projectSlug))
}

/** Pasta onde o histórico deste projeto é guardado (para mostrar ao usuário). */
export const historyDir = dirOf

export async function saveRun(projectSlug: string, run: HistoryRun): Promise<void> {
  const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')
  const dir = await dirOf(projectSlug)
  await mkdir(dir, { recursive: true }).catch(() => {})
  await writeTextFile(await join(dir, `${run.id}.json`), JSON.stringify(run))
}

/** Todas as execuções do projeto, da mais nova para a mais antiga. Arquivo ilegível é ignorado. */
export async function listRuns(projectSlug: string): Promise<HistoryRun[]> {
  const { exists, readDir, readTextFile } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')
  const dir = await dirOf(projectSlug)
  if (!(await exists(dir))) return []
  const runs: HistoryRun[] = []
  for (const e of await readDir(dir)) {
    if (!e.name?.endsWith('.json')) continue
    try {
      const r = JSON.parse(await readTextFile(await join(dir, e.name))) as HistoryRun
      if (r?.version === 1 && Array.isArray(r.groups)) runs.push(r)
    } catch { /* arquivo corrompido: não derruba a lista */ }
  }
  return runs.sort((a, b) => b.id.localeCompare(a.id))
}

export async function deleteRuns(projectSlug: string, ids: string[]): Promise<void> {
  const { remove } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')
  const dir = await dirOf(projectSlug)
  for (const id of ids) await remove(await join(dir, `${safe(id)}.json`)).catch(() => {})
}
