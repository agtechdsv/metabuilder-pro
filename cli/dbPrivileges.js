/**
 * Quanto poder o usuário do banco que o Agente usa tem?
 *
 * O Agente executa o SQL que o filtro de segurança deixa passar. Quanto mais poder o usuário do banco tem
 * (administrador, dono das tabelas, pode criar objetos), mais uma falha do filtro custaria. O ideal é um usuário só com
 * SELECT/INSERT/UPDATE/DELETE nas tabelas do aplicativo (o Studio gera o script em Configurações de Bancos).
 *
 * `query(sql)` executa um SELECT e devolve as linhas (objetos). Nunca lança: se algo falhar devolve `unknown`.
 */

const PG = {
  role: `SELECT rolsuper, rolcreaterole, rolcreatedb, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
  schema: `SELECT has_schema_privilege(current_user, current_schema(), 'CREATE') AS can_create`,
  owned: `SELECT count(*)::int AS owned FROM pg_tables WHERE schemaname = current_schema() AND tableowner = current_user`,
};

const ORACLE_DANGEROUS = new Set([
  'CREATE ANY TABLE', 'DROP ANY TABLE', 'ALTER ANY TABLE', 'SELECT ANY TABLE', 'INSERT ANY TABLE', 'UPDATE ANY TABLE',
  'DELETE ANY TABLE', 'EXECUTE ANY PROCEDURE', 'CREATE ANY PROCEDURE', 'ALTER SYSTEM', 'ALTER USER', 'CREATE USER',
  'DROP USER', 'GRANT ANY PRIVILEGE', 'GRANT ANY ROLE', 'SELECT ANY DICTIONARY', 'BECOME USER',
]);

const val = (row, name) => {
  if (!row) return undefined;
  const k = Object.keys(row).find(x => x.toLowerCase() === name);
  return k === undefined ? undefined : row[k];
};

/** Resultado: { level: 'ok' | 'warn' | 'danger' | 'unknown', findings: string[] } (findings = códigos, a tela traduz). */
async function checkDbPrivileges({ dbType, query }) {
  const findings = [];
  try {
    if (dbType === 'oracle') {
      const privs = (await query('SELECT privilege FROM session_privs')).map(r => String(val(r, 'privilege')).toUpperCase());
      const roles = (await query('SELECT role FROM session_roles')).map(r => String(val(r, 'role')).toUpperCase());
      if (roles.includes('DBA')) findings.push('dba');
      if (privs.some(p => ORACLE_DANGEROUS.has(p))) findings.push('powerful_privileges');
      if (privs.includes('CREATE TABLE') || privs.includes('UNLIMITED TABLESPACE')) findings.push('can_create');
      const owned = Number(val((await query('SELECT count(*) AS owned FROM user_tables'))[0], 'owned') || 0);
      if (owned > 0) findings.push('owns_tables');
    } else {
      const role = (await query(PG.role))[0];
      if (!role) return { level: 'unknown', findings: [] };
      if (val(role, 'rolsuper')) findings.push('superuser');
      if (val(role, 'rolcreaterole')) findings.push('createrole');
      if (val(role, 'rolbypassrls')) findings.push('bypassrls');
      if (val(role, 'rolcreatedb')) findings.push('createdb');
      if (val((await query(PG.schema))[0], 'can_create')) findings.push('can_create');
      if (Number(val((await query(PG.owned))[0], 'owned') || 0) > 0) findings.push('owns_tables');
    }
  } catch (e) {
    return { level: 'unknown', findings: [] };
  }
  const danger = ['superuser', 'dba', 'createrole', 'bypassrls', 'powerful_privileges'];
  const level = findings.some(f => danger.includes(f)) ? 'danger' : findings.length ? 'warn' : 'ok';
  return { level, findings };
}

const MESSAGES = {
  superuser: 'é SUPERUSUÁRIO do PostgreSQL (pode ler arquivos do servidor e tudo mais)',
  dba: 'tem o papel DBA do Oracle',
  powerful_privileges: 'tem privilégios de sistema poderosos (ex.: ANY TABLE, ALTER SYSTEM)',
  createrole: 'pode criar outros usuários/papéis',
  bypassrls: 'ignora as políticas de segurança por linha do banco',
  createdb: 'pode criar bancos',
  can_create: 'pode criar objetos (tabelas) no schema',
  owns_tables: 'é DONO das tabelas (pode alterá-las e apagá-las)',
};

/** Texto para o console do Agente; null quando está tudo certo (ou não deu para conferir). */
function describePrivileges(result) {
  if (!result || result.level === 'ok' || result.level === 'unknown') return null;
  const lines = result.findings.map(f => `  - o usuário do banco ${MESSAGES[f] || f}`);
  return [
    result.level === 'danger'
      ? '[ SEGURANÇA ] ATENÇÃO: o usuário do banco usado pelo Agente tem poder DEMAIS.'
      : '[ SEGURANÇA ] O usuário do banco usado pelo Agente tem mais poder que o necessário.',
    ...lines,
    '  Recomendado: um usuário só com SELECT/INSERT/UPDATE/DELETE nas tabelas do aplicativo.',
    '  O Studio gera o script em Configurações de Bancos → "Usuário do banco com privilégio mínimo".',
  ].join('\n');
}

module.exports = { checkDbPrivileges, describePrivileges };
