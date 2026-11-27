import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Arquivo compartilhado da Central de Downloads: uma automação com a ação "Download" entrega o MESMO arquivo a vários usuários
 * (uma linha em download_jobs por pessoa, todas com o mesmo `local_path`). Excluir a linha de um não pode apagar o arquivo dos outros:
 * o arquivo físico só vai embora quando a última linha que aponta para ele some.
 *
 * Devolve, dentre os arquivos das linhas que vão ser excluídas, só os que NENHUMA outra linha do projeto ainda usa. Na dúvida (erro
 * ao consultar) devolve vazio: sobrar um arquivo no disco é melhor que apagar o de outra pessoa.
 */
export async function deletableLocalPaths(
  client: Pick<SupabaseClient, 'from'>,
  projectId: string,
  jobs: Array<{ id: string; local_path?: string | null }>,
): Promise<string[]> {
  const paths = [...new Set(jobs.map(j => j.local_path).filter((p): p is string => typeof p === 'string' && p !== ''))]
  if (paths.length === 0) return []
  const leaving = new Set(jobs.map(j => j.id))
  try {
    const { data, error } = await (client as any).from('download_jobs').select('id, local_path').eq('project_id', projectId).in('local_path', paths)
    if (error) return []
    const stillUsed = new Set(((data as any[]) || []).filter(r => !leaving.has(r.id)).map(r => r.local_path))
    return paths.filter(p => !stillUsed.has(p))
  } catch {
    return []
  }
}
