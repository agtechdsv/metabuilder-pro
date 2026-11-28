-- ============================================================================
-- MetaBuilder PRO: tabelas que o Agente CLI usa no BANCO DO CLIENTE
-- ============================================================================
--
-- PARA QUEM É: o administrador do banco (DBA) do cliente. Rode UMA vez, com um usuário que tenha
-- permissão de criar tabelas (o dono do banco). Rode no BANCO DO CLIENTE, o mesmo que o Agente
-- acessa, e NÃO no banco da plataforma MetaBuilder.
--
-- QUANDO PRECISA: o Agente costuma criar estas tabelas sozinho. Este script só é necessário quando o
-- usuário do banco usado pelo Agente NÃO tem permissão de criar tabelas (o recomendado: um usuário
-- só com SELECT/INSERT/UPDATE/DELETE). Sem as tabelas, o Agente avisa no console e a função
-- correspondente não funciona.
--
-- O QUE CADA TABELA FAZ
--   1. mb_approval_tasks e mb_approval_history  (OBRIGATÓRIAS se os fluxos usam "Aguardar aprovação")
--      Tarefas de aprovação e o histórico de quem pediu, aprovou ou rejeitou. PostgreSQL e Oracle.
--   2. mb_help_feedback                          (opcional: votos da Ajuda contextual)
--      Votos "ajudou / não ajudou" e comentários dos usuários. Só PostgreSQL.
--   3. mb_logs                                    (opcional: log de banco do túnel)
--      Registro das operações do Agente, se o log de banco estiver ligado no projeto. Só PostgreSQL.
--
-- Depois de criar as tabelas, rode o bloco de PERMISSÕES (final) trocando o nome do usuário do Agente.
-- Não é preciso reiniciar o Agente: ele passa a usar as tabelas na próxima vez que precisar.
-- ============================================================================


-- ############################################################################
-- #  POSTGRESQL                                                              #
-- ############################################################################

-- ---------------------------------------------------------------------------
-- 1) Aprovações
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mb_approval_tasks (
  id TEXT PRIMARY KEY,
  workflow_id TEXT,
  workflow_name TEXT,
  node_id TEXT,
  table_name TEXT,
  record_pk TEXT,
  record_snapshot TEXT,
  ctx TEXT,
  assignees TEXT,
  status TEXT NOT NULL,
  title TEXT,
  allow_self SMALLINT NOT NULL DEFAULT 0,
  requested_by TEXT,
  requested_by_name TEXT,
  created_at TEXT NOT NULL,
  decided_by TEXT,
  decided_by_name TEXT,
  decided_at TEXT,
  decision_comment TEXT,
  due_at TEXT,
  reminded_at TEXT,
  reminder_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mb_apr_tasks_st ON mb_approval_tasks (status, created_at);

CREATE TABLE IF NOT EXISTS mb_approval_history (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  table_name TEXT,
  record_pk TEXT,
  event TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  comment_text TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mb_apr_hist_rec ON mb_approval_history (table_name, record_pk, created_at);

-- ---------------------------------------------------------------------------
-- 2) Feedback da Ajuda contextual (opcional)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mb_help_feedback (
  id          BIGSERIAL   PRIMARY KEY,
  screen_id   TEXT,
  field_id    TEXT,
  zone        TEXT,
  vote        SMALLINT    NOT NULL CHECK (vote IN (-1, 1)),
  comment     TEXT,
  user_ref    TEXT,
  language    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mb_help_feedback_target ON mb_help_feedback (screen_id, field_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3) Log de banco do túnel (opcional)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mb_logs (
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

CREATE INDEX IF NOT EXISTS idx_mb_logs_type  ON mb_logs (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mb_logs_date  ON mb_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mb_logs_table ON mb_logs (table_name, created_at DESC);

-- ---------------------------------------------------------------------------
-- PERMISSÕES do usuário do Agente (PostgreSQL)
-- Troque mb_agent pelo nome do usuário que o Agente usa (o do metabuilder.config.json).
-- Se você já usa o script "Usuário do banco com privilégio mínimo" do Studio, o usuário dele (mb_agent)
-- já recebe permissão nas tabelas criadas depois por quem rodou aquele script; mesmo assim, o bloco
-- abaixo é inofensivo e garante o acesso.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON mb_approval_tasks   TO mb_agent;   -- sem DELETE
GRANT SELECT, INSERT         ON mb_approval_history TO mb_agent;   -- o histórico só recebe inclusões
GRANT SELECT, INSERT         ON mb_help_feedback    TO mb_agent;
GRANT USAGE, SELECT ON SEQUENCE mb_help_feedback_id_seq TO mb_agent;
GRANT SELECT, INSERT, UPDATE, DELETE ON mb_logs     TO mb_agent;   -- o Agente apaga logs antigos (retenção)
GRANT USAGE, SELECT ON SEQUENCE mb_logs_id_seq          TO mb_agent;

-- Conferência (deve listar as 5 tabelas):
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = current_schema() AND table_name IN
--        ('mb_approval_tasks','mb_approval_history','mb_help_feedback','mb_logs');


-- ############################################################################
-- #  ORACLE  (só as aprovações; o feedback da Ajuda e o log de banco são      #
-- #  somente PostgreSQL)                                                      #
-- ############################################################################
-- Oracle não tem IF NOT EXISTS: se a tabela já existir, o erro ORA-00955 é inofensivo.
-- Datas e ids são texto (ISO-8601).

CREATE TABLE mb_approval_tasks (
  id VARCHAR2(64) PRIMARY KEY,
  workflow_id VARCHAR2(64),
  workflow_name VARCHAR2(300),
  node_id VARCHAR2(100),
  table_name VARCHAR2(200),
  record_pk VARCHAR2(200),
  record_snapshot CLOB,
  ctx CLOB,
  assignees CLOB,
  status VARCHAR2(20) NOT NULL,
  title VARCHAR2(500),
  allow_self NUMBER(1) DEFAULT 0 NOT NULL,
  requested_by VARCHAR2(200),
  requested_by_name VARCHAR2(200),
  created_at VARCHAR2(30) NOT NULL,
  decided_by VARCHAR2(200),
  decided_by_name VARCHAR2(200),
  decided_at VARCHAR2(30),
  decision_comment VARCHAR2(2000),
  due_at VARCHAR2(30),
  reminded_at VARCHAR2(60),
  reminder_count NUMBER(10) DEFAULT 0 NOT NULL
);

CREATE INDEX idx_mb_apr_tasks_st ON mb_approval_tasks (status, created_at);

CREATE TABLE mb_approval_history (
  id VARCHAR2(64) PRIMARY KEY,
  task_id VARCHAR2(64) NOT NULL,
  table_name VARCHAR2(200),
  record_pk VARCHAR2(200),
  event VARCHAR2(30) NOT NULL,
  actor_id VARCHAR2(200),
  actor_name VARCHAR2(200),
  comment_text VARCHAR2(2000),
  created_at VARCHAR2(30) NOT NULL
);

CREATE INDEX idx_mb_apr_hist_rec ON mb_approval_history (table_name, record_pk, created_at);

-- PERMISSÕES do usuário do Agente (Oracle): troque MB_AGENT pelo usuário do Agente. Se ele acessa as
-- tabelas por sinônimo (como no script de privilégio mínimo do Studio), crie também os sinônimos.
GRANT SELECT, INSERT, UPDATE ON mb_approval_tasks   TO MB_AGENT;
GRANT SELECT, INSERT         ON mb_approval_history TO MB_AGENT;
-- CREATE OR REPLACE SYNONYM MB_AGENT.mb_approval_tasks   FOR mb_approval_tasks;
-- CREATE OR REPLACE SYNONYM MB_AGENT.mb_approval_history FOR mb_approval_history;
