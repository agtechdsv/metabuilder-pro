const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { jsPDF } = require('jspdf');
const chalk = require('chalk');

function registerExportHandlers(channel, pgClient, oracleConnection, dbType, secretToken, projectId, configData, supabase) {
  // Configured local download path
  const baseDownloadPath = configData.downloadPath || path.join(require('os').homedir(), 'Downloads', 'MetaBuilderExports');
  
  if (!fs.existsSync(baseDownloadPath)) {
    fs.mkdirSync(baseDownloadPath, { recursive: true });
  }

  // 1. Ouvinte para exportação local (Gera o arquivo localmente)
  channel.on('broadcast', { event: 'export_job_start' }, async (payload) => {
    const { jobId, token, sql, params, fileType, viewName, workspaceSlug, projectSlug } = payload.payload;

    if (token !== secretToken) {
      console.log(chalk.red(`[ BLOQUEADO ] Export job negado por token inválido. (Job ${jobId})`));
      return;
    }

    console.log(chalk.yellow(`[ EXPORT ] Gerando arquivo localmente para o Job ${jobId}...`));

    try {
      // Step 1: Execute query locally
      let rows = [];
      if (dbType === 'oracle') {
        const oraRes = await oracleConnection.execute(sql, params || [], { outFormat: require('oracledb').OUT_FORMAT_OBJECT });
        rows = oraRes.rows || [];
      } else {
        const result = await pgClient.query(sql, params || []);
        rows = result.rows || [];
      }

      console.log(chalk.green(`[ EXPORT ] Query retornou ${rows.length} registros.`));

      // Step 2: Format data into Buffer
      let buffer;
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const ms = Date.now().toString().slice(-4);
      const cleanViewName = (viewName || 'export').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const wSlug = workspaceSlug || 'workspace';
      const pSlug = projectSlug || 'project';
      const fileName = `${wSlug}_${pSlug}_${cleanViewName}_${timestamp}${ms}.${fileType}`;
      const localFilePath = path.join(baseDownloadPath, fileName);

      if (fileType === 'xlsx') {
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
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Dados Exportados');
        buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      } 
      else if (fileType === 'csv') {
        if (rows.length === 0) {
          buffer = Buffer.from('', 'utf-8');
        } else {
          const headers = Object.keys(rows[0]).filter(k => k !== '_key' && k !== '_details');
          const csvHeaders = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
          const csvRows = rows.map(row => headers.map(h => {
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
      else {
        // Fallback for unsupported formats in this quick implementation
        buffer = Buffer.from('Unsupported format on CLI', 'utf-8');
      }

      // Step 3: Save to local disk
      fs.writeFileSync(localFilePath, buffer);
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

    if (!fs.existsSync(localPath)) {
       console.log(chalk.red(`[ STREAM ] Arquivo não encontrado: ${localPath}`));
       await channel.send({ type: 'broadcast', event: eventName, payload: { error: 'Arquivo deletado ou não encontrado no servidor corporativo.' }});
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
         await channel.send({
           type: 'broadcast',
           event: eventName,
           payload: { chunk: chunkBase64, isLast: false }
         });
         // Resume stream after sending
         readStream.resume();
       } catch (err) {
         console.error(chalk.red(`[ STREAM ] Erro enviando chunk:`), err.message);
         readStream.destroy(err);
       }
    });

    readStream.on('end', async () => {
       console.log(chalk.green(`[ STREAM ] Concluído para Job ${jobId}.`));
       await channel.send({
         type: 'broadcast',
         event: eventName,
         payload: { isLast: true }
       });
    });

    readStream.on('error', async (err) => {
       console.error(chalk.red(`[ STREAM ] Erro de leitura no HD:`), err.message);
       await channel.send({ type: 'broadcast', event: eventName, payload: { error: 'Erro ao ler arquivo do HD corporativo.' }});
    });
  });
  // 3. Ouvinte para exclusão local
  channel.on('broadcast', { event: 'delete_export_file' }, async (payloadEvent) => {
    const { localPath } = payloadEvent.payload;
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
