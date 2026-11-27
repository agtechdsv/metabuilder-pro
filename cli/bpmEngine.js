const chalk = require('chalk');
const axios = require('axios');
const oracledb = require('oracledb');
const cron = require('node-cron');
const { wrapEmailInTemplate } = require('./emailTemplates');
const { t } = require('./i18n');
const { BpmCore } = require('./bpmCore');
const { resolveSystemRecipientEmails, resolveSystemRecipientIds } = require('./recipients');
const { createDownloadDelivery } = require('./automationDownload');
const { buildAttachment } = require('./attachments');

/**
 * Casca do motor de BPM para o Agente CLI: a lógica dos fluxos está em bpmCore.js (a mesma que vai no app exportado);
 * aqui só se ligam as PORTAS à plataforma: Supabase (fluxos e modelos), banco do cliente, API de e-mail e de execuções.
 */
class BpmEngine {
  /** `options.downloadPath`: pasta de exportações do Agente (onde a ação Download grava os arquivos). */
  constructor(supabase, pgClient, oracleConnection, dbType, project, apiUrl, options = {}) {
    this.supabase = supabase;
    this.pgClient = pgClient;
    this.oracleConnection = oracleConnection;
    this.dbType = dbType;
    this.project = project;
    this.apiUrl = apiUrl || 'http://localhost:3000'; // Fallback se não definido
    this.models = [];

    const log = (color, prefix) => (msg) => console.log(chalk[color](msg));
    this.core = new BpmCore({
      db: { dialect: dbType === 'oracle' ? 'oracle' : 'postgres', query: (sql, params) => this.rawQuery(sql, params) },
      models: {
        tableOf: (id) => this.tableOfModel(id),
        isKnownTable: (name) => this.isKnownModelTable(name),
      },
      http: {
        request: async (cfg) => {
          try {
            return await axios(cfg);
          } catch (e) {
            const err = new Error(e.message);
            if (e.response && e.response.status) err.status = e.response.status;
            throw err;
          }
        },
      },
      mail: {
        send: async ({ to, subject, body, template, attachments }) => {
          try {
            await axios.post(`${this.apiUrl}/api/automations/email`, {
              project_id: this.project.id,
              token: this.project.secret_token,
              to,
              subject,
              html: wrapEmailInTemplate(template, body),
              // planilha (xlsx) ou CSV do resultado de uma "Consultar dados"
              ...(attachments && attachments.length ? { attachments: attachments.map((a) => buildAttachment(a)) } : {}),
            }, { timeout: 60000, maxBodyLength: 8 * 1024 * 1024 });
          } catch (err) {
            throw new Error(err.response?.data?.error || err.message);
          }
        },
        fallbackTo: () => process.env.SMTP_USER || 'contato@metabuilderpro.com',
      },
      recipients: { resolveSystem: (data) => this.resolveSystemRecipients(data), resolveIds: (data) => this.resolveSystemRecipientIds(data) },
      // ação "Download": o arquivo fica na pasta de exportações deste Agente e o servidor registra a linha na Central de Downloads de cada destinatário
      downloads: {
        deliver: createDownloadDelivery({
          apiBase: this.apiUrl, projectId: this.project.id, secretToken: this.project.secret_token, downloadPath: options.downloadPath,
          log: (m) => console.log(chalk.gray('[BPM] ' + m)),
        }),
      },
      // "Aguardar aprovação": as tarefas moram no banco do cliente, que só o Agente alcança (o app exportado não liga isto)
      features: { approvals: true },
      ids: { next: () => require('crypto').randomUUID() },
      scheduler: { schedule: (expr, fn) => cron.schedule(expr, fn) },
      runs: {
        report: async (run) => {
          try {
            await axios.post(`${this.apiUrl}/api/automations/runs`, { project_id: this.project.id, token: this.project.secret_token, ...run }, { timeout: 8000 });
          } catch (err) {
            throw new Error(err.response?.data?.error || err.message);
          }
        },
      },
      log: {
        debug: log('gray'),
        info: log('cyan'),
        ok: log('green'),
        warn: log('yellow'),
        error: log('red'),
        sql: log('blue'),
        danger: log('red'),
        mail: log('magenta'),
      },
      verbose: true,
    });
  }

  get workflows() { return this.core.workflows; }

  async init() {
    console.log(chalk.blue('\n' + t('bpm_init')));
    await this.syncWorkflows();
    await this.syncModels();

    // Inscrição para atualizações em tempo real
    this.supabase
      .channel('bpm-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bpm_workflows', filter: `project_id=eq.${this.project.id}` },
        () => {
          console.log(chalk.yellow('\n' + t('bpm_flows_changed')));
          this.syncWorkflows();
        }
      )
      .subscribe();

    console.log(chalk.green(t('bpm_running', { count: this.workflows.length }) + '\n'));
  }

  /**
   * Fluxos ativos e modelos vêm do SERVIDOR (assinado com o secret_token): as tabelas têm RLS fechado
   * para a chave anon do CLI, que recebia 0 linhas sem erro. Ao falhar, mantém o que já tinha.
   */
  async fetchFromServer() {
    const res = await axios.post(`${this.apiUrl}/api/automations/workflows`, {
      project_id: this.project.id,
      token: this.project.secret_token,
    }, { timeout: 15000 });
    return res.data || {};
  }

  async syncWorkflows() {
    try {
      const data = await this.fetchFromServer();
      console.log(chalk.gray(t('bpm_schedules_cleared')));
      this.core.setWorkflows(data.workflows || []);
      if (Array.isArray(data.models)) this.models = data.models;
    } catch (err) {
      console.error(chalk.red('[BPM] Erro ao buscar os fluxos no servidor: ' + (err.response?.data?.error || err.message)));
    }
  }

  async syncModels() {
    try {
      const data = await this.fetchFromServer();
      this.models = data.models || [];
      if (!this.workflows.length && Array.isArray(data.workflows)) this.core.setWorkflows(data.workflows);
    } catch (err) {
      console.error(chalk.red('[BPM-DEBUG] Erro ao sincronizar models: ' + (err.response?.data?.error || err.message)));
    }
    console.log(chalk.gray(t('bpm_models_loaded', { count: this.models.length, projectId: this.project.id })));
  }

  async tableOfModel(modelId) {
    let model = this.models.find(m => m.id === modelId);
    if (!model) {
      await this.syncModels();
      model = this.models.find(m => m.id === modelId);
    }
    return model ? (model.db_table_name || model.display_name) : null;
  }

  async isKnownModelTable(name) {
    if (!this.models.length) await this.syncModels();
    return this.models.some(m => (m.db_table_name || m.display_name) === name);
  }

  async rawQuery(sql, params = []) {
    if (this.dbType === 'oracle') {
      const result = await this.oracleConnection.execute(sql, params, { autoCommit: true, outFormat: oracledb.OUT_FORMAT_OBJECT });
      return result.rows || [];
    }
    const result = await this.pgClient.query(sql, params);
    return result.rows || [];
  }

  /**
   * E-mails (separados por vírgula) dos usuários e grupos do sistema escolhidos no nó de e-mail.
   * A configuração de login, os grupos e os perfis vêm do SERVIDOR (assinado com o secret_token): as tabelas têm RLS fechado
   * para a chave anon do CLI, e antes disso o grupo resolvia vazio, em silêncio. Os membros dos grupos do cliente vêm do banco do cliente.
   */
  /** Configuração de login, grupos e perfis do projeto (vem do SERVIDOR; null se não deu para ler). */
  async fetchRecipientConfig() {
    let config = null;
    try {
      const res = await axios.post(`${this.apiUrl}/api/automations/recipients`, {
        project_id: this.project.id,
        token: this.project.secret_token,
      }, { timeout: 15000 });
      config = res.data || null;
    } catch (err) {
      console.error(chalk.red('[BPM] Erro ao buscar a configuração de destinatários no servidor: ' + (err.response?.data?.error || err.message)));
    }
    return config;
  }

  async resolveSystemRecipients(data) {
    return resolveSystemRecipientEmails({
      data,
      config: await this.fetchRecipientConfig(),
      dialect: this.dbType === 'oracle' ? 'oracle' : 'postgres',
      query: (sql, params) => this.rawQuery(sql, params),
      log: { warn: (m) => console.error(chalk.yellow(m)) },
    });
  }

  /** Ids (texto) dos usuários e grupos escolhidos no nó, para entregar arquivos na Central de Downloads de cada um. */
  async resolveSystemRecipientIds(data) {
    return resolveSystemRecipientIds({
      data,
      config: await this.fetchRecipientConfig(),
      dialect: this.dbType === 'oracle' ? 'oracle' : 'postgres',
      query: (sql, params) => this.rawQuery(sql, params),
      log: { warn: (m) => console.error(chalk.yellow(m)) },
    });
  }
  processEvent(tableName, actionType, rowData, oldRow, actor) { return this.core.processEvent(tableName, actionType, rowData, oldRow, actor); }
  processSyncEvent(tableName, actionType, rowData, oldRow, actor) { return this.core.processSyncEvent(tableName, actionType, rowData, oldRow, actor); }
  needsOldRow(tableName) { return this.core.needsOldRow(tableName); }
  processWebhook(workflowId, data) { return this.core.processWebhook(workflowId, data); }
  processCustomAction(workflowIds, tableName, rowData, actor) { return this.core.processCustomAction(workflowIds, tableName, rowData, actor); }
  approvalOp(action, data, actor) { return this.core.approvalOp(action, data, actor); }
}

module.exports = { BpmEngine };
