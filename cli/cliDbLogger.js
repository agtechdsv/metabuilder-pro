/**
 * MetaBuilderPRO - CLI Database Logger
 * 
 * Grava logs de operações SQL no banco LOCAL do cliente em uma tabela
 * dedicada (__mb_logs), criada automaticamente na primeira execução.
 * 
 * Nenhum dado sai do servidor do cliente.
 * Todas as operações são fire-and-forget (sem await) para não impactar performance.
 */

'use strict';

// Tipos de log suportados
const LOG_TYPES = {
  SQL_SELECT: 'SQL_SELECT',
  SQL_WRITE:  'SQL_WRITE',
  SQL_ERROR:  'SQL_ERROR',
  BPM:        'BPM',
  SYNC:       'SYNC',
  TUNNEL:     'TUNNEL',
};

// DDL da tabela de logs no banco do cliente
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS __mb_logs (
    id          BIGSERIAL    PRIMARY KEY,
    session_id  UUID,
    type        TEXT         NOT NULL,
    action      TEXT,
    table_name  TEXT,
    schema_name TEXT,
    message     TEXT,
    sql_text    TEXT,
    duration_ms INTEGER,
    row_count   INTEGER,
    metadata    JSONB,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_mb_logs_type    ON __mb_logs (type, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_mb_logs_date    ON __mb_logs (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_mb_logs_table   ON __mb_logs (table_name, created_at DESC);
`;

/** Retorna o timestamp local do CLI como ISO 8601 com offset correto (ex: 2026-06-28T09:15:00.000-03:00) */
function localISOString() {
  const now = new Date();
  const off = now.getTimezoneOffset(); // positivo para zonas West (UTC-), negativo para East (UTC+)
  const sign = off <= 0 ? '+' : '-';
  const absOff = Math.abs(off);
  const offH = String(Math.floor(absOff / 60)).padStart(2, '0');
  const offM = String(absOff % 60).padStart(2, '0');
  // Usa componentes LOCAIS (getHours etc.), NÃO toISOString() que retorna UTC
  const y  = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d  = String(now.getDate()).padStart(2, '0');
  const h  = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s  = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}${sign}${offH}:${offM}`;
}

class CliDbLogger {
  constructor() {
    this._pgClient    = null;
    this._sessionId   = null;
    this._schemaName  = 'public';
    this._logConfig   = { enabled: false, types: ['SQL_ERROR'], retention_days: 7 };
    this._ready       = false;
  }

  /**
   * Inicializa o logger.
   * @param {object} pgClient       - Pool do pg já conectado
   * @param {string} schemaName     - Schema do projeto (ex: 'erp')
   * @param {object} logConfig      - { enabled, types[], retention_days }
   */
  async init(pgClient, schemaName, logConfig) {
    if (!pgClient) return;
    this._pgClient   = pgClient;
    this._schemaName = schemaName || 'public';
    this._logConfig  = logConfig  || this._logConfig;
    this._sessionId  = require('crypto').randomUUID();

    if (!this._logConfig.enabled) {
      console.log('\x1b[90m[MBLog] Log de banco desativado para este projeto.\x1b[0m');
      return;
    }

    try {
      // Cria a tabela se não existir (idempotente)
      await pgClient.query(CREATE_TABLE_SQL);

      // Limpa logs antigos baseado na retenção configurada
      const retentionDays = this._logConfig.retention_days || 7;
      await pgClient.query(
        `DELETE FROM __mb_logs WHERE created_at < NOW() - INTERVAL '${parseInt(retentionDays, 10)} days'`
      );

      this._ready = true;
      console.log(`\x1b[90m[MBLog] Log ativo. Sessao: ${this._sessionId}. Tipos: [${this._logConfig.types.join(', ')}]. Retencao: ${retentionDays}d.\x1b[0m`);

      // Registra o início da sessão
      this._insert(LOG_TYPES.TUNNEL, 'session_start', null, null, 'Tunnel session started', null, null, null, { session_id: this._sessionId });
    } catch (err) {
      console.error('\x1b[33m[MBLog] Falha ao inicializar tabela de logs:\x1b[0m', err.message);
    }
  }

  /**
   * Atualiza as configurações de log dinamicamente.
   * @param {object} logConfig      - { enabled, types[], retention_days }
   */
  updateConfig(logConfig) {
    this._logConfig = logConfig || this._logConfig;
    if (!this._logConfig.enabled) {
      this._ready = false;
      console.log('\x1b[90m[MBLog] Log de banco desativado dinamicamente.\x1b[0m');
    } else {
      const wasReady = this._ready;
      this._ready = true;
      console.log(`\x1b[90m[MBLog] Log atualizado dinamicamente. Tipos: [${this._logConfig.types?.join(', ')}]. Retencao: ${this._logConfig.retention_days}d.\x1b[0m`);
      if (!wasReady && this._pgClient) {
        // Inicializa a tabela caso não estivesse ativo antes
        this._pgClient.query(CREATE_TABLE_SQL).catch(err => {
          console.error('\x1b[33m[MBLog] Falha ao inicializar tabela de logs no update:\x1b[0m', err.message);
        });
      }
    }
  }

  /** Verifica se um tipo de log está habilitado */
  _isEnabled(type) {
    if (this._logConfig.log_to_db === false) return false;
    return this._ready && this._logConfig.enabled && this._logConfig.types.includes(type);
  }

  /** Insere um registro na tabela __mb_logs (fire-and-forget) */
  _insert(type, action, tableName, sqlText, message, durationMs, rowCount, schemaName, metadata) {
    if (!this._pgClient || !this._ready) return;
    const sql = `
      INSERT INTO __mb_logs
        (session_id, type, action, table_name, schema_name, message, sql_text, duration_ms, row_count, metadata, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `;
    const params = [
      this._sessionId,
      type,
      action       || null,
      tableName    || null,
      schemaName   || this._schemaName,
      message      || null,
      sqlText      || null,
      durationMs   != null ? parseInt(durationMs) : null,
      rowCount     != null ? parseInt(rowCount)    : null,
      metadata     ? JSON.stringify(metadata) : null,
      localISOString(), // horário local do CLI, não UTC do PostgreSQL
    ];
    // Fire-and-forget: nunca bloqueia a query principal
    this._pgClient.query(sql, params).catch(e => {
      // Silencia erros de log para não afetar o usuário
      console.error('\x1b[33m[MBLog] Erro ao gravar log:\x1b[0m', e.message);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Métodos públicos chamados pelo index.js
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Log de SELECT (leitura)
   */
  logSelect(tableName, sqlText, rowCount, durationMs) {
    if (!this._isEnabled(LOG_TYPES.SQL_SELECT)) return;
    this._insert(LOG_TYPES.SQL_SELECT, 'select', tableName, sqlText,
      `SELECT retornou ${rowCount} linha(s)`, durationMs, rowCount);
  }

  /**
   * Log de COUNT
   */
  logCount(tableName, sqlText, total, durationMs) {
    if (!this._isEnabled(LOG_TYPES.SQL_SELECT)) return;
    this._insert(LOG_TYPES.SQL_SELECT, 'count', tableName, sqlText,
      `COUNT: ${total} linha(s)`, durationMs, total);
  }

  /**
   * Log de INSERT
   */
  logInsert(tableName, sqlText, durationMs) {
    if (!this._isEnabled(LOG_TYPES.SQL_WRITE)) return;
    this._insert(LOG_TYPES.SQL_WRITE, 'insert', tableName, sqlText,
      'INSERT: 1 linha criada', durationMs, 1);
  }

  /**
   * Log de UPDATE
   */
  logUpdate(tableName, sqlText, durationMs) {
    if (!this._isEnabled(LOG_TYPES.SQL_WRITE)) return;
    this._insert(LOG_TYPES.SQL_WRITE, 'update', tableName, sqlText,
      'UPDATE: 1 linha atualizada', durationMs, 1);
  }

  /**
   * Log de DELETE
   */
  logDelete(tableName, sqlText, durationMs) {
    if (!this._isEnabled(LOG_TYPES.SQL_WRITE)) return;
    this._insert(LOG_TYPES.SQL_WRITE, 'delete', tableName, sqlText,
      'DELETE: 1 linha removida', durationMs, 1);
  }

  /**
   * Log de SQL customizado (ações customizadas)
   */
  logCustom(tableName, sqlText, durationMs) {
    if (!this._isEnabled(LOG_TYPES.SQL_WRITE)) return;
    this._insert(LOG_TYPES.SQL_WRITE, 'custom_action', tableName, sqlText,
      'Custom Action executada', durationMs, null);
  }

  /**
   * Log de ERRO — sempre gravado se o logger estiver ativo, independente do tipo configurado
   */
  logError(tableName, sqlText, errorMessage, durationMs) {
    if (!this._isEnabled(LOG_TYPES.SQL_ERROR)) return;
    this._insert(LOG_TYPES.SQL_ERROR, 'error', tableName, sqlText,
      errorMessage, durationMs, 0);
  }

  /**
   * Log de evento BPM
   */
  logBpm(tableName, eventType, message) {
    if (!this._isEnabled(LOG_TYPES.BPM)) return;
    this._insert(LOG_TYPES.BPM, eventType, tableName, null, message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Leitura de logs via Tunnel (para o Studio)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Lê logs com filtros. Retorna { rows, total }.
   * @param {object} filters - { type?, table_name?, from?, to?, search?, limit?, offset? }
   */
  async readLogs(filters = {}) {
    if (!this._pgClient || !this._ready) return { rows: [], total: 0 };

    const conditions = [];
    const params = [];
    let i = 1;

    if (filters.type) {
      conditions.push(`type = $${i++}`);
      params.push(filters.type);
    }
    if (filters.table_name) {
      conditions.push(`table_name = $${i++}`);
      params.push(filters.table_name);
    }
    if (filters.from) {
      conditions.push(`created_at >= $${i++}`);
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`created_at <= $${i++}`);
      params.push(filters.to);
    }
    if (filters.search) {
      conditions.push(`(message ILIKE $${i} OR sql_text ILIKE $${i} OR table_name ILIKE $${i})`);
      params.push(`%${filters.search}%`);
      i++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit  = Math.min(parseInt(filters.limit  || 50),  200);
    const offset = parseInt(filters.offset || 0);

    try {
      const [dataRes, countRes] = await Promise.all([
        this._pgClient.query(
          `SELECT id, session_id, type, action, table_name, schema_name, message, sql_text, duration_ms, row_count, metadata, created_at
           FROM __mb_logs ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
          [...params, limit, offset]
        ),
        this._pgClient.query(
          `SELECT COUNT(*) as total FROM __mb_logs ${where}`,
          params
        ),
      ]);

      return {
        rows:  dataRes.rows,
        total: parseInt(countRes.rows[0]?.total || 0),
      };
    } catch (err) {
      console.error('[MBLog] Erro ao ler logs:', err.message);
      return { rows: [], total: 0 };
    }
  }

  /**
   * Limpa todos os logs (ação do Studio)
   */
  async clearLogs() {
    if (!this._pgClient || !this._ready) return;
    try {
      await this._pgClient.query('TRUNCATE __mb_logs RESTART IDENTITY');
    } catch (err) {
      console.error('[MBLog] Erro ao limpar logs:', err.message);
    }
  }

  /**
   * Retorna estatísticas rápidas (contagem por tipo)
   */
  async getStats() {
    if (!this._pgClient || !this._ready) return {};
    try {
      const res = await this._pgClient.query(
        `SELECT type, COUNT(*) as count FROM __mb_logs GROUP BY type ORDER BY count DESC`
      );
      const stats = {};
      res.rows.forEach(r => { stats[r.type] = parseInt(r.count); });
      return stats;
    } catch (err) {
      return {};
    }
  }
}

// Singleton
const cliDbLogger = new CliDbLogger();
module.exports = { cliDbLogger, LOG_TYPES };
