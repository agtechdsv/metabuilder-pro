const chalk = require('chalk');
const axios = require('axios');
const oracledb = require('oracledb');
const cron = require('node-cron');

class BpmEngine {
  constructor(supabase, pgClient, oracleConnection, dbType, project, apiUrl) {
    this.supabase = supabase;
    this.pgClient = pgClient;
    this.oracleConnection = oracleConnection;
    this.dbType = dbType;
    this.project = project;
    this.apiUrl = apiUrl || 'http://localhost:3000'; // Fallback se não definido
    this.workflows = [];
    this.models = [];
    this.scheduledJobs = [];
  }

  async init() {
    console.log(chalk.blue('\n[BPM] Inicializando motor de automações...'));
    await this.syncWorkflows();
    await this.syncModels();

    // Inscrição para atualizações em tempo real
    this.supabase
      .channel('bpm-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bpm_workflows', filter: `project_id=eq.${this.project.id}` },
        () => {
          console.log(chalk.yellow('\n[BPM] Mudança detectada nos fluxos. Sincronizando...'));
          this.syncWorkflows();
        }
      )
      .subscribe();
      
    console.log(chalk.green(`[BPM] Motor rodando. Escutando ${this.workflows.length} fluxos ativos.\n`));
  }

  async syncWorkflows() {
    const { data } = await this.supabase
      .from('bpm_workflows')
      .select('id, name, flow_data')
      .eq('project_id', this.project.id)
      .eq('is_active', true)
      .not('flow_data', 'is', null);

    this.workflows = data || [];
    this.clearScheduledJobs();
    this.initScheduledJobs();
  }

  clearScheduledJobs() {
    for (const job of this.scheduledJobs) {
      if (job && typeof job.stop === 'function') {
        job.stop();
      }
    }
    this.scheduledJobs = [];
    console.log(chalk.gray(`[BPM] Todos os agendamentos antigos foram limpos.`));
  }

  initScheduledJobs() {
    let cronCount = 0;
    
    for (const flow of this.workflows) {
      const flowData = flow.flow_data;
      if (!flowData || !flowData.nodes) continue;

      const triggerNodes = flowData.nodes.filter(n => n.type === 'trigger');
      for (const triggerNode of triggerNodes) {
        let rawTypes = triggerNode.data?.triggerType || [];
        if (typeof rawTypes === 'string') rawTypes = [rawTypes];
        const triggerTypes = rawTypes.map(t => String(t).toUpperCase());

        if (triggerTypes.includes('SCHEDULED')) {
          const rawSchedules = triggerNode.data?.triggerSchedules || [];
          
          for (const sched of rawSchedules) {
            let cronStr = '';
            
            if (sched.type === 'recurring') {
              // days: [0, 1, 2] (Dom, Seg, Ter)
              const days = (sched.days && sched.days.length > 0) ? sched.days.join(',') : '*';
              const time = sched.time || '00:00';
              const [hour, min] = time.split(':');
              
              cronStr = `${min || '0'} ${hour || '0'} * * ${days}`;
            } else if (sched.type === 'once') {
              // dateTime: "2026-06-04T18:30"
              const dt = new Date(sched.dateTime);
              if (!isNaN(dt.getTime())) {
                const min = dt.getMinutes();
                const hour = dt.getHours();
                const day = dt.getDate();
                const month = dt.getMonth() + 1;
                cronStr = `${min} ${hour} ${day} ${month} *`;
              }
            }

            if (cronStr) {
              const job = cron.schedule(cronStr, async () => {
                console.log(chalk.cyan(`\n[BPM] ⏰ Agendamento disparado para o fluxo "${flow.name}"!`));
                const triggerTable = this.getModelTable(triggerNode.data?.triggerModelId);
                try {
                  await this.traverseGraph(flowData, triggerNode, triggerTable || 'global', {});
                } catch(e) {
                  console.error(chalk.red(`[BPM] Falha na execução do fluxo agendado ${flow.name}:`), e);
                }
              });
              
              this.scheduledJobs.push(job);
              cronCount++;
            }
          }
        }
      }
    }
    
    if (cronCount > 0) {
      console.log(chalk.green(`[BPM] ${cronCount} gatilho(s) agendado(s) configurado(s) com sucesso.`));
    }
  }

  async syncModels() {
    const { data, error } = await this.supabase
      .from('models')
      .select('id, db_table_name, display_name')
      .eq('project_id', this.project.id);
    
    if (error) {
       console.error(chalk.red('[BPM-DEBUG] Erro ao sincronizar models:'), error);
    }
    this.models = data || [];
    console.log(chalk.gray(`[BPM-DEBUG] syncModels carregou ${this.models.length} modelos para o projeto ${this.project.id}`));
  }

  getModelTable(modelId) {
    const model = this.models.find(m => m.id === modelId);
    console.log(chalk.gray(`[BPM-DEBUG] getModelTable chamou com modelId=${modelId}. Encontrado=${!!model}`));
    return model ? (model.db_table_name || model.display_name) : null;
  }

  async replaceVariables(text, triggerTable, triggerData, actionTable = null, actionData = null) {
    if (typeof text !== 'string') return text;
    
    // 1. Encontrar quais tabelas extras estão sendo referenciadas
    const regex = /\{\{([^}]+)\}\}/g;
    let match;
    const extraTables = new Set();
    while ((match = regex.exec(text)) !== null) {
      const parts = match[1].split('.');
      if (parts.length === 2) {
         const table = parts[0];
         if (table !== triggerTable && table !== actionTable) {
            extraTables.add(table);
         }
      }
    }

    // 2. Buscar as foreign keys na tabela de trigger
    const extraData = {};
    for (const table of extraTables) {
       let fkName = table.endsWith('s') ? table.slice(0, -1) + '_id' : table + '_id';
       
       // Fallbacks se o fkName padrão não existir em triggerData
       let fkValue = triggerData ? triggerData[fkName] : null;
       
       if (!fkValue) {
          if (triggerData && triggerData[`${table}_id`]) { fkName = `${table}_id`; fkValue = triggerData[fkName]; }
          else if (triggerData && triggerData['id_' + table]) { fkName = 'id_' + table; fkValue = triggerData[fkName]; }
          else if (actionData && actionData[fkName]) { fkValue = actionData[fkName]; }
          else if (actionData && actionData[`${table}_id`]) { fkName = `${table}_id`; fkValue = actionData[fkName]; }
          else if (actionData && actionData['id_' + table]) { fkName = 'id_' + table; fkValue = actionData[fkName]; }
       }

       console.log(chalk.gray(`[BPM-DEBUG] Tentando resolver tabela extra '${table}'. Usando fkName='${fkName}'. Valor='${fkValue}'`));

       if (fkValue) {
          try {
             const sql = `SELECT * FROM "${table}" WHERE "id" = $1 LIMIT 1`;
             const rows = await this.executeQuery(sql, [fkValue]);
             if (rows.length > 0) {
                extraData[table] = rows[0];
                console.log(chalk.gray(`[BPM-DEBUG] Dados extras carregados para '${table}' com sucesso!`));
             } else {
                console.log(chalk.gray(`[BPM-DEBUG] Nenhum registro encontrado na tabela '${table}' com id=${triggerData[fkName]}`));
             }
          } catch(e) {
             console.log(chalk.gray(`[BPM-DEBUG] Erro ao buscar FK ${fkName} na tabela ${table}: ${e.message}`));
          }
       } else {
          console.log(chalk.gray(`[BPM-DEBUG] FK '${fkName}' não encontrada nos dados de origem: ${JSON.stringify(triggerData)}`));
       }
    }

    // 3. Substituir no texto final
    return text.replace(regex, (match, path) => {
      const parts = path.split('.');
      if (parts.length === 2) {
        const table = parts[0];
        const field = parts[1];
        if (table === triggerTable && triggerData && triggerData[field] !== undefined) {
          return triggerData[field];
        }
        if (table === actionTable && actionData && actionData[field] !== undefined) {
          return actionData[field];
        }
        if (extraData[table] && extraData[table][field] !== undefined) {
          return extraData[table][field];
        }
      }
      return match; // Mantém original se não achar
    });
  }

  async executeQuery(sql, params = []) {
    if (this.dbType === 'oracle') {
      const result = await this.oracleConnection.execute(sql, params, { autoCommit: true, outFormat: oracledb.OUT_FORMAT_OBJECT });
      return result.rows || [];
    } else {
      const result = await this.pgClient.query(sql, params);
      return result.rows || [];
    }
  }

  evaluateCondition(node, triggerTable, triggerData) {
    const groups = node.data?.conditionGroups || [];
    if (groups.length === 0) return true;

    // Avalia o primeiro grupo (simplificado para MVP)
    const group = groups[0];
    const rules = group.rules || [];
    
    let isGroupTrue = group.logic === 'AND' ? true : false;

    for (const rule of rules) {
      const field = rule.field;
      const operator = rule.operator;
      let expectedValue = rule.value;
      const actualValue = triggerData[field];

      let isRuleTrue = false;
      
      // Converte expectedValue se for numérico e actualValue for número
      if (typeof actualValue === 'number') {
         expectedValue = Number(expectedValue);
      } else if (actualValue instanceof Date) {
         // Lógica simplificada de data
      } else {
         expectedValue = String(expectedValue);
      }

      const actualStr = String(actualValue);

      switch (operator) {
        case '==': isRuleTrue = actualStr == String(expectedValue); break;
        case '!=': isRuleTrue = actualStr != String(expectedValue); break;
        case '>': isRuleTrue = Number(actualValue) > Number(expectedValue); break;
        case '<': isRuleTrue = Number(actualValue) < Number(expectedValue); break;
        case '>=': isRuleTrue = Number(actualValue) >= Number(expectedValue); break;
        case '<=': isRuleTrue = Number(actualValue) <= Number(expectedValue); break;
      }
      
      console.log(chalk.cyan(`[BPM-CONDITION] Regra: Campo '${field}' (${actualValue}) ${operator} Valor Esperado (${expectedValue}) => Resultado: ${isRuleTrue}`));

      if (group.logic === 'AND') {
        isGroupTrue = isGroupTrue && isRuleTrue;
      } else {
        isGroupTrue = isGroupTrue || isRuleTrue;
      }
    }

    console.log(chalk.cyan(`[BPM-CONDITION] Grupo Final resultou em: ${isGroupTrue}`));
    return isGroupTrue;
  }

  async buildFilters(actionFilters, triggerTable, triggerData) {
    if (!actionFilters || actionFilters.length === 0) return { where: '', params: [] };

    const clauses = [];
    const params = [];
    let paramIndex = 1;

    for (const filt of actionFilters) {
      if (!filt.field) continue;
      const field = `"${filt.field.replace(/[^a-zA-Z0-9_]/g, '')}"`;
      const op = filt.operator === '==' ? '=' : filt.operator;
      const val = await this.replaceVariables(filt.value, triggerTable, triggerData);
      
      if (this.dbType === 'oracle') {
        clauses.push(`${field} ${op} :${paramIndex}`);
        params.push(val);
      } else {
        clauses.push(`${field} ${op} $${paramIndex}`);
        params.push(val);
      }
      paramIndex++;
    }

    if (clauses.length === 0) return { where: '', params: [] };
    return { where: `WHERE ${clauses.join(' AND ')}`, params };
  }

  async runNodeAction(node, triggerTable, triggerData) {
    const data = node.data || {};
    const actionTable = data.actionModelId ? this.getModelTable(data.actionModelId) : null;
    
    // Para update, a tabela é obrigatória. Para email, depende do tipo de destinatário.
    if (data.actionType === 'update' && !actionTable) {
      console.log(chalk.red(`[BPM] Erro: Tabela alvo do UPDATE não encontrada no dicionário.`));
      return;
    }

    const { where, params } = await this.buildFilters(data.actionFilters, triggerTable, triggerData);

    if (data.actionType === 'update') {
      if (!where) {
         console.log(chalk.yellow(`[BPM] Cuidado: UPDATE ignorado por falta de filtros de segurança.`));
         return; // Evita update sem WHERE global
      }
      const fieldsToUpdate = data.actionFields || [];
      if (fieldsToUpdate.length === 0) return;

      const setClauses = [];
      const updateParams = [];
      let pIdx = 1;

      for (const f of fieldsToUpdate) {
        if (!f.field) continue;
        const val = await this.replaceVariables(f.value, triggerTable, triggerData);
        if (this.dbType === 'oracle') {
          setClauses.push(`"${f.field}" = :${pIdx}`);
        } else {
          setClauses.push(`"${f.field}" = $${pIdx}`);
        }
        updateParams.push(val);
        pIdx++;
      }

      // Adiciona os parametros do WHERE no final
      const finalParams = [...updateParams];
      let finalWhere = where;
      if (this.dbType === 'oracle') {
        for (const wp of params) {
          finalWhere = finalWhere.replace(`:${pIdx - updateParams.length}`, `:${pIdx}`);
          finalParams.push(wp);
          pIdx++;
        }
      } else {
        for (const wp of params) {
          finalWhere = finalWhere.replace(`$${pIdx - updateParams.length}`, `$${pIdx}`);
          finalParams.push(wp);
          pIdx++;
        }
      }

      const sql = `UPDATE "${actionTable}" SET ${setClauses.join(', ')} ${finalWhere}`;
      console.log(chalk.blue(`[BPM] Executando Update: ${sql} | Parametros: ${JSON.stringify(finalParams)}`));
      await this.executeQuery(sql, finalParams);
    } 
    else if (data.actionType === 'insert') {
      const fieldsToInsert = data.actionFields || [];
      if (fieldsToInsert.length === 0) {
        console.log(chalk.yellow(`[BPM] Cuidado: INSERT ignorado pois não há campos mapeados.`));
        return;
      }

      const columns = [];
      const values = [];
      const insertParams = [];
      let pIdx = 1;

      for (const f of fieldsToInsert) {
        if (!f.field) continue;
        const val = await this.replaceVariables(f.value, triggerTable, triggerData);
        columns.push(`"${f.field}"`);
        if (this.dbType === 'oracle') {
          values.push(`:${pIdx}`);
        } else {
          values.push(`$${pIdx}`);
        }
        insertParams.push(val);
        pIdx++;
      }

      const sql = `INSERT INTO "${actionTable}" (${columns.join(', ')}) VALUES (${values.join(', ')})`;
      console.log(chalk.blue(`[BPM] Executando Insert: ${sql} | Parametros: ${JSON.stringify(insertParams)}`));
      await this.executeQuery(sql, insertParams);
    }
    else if (data.actionType === 'delete') {
      if (!where) {
         console.log(chalk.yellow(`[BPM] Cuidado: DELETE ignorado por falta de filtros de segurança.`));
         return; // Evita delete sem WHERE global
      }

      const sql = `DELETE FROM "${actionTable}" ${where}`;
      console.log(chalk.red(`[BPM] Executando Delete: ${sql} | Parametros: ${JSON.stringify(params)}`));
      await this.executeQuery(sql, params);
    } 
    else if (data.actionType === 'webhook') {
      let finalUrl = await this.replaceVariables(data.webhookUrl || '', triggerTable, triggerData);
      const method = (data.webhookMethod || 'POST').toUpperCase();
      let finalHeadersStr = await this.replaceVariables(data.webhookHeaders || '', triggerTable, triggerData);
      let finalBodyStr = await this.replaceVariables(data.webhookBody || '', triggerTable, triggerData);
      
      if (!finalUrl) {
        console.log(chalk.yellow(`[BPM] Cuidado: Webhook ignorado por falta de URL.`));
        return;
      }

      let headers = {};
      try {
        if (finalHeadersStr.trim()) headers = JSON.parse(finalHeadersStr);
      } catch(e) {
        console.log(chalk.yellow(`[BPM] Falha ao fazer parse do Webhook Headers (JSON inválido). Usando vazio.`));
      }

      let bodyData = null;
      try {
        if (finalBodyStr.trim()) bodyData = JSON.parse(finalBodyStr);
      } catch(e) {
        bodyData = finalBodyStr; // Manda como texto plano se não for JSON válido
      }

      console.log(chalk.cyan(`[BPM] Disparando Webhook [${method}] para: ${finalUrl}`));
      
      try {
        const response = await axios({
          method: method,
          url: finalUrl,
          headers: headers,
          data: ['POST', 'PUT', 'PATCH'].includes(method) ? bodyData : undefined
        });
        console.log(chalk.green(`[ OK ] Webhook Retornou: ${response.status} ${response.statusText}`));
      } catch (webhookErr) {
        console.log(chalk.red(`[ ERRO ] Falha no Webhook: ${webhookErr.message}`));
      }
    }
    else if (data.actionType === 'email') {
      // 1. Busca os registros alvo para ler o e-mail ou variáveis
      let targetRows = [null]; // Fallback se não tiver tabela alvo, roda 1 vez
      
      if (actionTable && where) {
         const sql = `SELECT * FROM "${actionTable}" ${where}`;
         console.log(chalk.blue(`[BPM] Buscando alvos para e-mail: ${sql} | ${JSON.stringify(params)}`));
         targetRows = await this.executeQuery(sql, params);
      }

      if (data.emailRecipientType === 'table' && targetRows.length === 0) {
        console.log(chalk.yellow(`[BPM] Nenhum registro encontrado para disparar o e-mail.`));
        return;
      }

      for (const targetRow of targetRows) {
        const subject = await this.replaceVariables(data.actionSubject, triggerTable, triggerData, actionTable, targetRow);
        const body = await this.replaceVariables(data.actionBody, triggerTable, triggerData, actionTable, targetRow);
        
        let to = '';
        if (data.emailRecipientType === 'table' && targetRow && data.actionEmailField) {
          to = targetRow[data.actionEmailField];
        } else if (data.emailRecipientType === 'custom') {
          to = await this.replaceVariables(data.customEmailField, triggerTable, triggerData);
        } else if (data.emailRecipientType === 'system') {
          const userIds = [];
          if (data.emailGroupsUsers) {
             for (const groupUsers of Object.values(data.emailGroupsUsers)) {
                if (Array.isArray(groupUsers)) {
                   userIds.push(...groupUsers);
                }
             }
          }
          
          if (userIds.length > 0) {
             try {
               const { data: authConfig } = await this.supabase.from('project_auth_config').select('*').eq('project_id', this.project.id).maybeSingle();
               if (authConfig && authConfig.db_table_name) {
                 const tableName = authConfig.db_table_name;
                 const emailField = authConfig.db_email_column || 'email';
                 const placeholders = userIds.map((_, i) => this.dbType === 'oracle' ? `:${i+1}` : `$${i+1}`).join(',');
                 const sql = `SELECT "${emailField}" FROM "${tableName}" WHERE "id" IN (${placeholders})`;
                 const rows = await this.executeQuery(sql, userIds);
                 to = rows.map(r => r[emailField]).filter(Boolean).join(',');
               }
             } catch(e) {
               console.error('[BPM] Erro ao buscar emails dos grupos:', e.message);
             }
          }
          
          let specificEmails = '';
          if (data.emailSpecificUsers) {
             specificEmails = await this.replaceVariables(data.emailSpecificUsers, triggerTable, triggerData, actionTable, targetRow);
          }
          if (specificEmails) {
             to = to ? `${to},${specificEmails}` : specificEmails;
          }
          
          if (!to) {
             to = process.env.SMTP_USER || 'contato@metabuilderpro.com';
          }
        }

        if (!to) {
          console.log(chalk.red(`[BPM] E-mail não enviado: Destinatário não encontrado.`));
          continue;
        }

        console.log(chalk.magenta(`[BPM] Disparando e-mail via API para: ${to}`));
        try {
          await axios.post(`${this.apiUrl}/api/automations/email`, {
            project_id: this.project.id,
            token: this.project.secret_token,
            to,
            subject,
            html: body.replace(/\n/g, '<br/>')
          });
          console.log(chalk.green(`[BPM] E-mail disparado com sucesso!`));
        } catch (err) {
          console.error(chalk.red(`[BPM] Erro ao enviar e-mail:`, err.response?.data || err.message));
        }
      }
    }
  }

  async traverseGraph(flowData, startNode, triggerTable, triggerData) {
    const queue = [startNode];
    let maxSteps = 100;

    while (queue.length > 0 && maxSteps > 0) {
      maxSteps--;
      const currentNode = queue.shift();

      if (currentNode.type === 'condition') {
        const isTrue = this.evaluateCondition(currentNode, triggerTable, triggerData);
        const edges = flowData.edges.filter(e => e.source === currentNode.id && e.sourceHandle === String(isTrue));
        
        for (const edge of edges) {
           const targetNode = flowData.nodes.find(n => n.id === edge.target);
           if (targetNode) queue.push(targetNode);
        }
      } 
      else if (currentNode.type === 'action') {
        await this.runNodeAction(currentNode, triggerTable, triggerData);
        const edges = flowData.edges.filter(e => e.source === currentNode.id);
        
        for (const edge of edges) {
           const targetNode = flowData.nodes.find(n => n.id === edge.target);
           if (targetNode) queue.push(targetNode);
        }
      }
      else {
         // trigger node
         const edges = flowData.edges.filter(e => e.source === currentNode.id);
         for (const edge of edges) {
            const targetNode = flowData.nodes.find(n => n.id === edge.target);
            if (targetNode) queue.push(targetNode);
         }
      }
    }
  }

  async processEvent(tableName, actionType, rowData) {
    console.log(chalk.gray(`[BPM-DEBUG] processEvent chamado: tableName=${tableName}, actionType=${actionType}`));
    
    if (!this.workflows || this.workflows.length === 0) {
      console.log(chalk.gray(`[BPM-DEBUG] Nenhum fluxo ativo encontrado.`));
      return;
    }

    for (const flow of this.workflows) {
      const flowData = flow.flow_data;
      if (!flowData || !flowData.nodes) {
         console.log(chalk.gray(`[BPM-DEBUG] Fluxo ${flow.name} sem flowData válido.`));
         continue;
      }

      const triggerNodes = flowData.nodes.filter(n => n.type === 'trigger');
      console.log(chalk.gray(`[BPM-DEBUG] Fluxo ${flow.name} tem ${triggerNodes.length} trigger(s).`));
      
      for (const triggerNode of triggerNodes) {
        let rawTypes = triggerNode.data?.triggerType || [];
        if (typeof rawTypes === 'string') rawTypes = [rawTypes];
        
        const triggerTypes = rawTypes.map(t => String(t).toUpperCase());
        const triggerTable = this.getModelTable(triggerNode.data?.triggerModelId);

        console.log(chalk.gray(`[BPM-DEBUG] Avaliando Trigger: table=${triggerTable} (esperado=${tableName}), types=[${triggerTypes.join(',')}] (esperado=${actionType})`));

        if (triggerTable === tableName && triggerTypes.includes(actionType.toUpperCase())) {
          console.log(chalk.cyan(`[BPM] Disparando fluxo "${flow.name}" para a tabela ${tableName}...`));
          try {
             await this.traverseGraph(flowData, triggerNode, tableName, rowData);
          } catch(e) {
             console.error(chalk.red(`[BPM] Falha na execução do fluxo ${flow.name}:`, e));
          }
        }
      }
    }
  }

  async processCustomAction(workflowIds, tableName, rowData) {
    console.log(chalk.gray(`[BPM-DEBUG] processCustomAction chamado para fluxos: ${workflowIds.join(', ')}`));
    
    if (!this.workflows || this.workflows.length === 0) {
      console.log(chalk.gray(`[BPM-DEBUG] Nenhum fluxo ativo encontrado.`));
      return;
    }

    const targetedWorkflows = this.workflows.filter(w => workflowIds.includes(w.id));
    if (targetedWorkflows.length === 0) {
       console.log(chalk.gray(`[BPM-DEBUG] Nenhum dos fluxos solicitados está ativo ou existe.`));
       return;
    }

    for (const flow of targetedWorkflows) {
      const flowData = flow.flow_data;
      if (!flowData || !flowData.nodes) continue;
      
      const triggerNodes = flowData.nodes.filter(n => n.type === 'trigger');
      const triggerNode = triggerNodes.length > 0 ? triggerNodes[0] : null;

      if (!triggerNode) {
         console.log(chalk.gray(`[BPM-DEBUG] Fluxo ${flow.name} não possui nó de gatilho.`));
         continue;
      }

      console.log(chalk.cyan(`[BPM] Disparando fluxo customizado "${flow.name}" via Ação de Interface...`));
      try {
         // Garantir que temos o rowData completo caso a interface tenha enviado parcial
         let fullRowData = { ...rowData };
         if (fullRowData && fullRowData.id) {
            try {
               const sql = `SELECT * FROM "${tableName}" WHERE "id" = $1 LIMIT 1`;
               const rows = await this.executeQuery(sql, [fullRowData.id]);
               if (rows.length > 0) fullRowData = { ...fullRowData, ...rows[0] };
            } catch(e) {}
         }

         await this.traverseGraph(flowData, triggerNode, tableName, fullRowData);
      } catch(e) {
         console.error(chalk.red(`[BPM] Falha na execução customizada do fluxo ${flow.name}:`), e);
      }
    }
  }
}

module.exports = { BpmEngine };
