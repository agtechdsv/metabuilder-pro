const chalk = require('chalk');
const axios = require('axios');
const oracledb = require('oracledb');

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
  }

  async syncModels() {
    const { data } = await this.supabase
      .from('models')
      .select('id, db_table_name, name')
      .eq('project_id', this.project.id);
    this.models = data || [];
  }

  getModelTable(modelId) {
    const model = this.models.find(m => m.id === modelId);
    return model ? (model.db_table_name || model.name) : null;
  }

  replaceVariables(text, triggerTable, triggerData, actionTable = null, actionData = null) {
    if (typeof text !== 'string') return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      // Ex: orders.id
      const parts = path.split('.');
      if (parts.length === 2) {
        const table = parts[0];
        const field = parts[1];
        if (table === triggerTable && triggerData[field] !== undefined) {
          return triggerData[field];
        }
        if (actionTable && table === actionTable && actionData && actionData[field] !== undefined) {
          return actionData[field];
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

      if (group.logic === 'AND') {
        isGroupTrue = isGroupTrue && isRuleTrue;
      } else {
        isGroupTrue = isGroupTrue || isRuleTrue;
      }
    }

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
      const val = this.replaceVariables(filt.value, triggerTable, triggerData);
      
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
    const actionTable = this.getModelTable(data.actionModelId);
    
    if (!actionTable) {
      console.log(chalk.red(`[BPM] Erro: Tabela alvo da ação não encontrada no dicionário de dados.`));
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
        const val = this.replaceVariables(f.value, triggerTable, triggerData);
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
    else if (data.actionType === 'email') {
      // 1. Busca os registros alvo para ler o e-mail ou variáveis
      let targetRows = [null]; // Fallback se não tiver tabela alvo, roda 1 vez
      
      if (where) {
         const sql = `SELECT * FROM "${actionTable}" ${where}`;
         console.log(chalk.blue(`[BPM] Buscando alvos para e-mail: ${sql} | ${JSON.stringify(params)}`));
         targetRows = await this.executeQuery(sql, params);
      }

      if (targetRows.length === 0) {
        console.log(chalk.yellow(`[BPM] Nenhum registro encontrado para disparar o e-mail.`));
        return;
      }

      for (const targetRow of targetRows) {
        const subject = this.replaceVariables(data.actionSubject, triggerTable, triggerData, actionTable, targetRow);
        const body = this.replaceVariables(data.actionBody, triggerTable, triggerData, actionTable, targetRow);
        
        let to = '';
        if (data.emailRecipientType === 'table' && targetRow && data.actionEmailField) {
          to = targetRow[data.actionEmailField];
        } else if (data.emailRecipientType === 'custom') {
          to = this.replaceVariables(data.customEmailField, triggerTable, triggerData);
        } else if (data.emailRecipientType === 'system') {
          // Simplificado: idealmente buscaria os usuários do grupo no projeto
          to = 'admin@exemplo.com'; //TODO: Mapear sistema real de grupos
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
    let currentNode = startNode;
    let maxSteps = 20;

    while (currentNode && maxSteps > 0) {
      maxSteps--;

      if (currentNode.type === 'condition') {
        const isTrue = this.evaluateCondition(currentNode, triggerTable, triggerData);
        const edges = flowData.edges.filter(e => e.source === currentNode.id && e.sourceHandle === String(isTrue));
        
        if (edges.length > 0) {
          currentNode = flowData.nodes.find(n => n.id === edges[0].target);
        } else {
          currentNode = null;
        }
      } 
      else if (currentNode.type === 'action') {
        await this.runNodeAction(currentNode, triggerTable, triggerData);
        const edges = flowData.edges.filter(e => e.source === currentNode.id);
        
        if (edges.length > 0) {
          currentNode = flowData.nodes.find(n => n.id === edges[0].target);
        } else {
          currentNode = null;
        }
      }
      else {
         // trigger node
         const edges = flowData.edges.filter(e => e.source === currentNode.id);
         if (edges.length > 0) {
           currentNode = flowData.nodes.find(n => n.id === edges[0].target);
         } else {
           currentNode = null;
         }
      }
    }
  }

  async processEvent(tableName, actionType, rowData) {
    if (!this.workflows || this.workflows.length === 0) return;

    for (const flow of this.workflows) {
      const flowData = flow.flow_data;
      if (!flowData || !flowData.nodes) continue;

      const triggerNodes = flowData.nodes.filter(n => n.type === 'trigger');
      for (const triggerNode of triggerNodes) {
        const triggerTypes = triggerNode.data?.triggerType || [];
        const triggerTable = this.getModelTable(triggerNode.data?.triggerModelId);

        if (triggerTable === tableName && triggerTypes.includes(actionType)) {
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
}

module.exports = { BpmEngine };
