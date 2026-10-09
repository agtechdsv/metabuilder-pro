/**
 * Avisa o servidor do andamento de uma exportação.
 *
 * Antes o Agente gravava direto em `download_jobs` com a chave pública do Supabase (a tabela precisava ficar aberta a qualquer
 * visitante). Agora manda um aviso ASSINADO com o token do projeto para o servidor, que valida e grava. Se o servidor não
 * responder (versão antiga do servidor), cai no caminho antigo (gravação direta), que só funciona se a tabela permitir.
 */
const { signCommand } = require('./security');

const EVENT = 'export_progress';

function createProgressReporter({ apiBase, projectId, secretToken, supabase, fetchImpl, log = () => {} }) {
  const post = fetchImpl || ((...a) => fetch(...a));
  const base = String(apiBase || '').replace(/\/+$/, '').replace(/\/api\/metadata\/sync$/, '');

  /** fields: { status, progress?, localPath?, fileName?, recordCount?, error? } */
  return async function report(jobId, fields) {
    if (base) {
      try {
        const command = signCommand(secretToken, EVENT, projectId, { jobId, ...fields });
        const res = await post(`${base}/api/export/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, command }),
        });
        if (res && res.ok) return true;
        log(`servidor respondeu ${res && res.status} ao aviso de andamento`);
      } catch (e) {
        log(`aviso de andamento ao servidor falhou: ${e.message}`);
      }
    }
    // caminho antigo (servidor sem a rota nova)
    if (!supabase) return false;
    const update = { status: fields.status, updated_at: new Date().toISOString() };
    if (fields.progress !== undefined) update.progress = fields.progress;
    if (fields.localPath) update.local_path = fields.localPath;
    if (fields.fileName) update.file_name = fields.fileName;
    if (fields.recordCount !== undefined) update.record_count = fields.recordCount;
    if (fields.error) update.error_message = fields.error;
    if (fields.status === 'completed') update.progress = 100;
    const { error } = await supabase.from('download_jobs').update(update).eq('id', jobId);
    return !error;
  };
}

module.exports = { createProgressReporter, EVENT };
