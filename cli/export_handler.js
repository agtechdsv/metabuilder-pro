const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { jsPDF } = require('jspdf');
const chalk = require('chalk');
const { authorizeCommand, NonceCache, isPathInside } = require('./security');
const { applyToSelect } = require('./sqlPolicy');

function registerExportHandlers(channel, pgClient, oracleConnection, dbType, secretToken, projectId, configData, supabase, extra = {}) {
  // mesma verificação dos comandos de dados (assinatura ou token); sem ela os eventos abaixo ficariam abertos a qualquer um no canal
  const security = extra.security || { projectId, secretToken, nonces: new NonceCache() };
  const router = extra.router || null;
  // Configured local download path
  const baseDownloadPath = configData.downloadPath || path.join(require('os').homedir(), 'Downloads', 'MetaBuilderExports');
  
  if (!fs.existsSync(baseDownloadPath)) {
    fs.mkdirSync(baseDownloadPath, { recursive: true });
  }

  channel.on('broadcast', { event: 'export_job_start' }, async (payload) => {
    const { jobId, sql, params, fileType, viewName, workspaceSlug, projectSlug, exportGraph, projectRelations, masterModelId, modelName, dictionary, recordId } = payload.payload;

    // exportação de USUÁRIO FINAL: o servidor mandou `access` (permissões e regras por linha); vale para esta consulta e para o grafo
    const access = payload.payload.access;
    const endUser = access !== undefined;
    const auth = authorizeCommand('export_job_start', payload.payload, security);
    if (!auth.ok) {
      console.log(chalk.red(`[ BLOQUEADO ] Export job recusado (${auth.reason}). (Job ${jobId})`));
      return;
    }

    console.log(chalk.yellow(`[ EXPORT ] Gerando arquivo localmente para o Job ${jobId}...`));

    // Progresso por etapas: atualiza o banco (a Central de Downloads escuta essa tabela) e avisa por broadcast
    const reportProgress = async (pct) => {
      try {
        if (supabase) {
          await supabase.from('download_jobs')
            .update({ status: 'processing', progress: pct, updated_at: new Date().toISOString() })
            .eq('id', jobId);
        }
        await channel.send({ type: 'broadcast', event: 'download_progress', payload: { jobId, status: 'processing', progress: pct, viewName } });
      } catch (_) { /* progresso é informativo: nunca derruba a exportação */ }
    };

    try {
      // Step 1: Execute query locally
      let rows = [];
      let finalSql = sql;
      if (endUser) {
        if (!access || typeof access !== 'object' || !Array.isArray(access.policies)) throw new Error('Exportação de usuário final sem regras de acesso válidas.');
        finalSql = applyToSelect(sql, access, { dbType });
      }
      if (dbType === 'oracle') {
        const oraRes = await oracleConnection.execute(finalSql, params || [], { outFormat: require('oracledb').OUT_FORMAT_OBJECT });
        rows = oraRes.rows || [];
      } else {
        const result = await pgClient.query(finalSql, params || []);
        rows = result.rows || [];
      }

      // Step 1.1: Fetch full graph if requested
      console.log(chalk.cyan(`[ EXPORT DEBUG ] exportGraph=${exportGraph}, hasRelations=${!!projectRelations}, masterModelId=${masterModelId}, hasDict=${!!dictionary}`));
      
      if (exportGraph && projectRelations && masterModelId && dictionary) {
        console.log(chalk.yellow(`[ EXPORT ] Recuperando grafo aninhado para o Job ${jobId}...`));
        const fetchGraph = async (parentRow, currentModelId) => {
          const relations = projectRelations.filter(r => String(r.master_model_id).toLowerCase() === String(currentModelId).toLowerCase());
          for (const rel of relations) {
            const detailModelId = rel.detail_model_id;
            const fk = rel.foreign_key;
            const detailTableName = dictionary[detailModelId];
            const parentPk = parentRow.id || parentRow.ID || parentRow.Id || parentRow.codigo || parentRow.uuid || (parentRow === rows[0] ? recordId : null);
            if (!detailTableName || !parentPk) continue;
            
            let detailRows = [];
            if (dbType === 'oracle') {
              let query = `SELECT * FROM "${detailTableName}" WHERE "${fk}" = :1`;
              if (endUser) query = applyToSelect(query, access, { dbType });
              const res = await oracleConnection.execute(query, [parentPk], { outFormat: require('oracledb').OUT_FORMAT_OBJECT });
              detailRows = res.rows || [];
            } else {
              let query = `SELECT * FROM "${detailTableName}" WHERE "${fk}" = $1`;
              if (endUser) query = applyToSelect(query, access, { dbType });
              const res = await pgClient.query(query, [parentPk]);
              detailRows = res.rows || [];
            }
            
            // Recurse for subdetails
            for (let i = 0; i < detailRows.length; i++) {
               await fetchGraph(detailRows[i], detailModelId);
            }
            
            const cleanKey = detailTableName.replace(/[^a-zA-Z0-9_]/g, '_');
            parentRow[cleanKey] = detailRows;
          }
        };

        for (let i = 0; i < rows.length; i++) {
          await fetchGraph(rows[i], masterModelId);
        }
      }

      console.log(chalk.green(`[ EXPORT ] Query retornou ${rows.length} registros (base).`));
      await reportProgress(35);

      // Step 2: Format data into Buffer
      let buffer;
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const ms = Date.now().toString().slice(-4);
      const cleanViewName = (viewName || 'export').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const wSlug = workspaceSlug || 'workspace';
      const pSlug = projectSlug || 'project';
      const fileName = `${wSlug}_${pSlug}_${cleanViewName}_${timestamp}${ms}.${fileType}`;
      const localFilePath = path.join(baseDownloadPath, fileName);

      // Step 1.2: Flatten graph for CSV/PDF/OFX if needed
      let flatRows = rows;
      if (exportGraph && fileType !== 'json' && fileType !== 'xlsx') {
        const flattenGraph = (row, prefix = '') => {
          const flatRowsArray = [];
          const scalarRow = {};
          const arrayFields = [];
          
          for (const [key, val] of Object.entries(row)) {
             if (key === '_key' || key === '_details') continue;
             if (Array.isArray(val)) {
                arrayFields.push({ key, rows: val });
             } else {
                const cleanKey = key.includes('.') ? key.split('.').pop() || key : key;
                const formattedKey = prefix + (cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1).replace(/_/g, ' '));
                scalarRow[formattedKey] = val;
             }
          }

          if (arrayFields.length === 0) {
             flatRowsArray.push(scalarRow);
          } else {
             let currentCombinations = [scalarRow];
             for (const arrField of arrayFields) {
                const nextCombinations = [];
                if (arrField.rows.length === 0) {
                   nextCombinations.push({ ...scalarRow });
                } else {
                  for (const subRow of arrField.rows) {
                     const flattenedSubRows = flattenGraph(subRow, arrField.key + ' - ');
                     for (const flatSubRow of flattenedSubRows) {
                        for (const curr of currentCombinations) {
                           nextCombinations.push({ ...curr, ...flatSubRow });
                        }
                     }
                  }
                }
                currentCombinations = nextCombinations;
             }
             flatRowsArray.push(...currentCombinations);
          }
          return flatRowsArray;
        };
        
        flatRows = [];
        for (const row of rows) {
          flatRows.push(...flattenGraph(row));
        }
      }

      if (fileType === 'xlsx') {
        const workbook = xlsx.utils.book_new();

        if (exportGraph && projectRelations) {
          const tablesData = {};
          const extractTableData = (row, tableName) => {
            if (!tablesData[tableName]) tablesData[tableName] = [];
            const flatRow = {};
            for (const [key, val] of Object.entries(row)) {
               if (key === '_key' || key === '_details') continue;
               if (Array.isArray(val)) {
                  val.forEach(subRow => extractTableData(subRow, key));
               } else {
                  const cleanKey = key.includes('.') ? key.split('.').pop() || key : key;
                  const formattedKey = cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1).replace(/_/g, ' ');
                  flatRow[formattedKey] = val;
               }
            }
            tablesData[tableName].push(flatRow);
          };

          const masterTableName = modelName || 'Dados Exportados';
          rows.forEach(row => extractTableData(row, masterTableName));

          for (const [tName, tRows] of Object.entries(tablesData)) {
            const worksheet = xlsx.utils.json_to_sheet(tRows);
            const sheetName = tName.substring(0, 31);
            xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
          }
        } else {
          const cleanedRows = rows.map(row => {
            const cleanRow = {};
            for (const [key, val] of Object.entries(row)) {
              if (key === '_key' || key === '_details') continue;
              const cleanKey = key.includes('.') ? key.split('.').pop() || key : key;
              const formattedKey = cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1).replace(/_/g, ' ');
              cleanRow[formattedKey] = val;
            }
            return cleanRow;
          });
          const worksheet = xlsx.utils.json_to_sheet(cleanedRows);
          xlsx.utils.book_append_sheet(workbook, worksheet, 'Dados Exportados');
        }
        buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      } 

      else if (fileType === 'csv') {
        if (flatRows.length === 0) {
          buffer = Buffer.from('', 'utf-8');
        } else {
          const headers = Object.keys(flatRows[0]).filter(k => k !== '_key' && k !== '_details');
          const csvHeaders = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
          const csvRows = flatRows.map(row => headers.map(h => {
            const val = row[h];
            return val == null ? '""' : `"${String(val).replace(/"/g, '""')}"`;
          }).join(','));
          const csvContent = '\uFEFF' + [csvHeaders, ...csvRows].join('\n');
          buffer = Buffer.from(csvContent, 'utf-8');
        }
      } 
      else if (fileType === 'json') {
        buffer = Buffer.from(JSON.stringify(rows, null, 2), 'utf-8');
      }
      else if (fileType === 'ofx') {
        const dtserver = new Date().toISOString().replace(/[-T:.Z]/g, '').substring(0, 14);
        let transactionsXml = '';
        
        flatRows.forEach((row, idx) => {
          // Identify keys dynamically
          const amtKey = Object.keys(row).find(k => ['amount', 'valor', 'total', 'value', 'price', 'preco'].includes(k.toLowerCase()) || k.toLowerCase().includes('valor'));
          const amt = amtKey != null ? parseFloat(row[amtKey]) || 0 : 0;
          
          const dateKey = Object.keys(row).find(k => ['date', 'data', 'created_at', 'timestamp'].includes(k.toLowerCase()) || k.toLowerCase().includes('data'));
          const rawDate = dateKey != null ? row[dateKey] : new Date();
          const parsedDate = new Date(rawDate);
          const dateStr = !isNaN(parsedDate.getTime()) 
            ? parsedDate.toISOString().replace(/[-T:.Z]/g, '').substring(0, 14)
            : dtserver;

          const descKey = Object.keys(row).find(k => ['description', 'descricao', 'name', 'nome', 'title', 'titulo', 'memo'].includes(k.toLowerCase()) || k.toLowerCase().includes('nome') || k.toLowerCase().includes('desc'));
          const desc = descKey != null ? String(row[descKey]).substring(0, 32) : `Transacao ${idx + 1}`;
          
          const idKey = Object.keys(row).find(k => ['id', 'uuid', 'code', 'codigo'].includes(k.toLowerCase()));
          const fitid = idKey != null ? String(row[idKey]) : `${dtserver}${idx}`;

          const trntype = amt < 0 ? 'DEBIT' : 'CREDIT';

          transactionsXml += `
            <STMTTRN>
              <TRNTYPE>${trntype}</TRNTYPE>
              <DTPOSTED>${dateStr}</DTPOSTED>
              <TRNAMT>${amt.toFixed(2)}</TRNAMT>
              <FITID>${fitid}</FITID>
              <MEMO>${desc.replace(/[<>]/g, '')}</MEMO>
            </STMTTRN>
          `;
        });

        const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0</CODE>
        <SEVERITY>INFO</SEVERITY>
      </STATUS>
      <DTSERVER>${dtserver}</DTSERVER>
      <LANGUAGE>POR</LANGUAGE>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>1</TRNUID>
      <STATUS>
        <CODE>0</CODE>
        <SEVERITY>INFO</SEVERITY>
      </STATUS>
      <STMTRS>
        <CURDEF>BRL</CURDEF>
        <BANKACCTFROM>
          <BANKID>000</BANKID>
          <ACCTID>00000</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>${dtserver}</DTSTART>
          <DTEND>${dtserver}</DTEND>
          ${transactionsXml}
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>0.00</BALAMT>
          <DTASOF>${dtserver}</DTASOF>
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

        buffer = Buffer.from(ofxContent, 'utf-8');
      }
      else if (fileType === 'pdf') {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(18);
        doc.text(viewName || 'Exportação', 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

        if (flatRows.length > 0) {
          const headers = Object.keys(flatRows[0]).filter(k => k !== '_key' && k !== '_details');
          const data = flatRows.map(row => headers.map(h => {
             let val = row[h];
             if (val instanceof Date) return val.toLocaleDateString();
             if (typeof val === 'object' && val !== null) return JSON.stringify(val);
             return String(val ?? '');
          }));
          
          doc.autoTable({
            head: [headers.map(h => h.charAt(0).toUpperCase() + h.slice(1).replace(/_/g, ' '))],
            body: data,
            startY: 40,
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { top: 40 }
          });
        } else {
          doc.text("Nenhum dado encontrado.", 14, 40);
        }
        
        buffer = Buffer.from(doc.output('arraybuffer'));
      }
      else {
        // Fallback for unsupported formats in this quick implementation
        buffer = Buffer.from('Unsupported format on CLI', 'utf-8');
      }

      // Step 3: Save to local disk
      await reportProgress(70);
      fs.writeFileSync(localFilePath, buffer);
      await reportProgress(90);
      console.log(chalk.green(`[ EXPORT ] Arquivo salvo com sucesso em: ${localFilePath}`));

      // Step 4: Update database status via Supabase client (passed in from index.js)
      if (supabase) {
        const { error } = await supabase.from('download_jobs')
          .update({
             status: 'completed',
             progress: 100,
             local_path: localFilePath,
             file_name: fileName,
             record_count: rows.length,
             updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
          
        if (error) {
          console.error(chalk.red('[ EXPORT ] Erro ao atualizar status no banco:'), error.message);
        } else {
          // Broadcast progress completion to instantly update the UI widget
          await channel.send({
            type: 'broadcast',
            event: 'download_progress',
            payload: {
              jobId,
              status: 'completed',
              progress: 100,
              fileName,
              recordCount: rows.length
            }
          });
        }
      }

    } catch (err) {
      console.error(chalk.red(`[ EXPORT ] Erro na geração local:`), err.message);
      if (supabase) {
        await supabase.from('download_jobs').update({
           status: 'failed',
           error_message: err.message,
           updated_at: new Date().toISOString()
        }).eq('id', jobId);
        
        // Broadcast failure to instantly update the UI widget
        await channel.send({
          type: 'broadcast',
          event: 'download_progress',
          payload: {
            jobId,
            status: 'failed',
            error: err.message
          }
        });
      }
    }
  });

  // 2. Ouvinte para Streaming (Envia chunks do HD local para a nuvem via WebSocket)
  channel.on('broadcast', { event: 'request_download_stream' }, async (payloadEvent) => {
    const { jobId, localPath } = payloadEvent.payload;
    const eventName = `download_chunk_${jobId}`;

    // Antes este evento não pedia autenticação nem limitava o caminho: qualquer pessoa no canal público podia pedir
    // QUALQUER arquivo da máquina. Agora exige comando autenticado e só entrega arquivos da pasta de exportações.
    const auth = authorizeCommand('request_download_stream', payloadEvent.payload, security);
    if (!auth.ok) {
      console.log(chalk.red(`[ BLOQUEADO ] Pedido de download recusado (${auth.reason}).`));
      return;
    }
    // os pedaços do arquivo vão só ao tópico privado de quem pediu (o servidor que entrega o download)
    const replyTo = router ? router.accept(payloadEvent.payload.replyTo) : null;
    const send = (body) => (router ? router.reply(replyTo, eventName, body) : channel.send({ type: 'broadcast', event: eventName, payload: body }));

    if (!isPathInside(baseDownloadPath, localPath)) {
       console.log(chalk.red(`[ BLOQUEADO ] Download fora da pasta de exportações recusado: ${String(localPath).slice(0, 120)}`));
       await send({ error: 'Arquivo não disponível.' });
       return;
    }

    if (!fs.existsSync(localPath)) {
       console.log(chalk.red(`[ STREAM ] Arquivo não encontrado: ${localPath}`));
       await send({ error: 'Arquivo deletado ou não encontrado no servidor corporativo.' });
       return;
    }

    console.log(chalk.cyan(`[ STREAM ] Iniciando streaming do arquivo ${localPath}...`));
    
    // Ler em pedaços de 500KB para não sobrecarregar o websocket
    const CHUNK_SIZE = 500 * 1024;
    const readStream = fs.createReadStream(localPath, { highWaterMark: CHUNK_SIZE });

    readStream.on('data', async (chunk) => {
       // Pause the stream while we send over websocket
       readStream.pause();
       try {
         const chunkBase64 = chunk.toString('base64');
         console.log(chalk.cyan(`[ STREAM ] Enviando chunk de ${chunkBase64.length} caracteres para ${eventName}...`));
         await send({ chunk: chunkBase64, isLast: false });
         console.log(chalk.cyan(`[ STREAM ] Chunk enviado com sucesso para ${eventName}.`));
         readStream.resume();
       } catch (err) {
         console.error(chalk.red(`[ STREAM ] Erro enviando chunk:`), err.message);
         readStream.destroy(err);
       }
    });

    readStream.on('end', async () => {
       console.log(chalk.cyan(`[ STREAM ] Fim do arquivo. Aguardando 200ms para enviar isLast:true...`));
       setTimeout(async () => {
         await send({ chunk: null, isLast: true });
         console.log(chalk.cyan(`[ STREAM ] isLast: true enviado.`));
       }, 200);

       // O arquivo NÃO é apagado aqui: ele permanece "disponível para download" até a política de retenção do projeto
       // (limpeza automática) ou até o usuário excluí-lo. Apagar após o 1º envio fazia o 2º download falhar e, se o
       // 1º tivesse chegado incompleto, perdia o arquivo para sempre.
    });

    readStream.on('error', async (err) => {
       console.error(chalk.red(`[ STREAM ] Erro de leitura no HD:`), err.message);
       await send({ error: 'Erro ao ler arquivo do HD corporativo.' });
    });
  });
  // 3. Ouvinte para exclusão local
  channel.on('broadcast', { event: 'delete_export_file' }, async (payloadEvent) => {
    const { localPath } = payloadEvent.payload;
    // sem isto qualquer pessoa no canal público apagava qualquer arquivo da máquina
    const auth = authorizeCommand('delete_export_file', payloadEvent.payload, security);
    if (!auth.ok) {
      console.log(chalk.red(`[ BLOQUEADO ] Exclusão de arquivo recusada (${auth.reason}).`));
      return;
    }
    if (!isPathInside(baseDownloadPath, localPath)) {
      console.log(chalk.red(`[ BLOQUEADO ] Exclusão fora da pasta de exportações recusada: ${String(localPath).slice(0, 120)}`));
      return;
    }
    if (localPath && fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
        console.log(chalk.yellow(`[ EXPORT ] Arquivo local excluído: ${localPath}`));
      } catch (e) {
        console.error(chalk.red(`[ EXPORT ] Erro ao excluir arquivo local:`), e.message);
      }
    }
  });
}
module.exports = { registerExportHandlers };
