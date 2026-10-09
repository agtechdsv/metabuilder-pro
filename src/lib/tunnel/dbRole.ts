/**
 * Script para o administrador do banco do cliente criar o usuário que o Agente CLI deve usar, com o MÍNIMO de privilégio.
 *
 * Por quê: o Agente executa o SQL que o filtro deixou passar. Se o usuário do banco tem poder demais (dono do schema,
 * administrador), um truque de SQL que escape do filtro vira acesso a tudo. Com este usuário o próprio banco recusa:
 * só lê e grava nas tabelas do aplicativo, não cria nem apaga tabelas, não lê arquivos, não é administrador.
 *
 * O MetaBuilder não executa nada no banco do cliente: quem aplica é o administrador.
 */
export type DbRoleEngine = 'postgres' | 'oracle'

const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/
const ident = (v: string | undefined, fallback: string) => (v && IDENT.test(v.trim()) ? v.trim() : fallback)
const q = (s: string) => '"' + s.replace(/"/g, '""') + '"'

export interface DbRoleOptions {
  engine: DbRoleEngine
  /** nome do usuário novo (padrão mb_agent) */
  user?: string
  /** PostgreSQL: banco ao qual ele pode se conectar */
  database?: string
  /** PostgreSQL: schema das tabelas (padrão public). Oracle: usuário DONO das tabelas (padrão o nome do schema informado) */
  schema?: string
}

export function leastPrivilegeSql(o: DbRoleOptions): string {
  return o.engine === 'oracle' ? oracleSql(o) : postgresSql(o)
}

function postgresSql(o: DbRoleOptions): string {
  const user = ident(o.user, 'mb_agent')
  const db = ident(o.database, 'meu_banco')
  const schema = ident(o.schema, 'public')
  const U = q(user), S = q(schema)
  return [
    `-- Usuário do Agente MetaBuilder com privilégio mínimo (PostgreSQL).`,
    `-- Execute como administrador do banco (ex.: postgres), conectado ao banco ${q(db)}.`,
    ``,
    `-- 1) O usuário: sem poderes de administrador. TROQUE A SENHA.`,
    `CREATE ROLE ${U} LOGIN PASSWORD 'TROQUE-ESTA-SENHA' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 20;`,
    ``,
    `-- 2) Só conecta a este banco e só enxerga este schema.`,
    `GRANT CONNECT ON DATABASE ${q(db)} TO ${U};`,
    `GRANT USAGE ON SCHEMA ${S} TO ${U};`,
    ``,
    `-- 3) Dados: ler e gravar nas tabelas (nada de criar, alterar ou apagar tabelas).`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${S} TO ${U};`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${S} TO ${U};`,
    `-- tabelas e sequências criadas no futuro por este administrador já nascem liberadas`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA ${S} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${U};`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA ${S} GRANT USAGE, SELECT ON SEQUENCES TO ${U};`,
    ``,
    `-- 4) Limites: uma consulta que não termina é cortada em 5 minutos; o schema padrão é este.`,
    `ALTER ROLE ${U} SET statement_timeout = '300s';`,
    `ALTER ROLE ${U} SET search_path = ${S};`,
    ``,
    `-- 5) Tabela de logs do projeto (o Agente a usaria sozinho se tivesse permissão de criar tabelas, que ele não tem).`,
    `CREATE TABLE IF NOT EXISTS ${S}.mb_logs (`,
    `  id          BIGSERIAL    PRIMARY KEY,`,
    `  session_id  UUID,`,
    `  type        TEXT         NOT NULL,`,
    `  action      TEXT,`,
    `  table_name  TEXT,`,
    `  schema_name TEXT,`,
    `  message     TEXT,`,
    `  sql_text    TEXT,`,
    `  duration_ms INTEGER,`,
    `  row_count   INTEGER,`,
    `  metadata    JSONB,`,
    `  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()`,
    `);`,
    `CREATE INDEX IF NOT EXISTS idx_mb_logs_type  ON ${S}.mb_logs (type, created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_mb_logs_date  ON ${S}.mb_logs (created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_mb_logs_table ON ${S}.mb_logs (table_name, created_at DESC);`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${S}.mb_logs TO ${U};`,
    `GRANT USAGE, SELECT ON SEQUENCE ${S}.mb_logs_id_seq TO ${U};`,
    ``,
    `-- 6) Conferência: tudo "false" abaixo.`,
    `-- SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = '${user}';`,
    ``,
    `-- Depois: use o usuário ${user} (e a nova senha) em Configurações de Bancos e reinicie o Agente.`,
  ].join('\n')
}

function oracleSql(o: DbRoleOptions): string {
  const user = ident(o.user, 'mb_agent').toUpperCase()
  const owner = ident(o.schema, 'DONO').toUpperCase()
  return [
    `-- Usuário do Agente MetaBuilder com privilégio mínimo (Oracle).`,
    `-- Execute como DBA, conectado ao PDB do banco. Dono das tabelas: ${owner}.`,
    `-- ATENÇÃO: valide em ambiente de teste antes. O Agente usa nomes de tabela sem prefixo (por isso os sinônimos abaixo)`,
    `-- e a sincronização de metadados dele lê USER_TABLES; com um usuário separado, rode a sincronização com o usuário dono.`,
    ``,
    `-- 1) O usuário: só conecta; sem espaço para criar objetos. TROQUE A SENHA.`,
    `CREATE USER ${user} IDENTIFIED BY "TROQUE-ESTA-SENHA" QUOTA 0 ON USERS;`,
    `GRANT CREATE SESSION TO ${user};`,
    ``,
    `-- 2) Dados: ler e gravar em cada tabela do dono (nada de criar, alterar ou apagar tabelas) e sinônimos para os nomes curtos.`,
    `BEGIN`,
    `  FOR t IN (SELECT table_name FROM all_tables WHERE owner = '${owner}') LOOP`,
    `    EXECUTE IMMEDIATE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "${owner}"."' || t.table_name || '" TO ${user}';`,
    `    EXECUTE IMMEDIATE 'CREATE OR REPLACE SYNONYM ${user}."' || t.table_name || '" FOR "${owner}"."' || t.table_name || '"';`,
    `  END LOOP;`,
    `  FOR s IN (SELECT sequence_name FROM all_sequences WHERE sequence_owner = '${owner}') LOOP`,
    `    EXECUTE IMMEDIATE 'GRANT SELECT ON "${owner}"."' || s.sequence_name || '" TO ${user}';`,
    `    EXECUTE IMMEDIATE 'CREATE OR REPLACE SYNONYM ${user}."' || s.sequence_name || '" FOR "${owner}"."' || s.sequence_name || '"';`,
    `  END LOOP;`,
    `END;`,
    `/`,
    ``,
    `-- 3) Conferência: só deve listar SELECT/INSERT/UPDATE/DELETE (e nenhum privilégio de sistema além de CREATE SESSION).`,
    `-- SELECT privilege FROM dba_sys_privs WHERE grantee = '${user}';`,
    `-- SELECT DISTINCT privilege FROM dba_tab_privs WHERE grantee = '${user}';`,
    ``,
    `-- Depois: use o usuário ${user} (e a nova senha) em Configurações de Bancos e reinicie o Agente.`,
    `-- Tabelas criadas depois precisam de novo GRANT/SINÔNIMO: repita o bloco do passo 2.`,
  ].join('\n')
}
