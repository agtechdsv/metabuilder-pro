'use strict'

/**
 * Ação "Download" das automações: gera o arquivo do resultado de uma consulta e o põe na Central de Downloads de cada destinatário.
 *
 * O arquivo é gravado na PASTA DE EXPORTAÇÕES do Agente (a mesma das exportações das telas: o servidor pede o arquivo ao Agente quando
 * o usuário clica em baixar, e o Agente só serve arquivos de dentro dessa pasta). Depois o Agente avisa o SERVIDOR, com um comando
 * ASSINADO pelo token do projeto, para registrar uma linha em download_jobs por destinatário (cada um só vê a sua). As linhas dos
 * vários destinatários apontam para o MESMO arquivo; o servidor só apaga o arquivo físico quando a última linha some.
 *
 * Se o servidor recusar (ex.: ainda sem a rota nova), o arquivo recém-criado é apagado e o erro volta ao fluxo.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const axios = require('axios')
const { signCommand, isPathInside } = require('./security')
const { buildAttachment } = require('./attachments')

const EVENT = 'automation_download'

// O CLI roda no Node 18 do `pkg`, cujo `fetch` falha em redirecionamento 307 com corpo: o axios segue o redirecionamento.
const axiosPost = async (url, body) => {
  const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' }, timeout: 30000, maxRedirects: 5, validateStatus: () => true })
  return { ok: res.status >= 200 && res.status < 300, status: res.status, data: res.data }
}

function createDownloadDelivery({ apiBase, projectId, secretToken, downloadPath, log = () => {}, post }) {
  const send = post || axiosPost
  const base = String(apiBase || '').replace(/\/+$/, '').replace(/\/api\/metadata\/sync$/, '')
  const dir = downloadPath || path.join(os.homedir(), 'Downloads', 'MetaBuilderExports')

  /** { dataset, format, fileName, recipientIds, title } -> { delivered } */
  return async function deliver({ dataset, format, fileName, recipientIds, title }) {
    if (!base) throw new Error('endereço do servidor não configurado no Agente')
    if (!Array.isArray(recipientIds) || recipientIds.length === 0) throw new Error('sem destinatários')

    fs.mkdirSync(dir, { recursive: true })
    const built = buildAttachment({ format, filename: fileName, dataset })
    const buffer = Buffer.from(built.content, 'base64')

    // nome único na pasta (dois fluxos podem gerar o mesmo nome); o nome que o usuário vê e baixa é o `fileName`
    const unique = `${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}_${crypto.randomBytes(3).toString('hex')}_${fileName}`
    const localPath = path.join(dir, unique)
    if (!isPathInside(dir, localPath)) throw new Error('caminho do arquivo fora da pasta de exportações')
    fs.writeFileSync(localPath, buffer)

    try {
      const recordCount = Array.isArray(dataset && dataset.rows) ? dataset.rows.length : 0
      const command = signCommand(secretToken, EVENT, projectId, { recipients: recipientIds, fileName, fileType: format, recordCount, localPath, title })
      const res = await send(`${base}/api/automations/download`, JSON.stringify({ projectId, command }))
      if (!res || !res.ok) {
        const why = res && res.data && res.data.error ? res.data.error : `o servidor respondeu ${res && res.status}`
        throw new Error(why)
      }
      log(`arquivo ${fileName} (${buffer.length} bytes) entregue a ${res.data && res.data.delivered != null ? res.data.delivered : recipientIds.length} usuário(s)`)
      return { delivered: res.data && res.data.delivered != null ? Number(res.data.delivered) : recipientIds.length }
    } catch (e) {
      try { fs.unlinkSync(localPath) } catch (_) { /* já não existe */ }
      throw e
    }
  }
}

module.exports = { createDownloadDelivery, EVENT }
