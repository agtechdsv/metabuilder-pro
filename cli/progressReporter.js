/**
 * Avisa o servidor do andamento de uma exportação.
 *
 * Antes o Agente gravava direto em `download_jobs` com a chave pública do Supabase (a tabela precisava ficar aberta a qualquer
 * visitante). Agora manda um aviso ASSINADO com o token do projeto para o servidor, que valida e grava. Se o servidor não
 * responder (versão antiga do servidor), cai no caminho antigo (gravação direta), que só funciona se a tabela permitir.
 */
const axios = require('axios');
const { signCommand } = require('./security');

const EVENT = 'export_progress';

/**
 * O CLI roda no Node 18.5 embutido pelo `pkg`, cujo `fetch` falha ao seguir um redirecionamento 307 com corpo
 * ("Request body length does not match content-length header"). O endereço `metabuilderpro.com` (sem www) redireciona
 * para o `www`, então um POST com `fetch` nunca chegava. O axios segue o redirecionamento preservando método e corpo.
 */
const axiosPost = async (url, init) => {
  const res = await axios.post(url, init.body, {
    headers: init.headers,
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: () => true, // quem decide é o código de status devolvido
    transformRequest: [(data) => data], // o corpo já é JSON em texto
  });
  return { ok: res.status >= 200 && res.status < 300, status: res.status };
};

function createProgressReporter({ apiBase, projectId, secretToken, supabase, fetchImpl, log = () => {} }) {
  const post = fetchImpl || axiosPost;
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
