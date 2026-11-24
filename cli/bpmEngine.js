const chalk = require('chalk');
const axios = require('axios');
const oracledb = require('oracledb');
const cron = require('node-cron');
const { wrapEmailInTemplate } = require('./emailTemplates');
const { t } = require('./i18n');
const { BpmCore } = require('./bpmCore');

/**
 * Casca do motor de BPM para o Agente CLI: a lógica dos fluxos está em bpmCore.js (a mesma que vai no app exportado);
 * aqui só se ligam as PORTAS à plataforma: Supabase (fluxos e modelos), banco do cliente, API de e-mail e de execuções.
 */
class BpmEngine {
  constructor(supabase, pgClient, oracleConnection, dbType, project, apiUrl) {
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
        send: async ({ to, subject, body, template }) => {
          try {
            await axios.post(`${this.apiUrl}/api/automations/email`, {
              project_id: this.project.id,
              token: this.project.secret_token,
              to,
              subject,
              html: wrapEmailInTemplate(template, body),
            });
          } catch (err) {
            throw new Error(err.response?.data?.error || err.message);
          }
        },
        fallbackTo: () => process.env.SMTP_USER || 'contato@metabuilderpro.com',
      },
      recipients: { resolveSystem: (data) => this.resolveSystemRecipients(data) },
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

  async syncWorkflows() {
    const { data } = await this.supabase
      .from('bpm_workflows')
      .select('id, name, flow_data')
      .eq('project_id', this.project.id)
      .eq('is_active', true)
      .not('flow_data', 'is', null);

    console.log(chalk.gray(t('bpm_schedules_cleared')));
    this.core.setWorkflows(data || []);
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

  /** E-mails (separados por vírgula) dos usuários e grupos do sistema escolhidos no nó de e-mail. */
  async resolveSystemRecipients(data) {
    const userIds = [];
    if (data.emailGroupsUsers) {
      for (const [groupName, groupUsers] of Object.entries(data.emailGroupsUsers)) {
        if (Array.isArray(groupUsers)) {
          userIds.push(...groupUsers);
        } else if (groupUsers === 'all') {
          try {
            const { data: authConfig } = await this.supabase.from('project_auth_config').select('*').eq('project_id', this.project.id).maybeSingle();
            if (authConfig && authConfig.db_groups_table && authConfig.db_user_groups_table) {
              const groupsTable = authConfig.db_groups_table;
              const groupsNameCol = authConfig.db_groups_name_column || 'name';
              const userGroupsTable = authConfig.db_user_groups_table;
              const userGroupsUserCol = authConfig.db_user_groups_user_column || 'user_id';
              const userGroupsGroupCol = authConfig.db_user_groups_group_column || 'group_id';

              const ph = this.dbType === 'oracle' ? ':1' : '$1';
              const limit = this.dbType === 'oracle' ? 'FETCH FIRST 1 ROWS ONLY' : 'LIMIT 1';
              const groupRows = await this.rawQuery(`SELECT * FROM "${groupsTable}" WHERE "${groupsNameCol}" = ${ph} ${limit}`, [groupName]);
              if (groupRows.length > 0) {
                const groupId = groupRows[0].id || groupRows[0][groupsTable + '_id'] || groupRows[0]['id_' + groupsTable];
                if (groupId) {
                  const usersRows = await this.rawQuery(`SELECT "${userGroupsUserCol}" FROM "${userGroupsTable}" WHERE "${userGroupsGroupCol}" = ${ph}`, [groupId]);
                  userIds.push(...usersRows.map(r => r[userGroupsUserCol]));
                }
              }
            } else {
              const { data: role } = await this.supabase.from('project_roles').select('id').eq('project_id', this.project.id).eq('name', groupName).maybeSingle();
              if (role) {
                const { data: userRoles } = await this.supabase.from('project_user_roles').select('user_id').eq('role_id', role.id);
                if (userRoles) userIds.push(...userRoles.map(r => r.user_id));
              }
            }
          } catch (err) {
            console.error('[BPM] Erro ao resolver grupo "all":', err.message);
          }
        }
      }
    }

    if (userIds.length === 0) return '';
    try {
      const { data: authConfig } = await this.supabase.from('project_auth_config').select('*').eq('project_id', this.project.id).maybeSingle();
      if (authConfig && authConfig.db_table_name) {
        const tableName = authConfig.db_table_name;
        const emailField = authConfig.db_email_column || 'email';
        const placeholders = userIds.map((_, i) => this.dbType === 'oracle' ? `:${i + 1}` : `$${i + 1}`).join(',');
        const rows = await this.rawQuery(`SELECT "${emailField}" FROM "${tableName}" WHERE "id" IN (${placeholders})`, userIds);
        return rows.map(r => r[emailField]).filter(Boolean).join(',');
      }
    } catch (e) {
      console.error('[BPM] Erro ao buscar emails dos IDs:', e.message);
    }
    return '';
  }

  processEvent(tableName, actionType, rowData, oldRow) { return this.core.processEvent(tableName, actionType, rowData, oldRow); }
  processSyncEvent(tableName, actionType, rowData, oldRow) { return this.core.processSyncEvent(tableName, actionType, rowData, oldRow); }
  needsOldRow(tableName) { return this.core.needsOldRow(tableName); }
  processWebhook(workflowId, data) { return this.core.processWebhook(workflowId, data); }
  processCustomAction(workflowIds, tableName, rowData) { return this.core.processCustomAction(workflowIds, tableName, rowData); }
}

module.exports = { BpmEngine };
