-- MetaBuilder PRO: tabelas das aprovações ("Aguardar aprovação" na Automação de processos)
--
-- Normalmente o Agente CLI cria estas tabelas sozinho, na primeira vez que um fluxo pede uma aprovação.
-- Rode este script SOMENTE se o usuário do banco do cliente não tem permissão para criar tabelas:
-- o Agente avisa isto no console e o fluxo registra o erro.
-- Rode no BANCO DO CLIENTE (o mesmo que o Agente CLI acessa), NÃO no Supabase da plataforma.
-- Datas e ids são texto (ISO-8601): o mesmo SQL de leitura serve a PostgreSQL e a Oracle.
-- O usuário do Agente precisa de SELECT, INSERT e UPDATE nestas duas tabelas (nada de DELETE: o histórico só recebe inclusões).

-- ============================== PostgreSQL ==============================

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

-- ================================ Oracle ================================
-- (Oracle não tem IF NOT EXISTS: se a tabela já existir, o erro ORA-00955 é inofensivo.)

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
