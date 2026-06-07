#!/usr/bin/env node

// Polyfill para resolver erro do "latin1" no TextDecoder compilado via pkg (usado pelo fast-png / jspdf)
const originalTextDecoder = global.TextDecoder;
global.TextDecoder = class TextDecoder extends originalTextDecoder {
  constructor(encoding = 'utf-8', options) {
    if (encoding === 'latin1' || encoding === 'iso-8859-1') {
      super('utf-8', options); // Inicializa com utf-8 para evitar o erro do V8 base
      this.isLatin1 = true;
    } else {
      super(encoding, options);
    }
  }
  decode(input, options) {
    if (this.isLatin1 && input) {
      return Buffer.from(input).toString('latin1');
    }
    return super.decode(input, options);
  }
};

require('dotenv').config({ path: '../.env.local' }); // Para facilitar os testes locais
const { Client } = require('pg');
const inquirer = require('inquirer');
const chalk = require('chalk');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const ldap = require('ldapjs');
const oracledb = require('oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
const { BpmEngine } = require('./bpmEngine');

// Configurações do Supabase lidas do ambiente ou perguntadas depois
let SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
let SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function formatAxiosError(error) {
  let errorMsg = error.message;
  if (error.code === 'ECONNREFUSED') {
    return `Conexão recusada em ${error.config?.url || 'localhost:3000'}. O servidor MetaBuilderPRO está rodando?`;
  }
  if (error.response) {
    if (typeof error.response.data === 'string') {
      errorMsg = error.response.data;
    } else if (error.response.data && error.response.data.error) {
      errorMsg = error.response.data.error;
    } else {
      errorMsg = JSON.stringify(error.response.data);
    }
  }
  return errorMsg || error.code || 'Erro de conexão desconhecido';
}

// Função 1: Introspecção
async function introspectPostgres(connectionString) {
  const client = new Client({ connectionString });
  try {
    console.log(chalk.blue('\nConectando ao banco de dados...'));
    await client.connect();
    console.log(chalk.green('✓ Conexão local estabelecida com sucesso!\n'));

    console.log(chalk.gray('Lendo tabelas...'));
    const tablesResult = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
    const tables = tablesResult.rows.map(row => row.table_name);

    console.log(chalk.gray('Lendo colunas...'));
    const columnsResult = await client.query(`SELECT table_name, column_name, data_type, is_nullable, character_maximum_length, column_default FROM information_schema.columns WHERE table_schema = 'public'`);

    console.log(chalk.gray('Lendo chaves primárias...'));
    const pkResult = await client.query(`
      SELECT kcu.table_name, kcu.column_name 
      FROM information_schema.table_constraints tco
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tco.constraint_name AND kcu.constraint_schema = tco.constraint_schema
      WHERE tco.constraint_type = 'PRIMARY KEY' AND kcu.table_schema='public'
    `);
    const primaryKeys = pkResult.rows;

    console.log(chalk.gray('Lendo chaves estrangeiras (relacionamentos)...'));
    const fkResult = await client.query(`
      SELECT tc.table_name AS foreign_table_name, kcu.column_name AS foreign_column_name, ccu.table_name AS primary_table_name, ccu.column_name AS primary_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public'
    `);
    const foreignKeys = fkResult.rows;

    const schemaDefinition = tables.map(tableName => {
      const tableColumns = columnsResult.rows.filter(col => col.table_name === tableName);
      const tablePKs = primaryKeys.filter(pk => pk.table_name === tableName).map(pk => pk.column_name);
      const tableFKs = foreignKeys.filter(fk => fk.foreign_table_name === tableName);

      return {
        name: tableName,
        columns: tableColumns.map(col => ({
          name: col.column_name,
          type: col.data_type,
          isNullable: col.is_nullable === 'YES',
          defaultValue: col.column_default,
          isPrimary: tablePKs.includes(col.column_name)
        })),
        relations: tableFKs.map(fk => ({
          foreignColumn: fk.foreign_column_name,
          referencedTable: fk.primary_table_name,
          referencedColumn: fk.primary_column_name
        }))
      };
    });

    console.log(chalk.green(`✓ Lidos metadados de ${schemaDefinition.length} tabelas.`));
    return schemaDefinition;
  } finally {
    await client.end();
  }
}

// Função 1.5: Introspecção Oracle
async function introspectOracle(connectionString) {
  let connection;
  try {
    console.log(chalk.blue('\nConectando ao banco de dados Oracle...'));
    connection = await oracledb.getConnection({ connectString: connectionString });
    console.log(chalk.green('✓ Conexão Oracle local estabelecida com sucesso!\n'));

    console.log(chalk.gray('Lendo tabelas...'));
    const tablesResult = await connection.execute(`SELECT TABLE_NAME FROM USER_TABLES`);
    const tables = tablesResult.rows.map(row => row.TABLE_NAME);

    console.log(chalk.gray('Lendo colunas...'));
    const columnsResult = await connection.execute(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, NULLABLE, DATA_DEFAULT 
      FROM USER_TAB_COLUMNS
    `);

    console.log(chalk.gray('Lendo chaves primárias...'));
    const pkResult = await connection.execute(`
      SELECT cols.TABLE_NAME, cols.COLUMN_NAME 
      FROM USER_CONSTRAINTS cons 
      INNER JOIN USER_CONS_COLUMNS cols ON cons.CONSTRAINT_NAME = cols.CONSTRAINT_NAME 
      WHERE cons.CONSTRAINT_TYPE = 'P'
    `);
    const primaryKeys = pkResult.rows;

    console.log(chalk.gray('Lendo chaves estrangeiras (relacionamentos)...'));
    const fkResult = await connection.execute(`
      SELECT a.TABLE_NAME as FOREIGN_TABLE_NAME, a.COLUMN_NAME as FOREIGN_COLUMN_NAME, 
             c_pk.TABLE_NAME as PRIMARY_TABLE_NAME, b.COLUMN_NAME as PRIMARY_COLUMN_NAME
      FROM USER_CONS_COLUMNS a
      JOIN USER_CONSTRAINTS c ON a.CONSTRAINT_NAME = c.CONSTRAINT_NAME
      JOIN USER_CONSTRAINTS c_pk ON c.R_CONSTRAINT_NAME = c_pk.CONSTRAINT_NAME
      JOIN USER_CONS_COLUMNS b ON c_pk.CONSTRAINT_NAME = b.CONSTRAINT_NAME AND a.POSITION = b.POSITION
      WHERE c.CONSTRAINT_TYPE = 'R'
    `);
    const foreignKeys = fkResult.rows;

    const schemaDefinition = tables.map(tableName => {
      const tableColumns = columnsResult.rows.filter(col => col.TABLE_NAME === tableName);
      const tablePKs = primaryKeys.filter(pk => pk.TABLE_NAME === tableName).map(pk => pk.COLUMN_NAME);
      const tableFKs = foreignKeys.filter(fk => fk.FOREIGN_TABLE_NAME === tableName);

      return {
        name: tableName,
        columns: tableColumns.map(col => ({
          name: col.COLUMN_NAME,
          type: col.DATA_TYPE,
          isNullable: col.NULLABLE === 'Y',
          defaultValue: col.DATA_DEFAULT ? String(col.DATA_DEFAULT) : null,
          isPrimary: tablePKs.includes(col.COLUMN_NAME)
        })),
        relations: tableFKs.map(fk => ({
          foreignColumn: fk.FOREIGN_COLUMN_NAME,
          referencedTable: fk.PRIMARY_TABLE_NAME,
          referencedColumn: fk.PRIMARY_COLUMN_NAME
        }))
      };
    });

    console.log(chalk.green(`✓ Lidos metadados de ${schemaDefinition.length} tabelas.`));
    return schemaDefinition;
  } catch (err) {
    console.error(chalk.red('Erro na introspecção Oracle: '), err);
    throw err;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error(err); }
    }
  }
}

// Função 2: Iniciar Túnel Seguro (Modo Agente Escuta)
async function startTunnel(projectId, secretToken, connectionName, connectionString, configSupabaseUrl, configSupabaseKey, configLdap, dbType = 'postgres', configData = {}) {
  // Pega do ambiente (.env.local) ou do arquivo metabuilder.config.json
  const finalSupabaseUrl = SUPABASE_URL || configSupabaseUrl;
  const finalSupabaseKey = SUPABASE_KEY || configSupabaseKey;

  if (!finalSupabaseUrl || !finalSupabaseKey) {
    console.log(chalk.red('URL ou Chave do Supabase não encontradas. Adicione no metabuilder.config.json.'));
    process.exit(1);
  }

  const ws = require('ws');
  const supabase = createClient(finalSupabaseUrl, finalSupabaseKey, {
    auth: { persistSession: false },
    realtime: {
      transport: ws
    }
  });

  let pgClient, oracleConnection;
  console.log(chalk.blue(`\nConectando ao banco de dados local para o túnel (${dbType})...`));

  if (dbType === 'oracle') {
    oracleConnection = await oracledb.getConnection({ connectString: connectionString });
  } else {
    pgClient = new Client({ connectionString });
    await pgClient.connect();
  }
  
  console.log(chalk.green(`✓ Conexão contínua estabelecida com sucesso! (${connectionName || 'public'})`));

  let bpmEngine = null;
  try {
    if (dbType === 'postgres') {
      const baseApiUrl = configData.apiUrl ? configData.apiUrl.replace('/api/metadata/sync', '') : 'http://localhost:3000';
      bpmEngine = new BpmEngine(supabase, pgClient, oracleConnection, dbType, { id: projectId, secret_token: secretToken }, baseApiUrl);
      await bpmEngine.init();
    }
  } catch (err) {
    console.error(chalk.red('[ Motor BPM ] Falha ao inicializar motor de automações:'), err.message);
  }

  const channelName = `tunnel:${projectId}`;
  const channel = supabase.channel(channelName);

  console.log(chalk.cyan(`\n🎧 Agente MetaBuilderPRO ouvindo ativamente comandos no canal: ${channelName}...`));
  console.log(chalk.gray(`(Pressione Ctrl+C para encerrar o túnel)`));

  channel
    .on('broadcast', { event: 'sql_query' }, async (payload) => {
      // Recebeu um comando do painel MetaBuilderPRO
      const { queryId, table, action, token, schemaName } = payload.payload;

      // Segurança: Verifica se o comando veio com o token correto do projeto
      if (token !== secretToken) {
        console.log(chalk.red(`[ BLOQUEADO ] Comando recebido com token inválido para o projeto ${projectId}.`));
        console.log(chalk.gray(`  Recebido: "${token ? token.substring(0, 6) + '...' : 'null'}" | Configurado: "${secretToken ? secretToken.substring(0, 6) + '...' : 'null'}"`));
        return;
      }
      
      // Isolamento: Se o comando for para outro schema, este túnel o ignora silenciosamente
      const expectedSchema = connectionName || 'public';
      const incomingSchema = schemaName || 'public';
      if (incomingSchema !== expectedSchema && action !== 'sync_bpm') {
        console.log(chalk.yellow(`[ IGNORADO ] Comando destinado ao schema '${incomingSchema}', mas este agente atende '${expectedSchema}'.`));
        return; // Ignora o broadcast, outro agente responderá
      }

      console.log(chalk.yellow(`[ EXEC ] Comando Recebido no schema '${expectedSchema}': ${action === 'validate_login' ? 'Validar Login' : (action === 'sync_bpm' ? 'Sincronizar BPM' : `Buscar dados da tabela '${table}'`)}`));

      try {
        const safeTable = table ? table.replace(/[^a-zA-Z0-9_]/g, '') : '';
        let sql = '';
        let params = [];
        let result;

        if (action === 'select') {
          const filters = payload.payload.filters;
          const advancedFilters = payload.payload.advancedFilters || [];
          const joins = payload.payload.joins || [];
          let whereClause = '';
          const rawQueryStr = (payload.payload.query || '').toLowerCase();
          
          let i = 1;
          const conditions = [];

          let advancedConditionsSql = '';
          if (advancedFilters && advancedFilters.length > 0) {
            let advClauses = [];
            for (let j = 0; j < advancedFilters.length; j++) {
              const f = advancedFilters[j];
              let tablePart = safeTable;
              let columnPart = f.field;
              if (columnPart && columnPart.includes('.')) {
                const parts = columnPart.split('.');
                tablePart = parts[0].replace(/[^a-zA-Z0-9_]/g, '');
                columnPart = parts[1].replace(/[^a-zA-Z0-9_]/g, '');
              } else if (columnPart) {
                columnPart = columnPart.replace(/[^a-zA-Z0-9_]/g, '');
              } else {
                continue;
              }

              const isJoinedStr = rawQueryStr.includes(`join "${tablePart.toLowerCase()}"`) || rawQueryStr.includes(`join ${tablePart.toLowerCase()}`);
              const isJoinedCli = (joins || []).some((j) => {
                 return j.to === tablePart || j.from === tablePart || j.toTable === tablePart || j.table === tablePart;
              });

              if (tablePart === safeTable || isJoinedStr || isJoinedCli) {
                const logicOp = advClauses.length > 0 ? (f.logic === 'OR' ? ' OR ' : ' AND ') : '';
                const op = f.operator || '=';
                
                if (op === 'between') {
                  advClauses.push(`${logicOp}("${tablePart}"."${columnPart}" BETWEEN $${i} AND $${i+1})`);
                  params.push(f.value, f.value2);
                  i += 2;
                } else if (['=', '>', '<', '>=', '<='].includes(op)) {
                  advClauses.push(`${logicOp}("${tablePart}"."${columnPart}" ${op} $${i})`);
                  params.push(f.value);
                  i++;
                }
              }
            }
            if (advClauses.length > 0) {
              advancedConditionsSql = `(${advClauses.join('')})`;
            }
          }

          if (filters && Object.keys(filters).length > 0) {
            for (const [key, value] of Object.entries(filters)) {
              if (value !== undefined && value !== '') {
                let tablePart = safeTable;
                let columnPart = key;
                if (key.includes('.')) {
                  const parts = key.split('.');
                  tablePart = parts[0].replace(/[^a-zA-Z0-9_]/g, '');
                  columnPart = parts[1].replace(/[^a-zA-Z0-9_]/g, '');
                } else {
                  columnPart = key.replace(/[^a-zA-Z0-9_]/g, '');
                }
                
                // Segurança: só adiciona o filtro se a tabela for a principal, ou se estiver explicitamente nos joins ou na query bruta
                const isJoinedStr = rawQueryStr.includes(`join "${tablePart.toLowerCase()}"`) || rawQueryStr.includes(`join ${tablePart.toLowerCase()}`);
                const isJoinedCli = (joins || []).some((j) => {
                   return j.to === tablePart || j.from === tablePart || j.toTable === tablePart || j.table === tablePart;
                });
                
                if (tablePart === safeTable || isJoinedStr || isJoinedCli) {
                  conditions.push(`CAST("${tablePart}"."${columnPart}" AS text) ILIKE $${i}`);
                  params.push(`%${value}%`);
                  i++;
                } else {
                  console.log(chalk.yellow(`[ AVISO ] Filtro na tabela estrangeira '${tablePart}' ignorado pois ela não tem JOIN na query atual.`));
                }
              }
            }
          }

          if (conditions.length > 0 && advancedConditionsSql) {
            whereClause = ` WHERE ${advancedConditionsSql} AND (${conditions.join(' AND ')})`;
          } else if (conditions.length > 0) {
            whereClause = ` WHERE ${conditions.join(' AND ')}`;
          } else if (advancedConditionsSql) {
            whereClause = ` WHERE ${advancedConditionsSql}`;
          }

          const limit = payload.payload.limit ? parseInt(payload.payload.limit) : 100;
          const offset = payload.payload.offset ? parseInt(payload.payload.offset) : 0;
          
          // Se o frontend enviar uma query SQL bruta (que já tem joins e colunas resolvidas), usa ela
          if (payload.payload.query) {
            sql = payload.payload.query;
            if (whereClause) {
               // Se a query contiver o placeholder, injetamos exatamente lá (útil para subqueries paginadas)
               if (sql.includes('__WHERE_PLACEHOLDER__')) {
                 sql = sql.replace('__WHERE_PLACEHOLDER__', whereClause);
               } else {
                 sql += (sql.toLowerCase().includes(' where ') ? ' AND ' + conditions.join(' AND ') : whereClause);
               }
            } else {
               // Remove o placeholder caso não haja filtros
               sql = sql.replace('__WHERE_PLACEHOLDER__', '');
            }
            // Só acrescenta LIMIT/OFFSET se a query ainda não tiver (evita "LIMIT x LIMIT y")
            const sqlLower = sql.toLowerCase();
            const alreadyHasLimit = sqlLower.includes(' limit ');
            if (!alreadyHasLimit) {
              if (dbType === 'oracle') {
                sql += ` OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
              } else {
                sql += ` LIMIT ${limit} OFFSET ${offset}`;
              }
            }
          } else {
            let selectCols = `"${safeTable}".*`;
            let joinClause = '';

            if (joins && joins.length > 0) {
              joins.forEach(j => {
                 if(j.from && j.to && j.localKey && j.foreignKey) {
                    const safeFrom = j.from.replace(/[^a-zA-Z0-9_]/g, '');
                    const safeTo = j.to.replace(/[^a-zA-Z0-9_]/g, '');
                    const safeLocal = j.localKey.replace(/[^a-zA-Z0-9_]/g, '');
                    const safeForeign = j.foreignKey.replace(/[^a-zA-Z0-9_]/g, '');
                    
                    if (dbType === 'oracle') {
                      selectCols += `, (SELECT JSON_OBJECT(*) FROM "${safeTo}" WHERE "${safeFrom}"."${safeLocal}" = "${safeTo}"."${safeForeign}") AS "${safeTo}"`;
                    } else {
                      selectCols += `, row_to_json("${safeTo}".*) AS "${safeTo}"`;
                    }
                    joinClause += ` LEFT JOIN "${safeTo}" ON "${safeFrom}"."${safeLocal}" = "${safeTo}"."${safeForeign}"`;
                 }
              });
            }
            if (dbType === 'oracle') {
              sql = `SELECT ${selectCols} FROM "${safeTable}"${joinClause}${whereClause} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
            } else {
              sql = `SELECT ${selectCols} FROM "${safeTable}"${joinClause}${whereClause} LIMIT ${limit} OFFSET ${offset}`;
            }
          }
          
          if (dbType === 'oracle') {
            sql = sql.replace(/\$(\d+)/g, ':$1');
          }

          console.log(chalk.gray(`[ SQL ] Executando: ${sql}`));
          if (dbType === 'oracle') {
            const oraRes = await oracleConnection.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
            result = { rows: oraRes.rows };
          } else {
            result = await pgClient.query(sql, params);
          }
          console.log(chalk.green(`[ OK ] SELECT: Retornou ${result.rows.length} linhas (Limit: ${limit}, Offset: ${offset}).`));
        } else if (action === 'count_records') {
          const filters = payload.payload.filters;
          const advancedFilters = payload.payload.advancedFilters || [];
          const joins = payload.payload.joins || [];
          let whereClause = '';
          const rawQueryStr = (payload.payload.query || '').toLowerCase();
          
          let i = 1;
          const conditions = [];

          let advancedConditionsSql = '';
          if (advancedFilters && advancedFilters.length > 0) {
            let advClauses = [];
            for (let j = 0; j < advancedFilters.length; j++) {
              const f = advancedFilters[j];
              let tablePart = safeTable;
              let columnPart = f.field;
              if (columnPart && columnPart.includes('.')) {
                const parts = columnPart.split('.');
                tablePart = parts[0].replace(/[^a-zA-Z0-9_]/g, '');
                columnPart = parts[1].replace(/[^a-zA-Z0-9_]/g, '');
              } else if (columnPart) {
                columnPart = columnPart.replace(/[^a-zA-Z0-9_]/g, '');
              } else {
                continue;
              }

              const isJoinedStr = rawQueryStr.includes(`join "${tablePart.toLowerCase()}"`) || rawQueryStr.includes(`join ${tablePart.toLowerCase()}`);
              const isJoinedCli = (joins || []).some((j) => {
                 return j.to === tablePart || j.from === tablePart || j.toTable === tablePart || j.table === tablePart;
              });

              if (tablePart === safeTable || isJoinedStr || isJoinedCli) {
                const logicOp = advClauses.length > 0 ? (f.logic === 'OR' ? ' OR ' : ' AND ') : '';
                const op = f.operator || '=';
                
                if (op === 'between') {
                  advClauses.push(`${logicOp}("${tablePart}"."${columnPart}" BETWEEN $${i} AND $${i+1})`);
                  params.push(f.value, f.value2);
                  i += 2;
                } else if (['=', '>', '<', '>=', '<='].includes(op)) {
                  advClauses.push(`${logicOp}("${tablePart}"."${columnPart}" ${op} $${i})`);
                  params.push(f.value);
                  i++;
                }
              }
            }
            if (advClauses.length > 0) {
              advancedConditionsSql = `(${advClauses.join('')})`;
            }
          }

          if (filters && Object.keys(filters).length > 0) {
            for (const [key, value] of Object.entries(filters)) {
              if (value !== undefined && value !== '') {
                let tablePart = safeTable;
                let columnPart = key;
                if (key.includes('.')) {
                  const parts = key.split('.');
                  tablePart = parts[0].replace(/[^a-zA-Z0-9_]/g, '');
                  columnPart = parts[1].replace(/[^a-zA-Z0-9_]/g, '');
                } else {
                  columnPart = key.replace(/[^a-zA-Z0-9_]/g, '');
                }
                
                const isJoinedStr = rawQueryStr.includes(`join "${tablePart.toLowerCase()}"`) || rawQueryStr.includes(`join ${tablePart.toLowerCase()}`);
                const isJoinedCli = (joins || []).some((j) => {
                   return j.to === tablePart || j.from === tablePart || j.toTable === tablePart || j.table === tablePart;
                });
                
                if (tablePart === safeTable || isJoinedStr || isJoinedCli) {
                  conditions.push(`CAST("${tablePart}"."${columnPart}" AS text) ILIKE $${i}`);
                  params.push(`%${value}%`);
                  i++;
                }
              }
            }
          }

          if (conditions.length > 0 && advancedConditionsSql) {
            whereClause = ` WHERE ${advancedConditionsSql} AND (${conditions.join(' AND ')})`;
          } else if (conditions.length > 0) {
            whereClause = ` WHERE ${conditions.join(' AND ')}`;
          } else if (advancedConditionsSql) {
            whereClause = ` WHERE ${advancedConditionsSql}`;
          }

          if (payload.payload.query) {
            sql = payload.payload.query;
            if (whereClause) {
               if (sql.includes('__WHERE_PLACEHOLDER__')) {
                 sql = sql.replace('__WHERE_PLACEHOLDER__', whereClause);
               } else {
                 sql += (sql.toLowerCase().includes(' where ') ? ' AND ' + conditions.join(' AND ') : whereClause);
               }
            } else {
               sql = sql.replace('__WHERE_PLACEHOLDER__', '');
            }
          } else {
            sql = `SELECT COUNT(*) as total FROM "${safeTable}"`;
            if (whereClause) sql += whereClause;
          }

          console.log(chalk.cyan(`[ SQL ] Executando COUNT: ${sql}`));
          
          if (dbType === 'oracle') {
            const oraRes = await oracleConnection.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
            result = { rows: oraRes.rows };
          } else {
            result = await pgClient.query(sql, params);
          }
          
          const totalRows = result.rows.length > 0 ? parseInt(result.rows[0].total || result.rows[0].TOTAL || result.rows[0].count || 0) : 0;
          console.log(chalk.green(`[ OK ] COUNT: Retornou total de ${totalRows} linhas.`));
          
          result.totalRows = totalRows; // We will extract this at the end
        } else if (action === 'validate_login') {
          const { config, credentials } = payload.payload;
          if (!config) {
            throw new Error('Configuração de autenticação não encontrada para o projeto.');
          }
          const { db_table_name, db_email_column, db_password_column, db_password_hash_type, auth_type } = config;
          const { email, password } = credentials || {};

          if (auth_type === 'ldap') {
            if (!configLdap || !configLdap.enabled) {
              throw new Error('Integração LDAP não está ativada no metabuilder.config.json local do Agente CLI.');
            }

            console.log(chalk.gray(`[ LDAP ] Autenticando usuário: ${email}`));
            
            const authenticateLdap = () => new Promise((resolve, reject) => {
               const client = ldap.createClient({ url: configLdap.url });
               
               client.on('error', (err) => {
                 reject(new Error(`Erro de conexão com o LDAP: ${err.message}`));
               });

               client.bind(configLdap.bindDn, configLdap.bindPassword, (err) => {
                 if (err) return reject(new Error(`Falha no bind de serviço LDAP: ${err.message}`));
                 
                 const filter = configLdap.searchFilter.replace('{{username}}', email);
                 const opts = {
                   filter,
                   scope: 'sub',
                   attributes: ['dn', 'cn', 'mail', 'sAMAccountName']
                 };
                 
                 client.search(configLdap.baseDn, opts, (err, res) => {
                   if (err) return reject(new Error(`Falha na busca LDAP: ${err.message}`));
                   
                   let userDn = null;
                   let userData = null;

                   res.on('searchEntry', (entry) => {
                     userDn = entry.objectName || entry.dn;
                     userData = entry.object;
                   });

                   res.on('error', (err) => {
                     reject(new Error(`Erro na pesquisa LDAP: ${err.message}`));
                   });

                   res.on('end', (result) => {
                     if (result.status !== 0) return reject(new Error('Falha na conclusão da pesquisa LDAP'));
                     if (!userDn) return reject(new Error('Usuário não encontrado no servidor AD/LDAP corporativo.'));

                     // Bind como o usuário para checar a senha
                     const userClient = ldap.createClient({ url: configLdap.url });
                     userClient.on('error', () => {});
                     userClient.bind(userDn, password, (err) => {
                       if (err) {
                         userClient.unbind();
                         return reject(new Error('Senha incorreta'));
                       }
                       
                       userClient.unbind();
                       client.unbind();
                       resolve({
                         email: userData.mail || email,
                         name: userData.cn || userData.sAMAccountName || email,
                         external_id: userDn,
                         role: 'admin' // default para login LDAP, roles seriam geridas no studio
                       });
                     });
                   });
                 });
               });
            });

            const user = await authenticateLdap();
            result = { rows: [user] };
            console.log(chalk.green(`[ OK ] LOGIN LDAP: Usuário '${email}' autenticado com sucesso via rede corporativa.`));
          } else {
            if (!db_table_name || !db_email_column || !db_password_column) {
              throw new Error('Mapeamento do banco legado incompleto. Configure a tabela e colunas de e-mail/senha no Studio.');
            }

            const safeTable = db_table_name.replace(/[^a-zA-Z0-9_]/g, '');
            const safeEmailCol = db_email_column.replace(/[^a-zA-Z0-9_]/g, '');
            const safePasswordCol = db_password_column.replace(/[^a-zA-Z0-9_]/g, '');

            sql = `SELECT * FROM "${safeTable}" WHERE "${safeEmailCol}" = $1`;
            params = [email];
            if (dbType === 'oracle') sql = sql.replace(/\$(\d+)/g, ':$1');
            
            console.log(chalk.gray(`[ SQL ] Buscando usuário: ${sql}`));
            let selectResult;
            if (dbType === 'oracle') {
              const oraRes = await oracleConnection.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
              selectResult = { rows: oraRes.rows };
            } else {
              selectResult = await pgClient.query(sql, params);
            }
            
            if (selectResult.rows.length === 0) {
              throw new Error('Usuário não encontrado');
            }

            const userRow = selectResult.rows[0];
            const dbPassword = userRow[safePasswordCol];
            let isMatch = false;

            if (db_password_hash_type === 'plain') {
              isMatch = (password === dbPassword);
            } else if (db_password_hash_type === 'md5') {
              const hash = crypto.createHash('md5').update(password).digest('hex');
              isMatch = (hash === dbPassword);
            } else if (db_password_hash_type === 'sha256') {
              const hash = crypto.createHash('sha256').update(password).digest('hex');
              isMatch = (hash === dbPassword);
            } else if (db_password_hash_type === 'bcrypt') {
              isMatch = bcrypt.compareSync(password, dbPassword);
            } else {
              throw new Error(`Tipo de hash não suportado: ${db_password_hash_type}`);
            }

            if (!isMatch) {
              throw new Error('Senha incorreta');
            }

            const userObj = { ...userRow };
            delete userObj[safePasswordCol];
            
            // Se for N to N, precisamos buscar o papel na tabela de junção
            if (config.db_user_groups_type === 'n_to_n' && config.db_user_roles_table) {
              const safeUrTable = config.db_user_roles_table.replace(/[^a-zA-Z0-9_]/g, '');
              const safeUrUserCol = (config.db_user_roles_user_id_column || 'user_id').replace(/[^a-zA-Z0-9_]/g, '');
              const safeUrRoleCol = (config.db_user_roles_role_id_column || 'role_id').replace(/[^a-zA-Z0-9_]/g, '');
              const targetRoleKey = config.db_user_role_column || 'role_id'; // Chave esperada pelo frontend
              
              const pkCol = 'id'; // assumindo que id_local se mapeie primariamente via id ou similar. O ideal seria o frontend passar, mas 'id' atende a maioria.
              const userIdVal = userObj[pkCol] || userObj['ID'] || userObj['Id'];

              if (userIdVal) {
                const urSql = dbType === 'oracle' 
                  ? `SELECT "${safeUrRoleCol}" FROM "${safeUrTable}" WHERE "${safeUrUserCol}" = :1` 
                  : `SELECT "${safeUrRoleCol}" FROM "${safeUrTable}" WHERE "${safeUrUserCol}" = $1`;
                
                try {
                  let urResult;
                  if (dbType === 'oracle') {
                    const oraRes = await oracleConnection.execute(urSql, [userIdVal], { outFormat: oracledb.OUT_FORMAT_OBJECT });
                    urResult = { rows: oraRes.rows };
                  } else {
                    urResult = await pgClient.query(urSql, [userIdVal]);
                  }
                  
                  if (urResult.rows.length > 0) {
                    userObj[targetRoleKey] = urResult.rows[0][safeUrRoleCol] || urResult.rows[0][safeUrRoleCol.toLowerCase()];
                  }
                } catch (urErr) {
                  console.error(chalk.yellow(`[ AVISO ] Falha ao buscar papel N:N para o usuário '${email}': ${urErr.message}`));
                }
              }
            }
            
            result = { rows: [userObj] };
            console.log(chalk.green(`[ OK ] LOGIN: Usuário '${email}' autenticado com sucesso.`));
          }
        }
        else if (action === 'get_users') {
          const { config, limit = 100, offset = 0 } = payload.payload;
          if (!config) {
            throw new Error('Configuração de autenticação não encontrada para o projeto.');
          }
          const { db_table_name, db_email_column, db_password_column } = config;

          if (!db_table_name || !db_email_column) {
            throw new Error('Mapeamento do banco legado incompleto.');
          }

          const safeTable = db_table_name.replace(/[^a-zA-Z0-9_]/g, '');
          const safeEmailCol = db_email_column.replace(/[^a-zA-Z0-9_]/g, '');

          if (dbType === 'oracle') {
            sql = `SELECT * FROM "${safeTable}" ORDER BY "${safeEmailCol}" ASC OFFSET :1 ROWS FETCH NEXT :2 ROWS ONLY`;
            params = [offset, limit];
          } else {
            sql = `SELECT * FROM "${safeTable}" ORDER BY "${safeEmailCol}" ASC LIMIT $1 OFFSET $2`;
            params = [limit, offset];
          }
          
          console.log(chalk.gray(`[ SQL ] Buscando usuários: ${sql}`));
          let selectResult;
          if (dbType === 'oracle') {
            const oraRes = await oracleConnection.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
            selectResult = { rows: oraRes.rows };
          } else {
            selectResult = await pgClient.query(sql, params);
          }
          
          let safeRows = selectResult.rows;
          if (db_password_column) {
             const safePasswordCol = db_password_column.replace(/[^a-zA-Z0-9_]/g, '');
             safeRows = safeRows.map(row => {
               const userObj = { ...row };
               delete userObj[safePasswordCol];
               return userObj;
             });
          }

          result = { rows: safeRows };
          console.log(chalk.green(`[ OK ] GET_USERS: Retornou ${safeRows.length} usuários.`));
        }
        else if (action === 'insert') {
          const data = payload.payload.data; // { coluna: "valor" }
          const keys = Object.keys(data).map(k => `"${k.replace(/[^a-zA-Z0-9_]/g, '')}"`);
          const values = Object.values(data);
          let placeholders;
          
          if (dbType === 'oracle') {
            placeholders = values.map((_, i) => `:${i + 1}`);
            sql = `INSERT INTO "${safeTable}" (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;
          } else {
            placeholders = values.map((_, i) => `$${i + 1}`);
            sql = `INSERT INTO "${safeTable}" (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
          }
          
          params = values;
          if (dbType === 'oracle') {
            await oracleConnection.execute(sql, params, { autoCommit: true });
            result = { rows: [] };
          } else {
            result = await pgClient.query(sql, params);
          }
          if (bpmEngine && result.rows && result.rows.length > 0) {
            bpmEngine.processEvent(safeTable, 'INSERT', result.rows[0]).then(async () => {
              let finalData = result.rows[0];
              try {
                if (dbType === 'postgres' && result.rows[0].id) {
                  const res = await pgClient.query(`SELECT * FROM "${safeTable}" WHERE "id" = $1`, [result.rows[0].id]);
                  if (res.rows.length > 0) finalData = res.rows[0];
                }
              } catch (e) {
                console.error('[BPM] Falha ao re-buscar dados inseridos:', e.message);
              }
              channel.send({
                type: 'broadcast',
                event: 'bpm_workflow_completed',
                payload: { table: safeTable, action: 'INSERT', data: finalData }
              });
            }).catch(err => {
              console.error(chalk.red(`[BPM] Erro ao processar INSERT:`), err);
            });
          }
          console.log(chalk.green(`[ OK ] INSERT: 1 linha criada.`));
        }
        else if (action === 'update') {
          const { idColumn, idValue, data } = payload.payload;
          const safeIdCol = idColumn.replace(/[^a-zA-Z0-9_]/g, '');

          // Detecta e remove colunas GENERATED ALWAYS AS antes de executar o UPDATE.
          // Faz até 5 tentativas removendo automaticamente a coluna rejeitada pelo Postgres.
          let currentData = { ...data };
          let updateResult = null;
          let updateAttempts = 0;
          const MAX_UPDATE_RETRIES = 5;

          while (updateAttempts < MAX_UPDATE_RETRIES) {
            updateAttempts++;
            const colNames = Object.keys(currentData);

            if (colNames.length === 0) {
              console.log(chalk.yellow(`[ AVISO ] Nenhuma coluna atualizável restante para '${safeTable}'. UPDATE ignorado.`));
              result = { rows: [] };
              break;
            }

            const keys = colNames.map(k => `"${k.replace(/[^a-zA-Z0-9_]/g, '')}"`);
            const values = Object.values(currentData);
            let setClause;
            if (dbType === 'oracle') {
              setClause = keys.map((key, i) => `${key} = :${i + 1}`).join(', ');
              sql = `UPDATE "${safeTable}" SET ${setClause} WHERE "${safeIdCol}" = :${values.length + 1}`;
            } else {
              setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
              sql = `UPDATE "${safeTable}" SET ${setClause} WHERE "${safeIdCol}" = $${values.length + 1} RETURNING *`;
            }
            params = [...values, idValue];

            try {
              if (dbType === 'oracle') {
                 await oracleConnection.execute(sql, params, { autoCommit: true });
                 updateResult = { rows: [] };
              } else {
                 updateResult = await pgClient.query(sql, params);
              }
              result = updateResult;
              if (bpmEngine && result.rows && result.rows.length > 0) {
                bpmEngine.processEvent(safeTable, 'UPDATE', result.rows[0]).then(async () => {
                  let finalData = result.rows[0];
                  try {
                    if (dbType === 'postgres') {
                      const res = await pgClient.query(`SELECT * FROM "${safeTable}" WHERE "${safeIdCol}" = $1`, [idValue]);
                      if (res.rows.length > 0) finalData = res.rows[0];
                    }
                  } catch (e) {
                    console.error('[BPM] Falha ao re-buscar dados atualizados:', e.message);
                  }

                  channel.send({
                    type: 'broadcast',
                    event: 'bpm_workflow_completed',
                    payload: { table: safeTable, action: 'UPDATE', data: finalData }
                  });
                }).catch(err => {
                  console.error(chalk.red(`[BPM] Erro ao processar UPDATE:`), err);
                });
              }
              console.log(chalk.green(`[ OK ] UPDATE: 1 linha atualizada.`));
              break; // Sucesso — sai do loop
            } catch (updateErr) {
              const errMsg = updateErr.message || '';
              // Detecta erro de coluna gerada: 'column "col" can only be updated to DEFAULT'
              // ou versão PT: 'a coluna "col" só pode ser atualizada para DEFAULT'
              const genColMatch = errMsg.match(/["\u201c\u201d]([^"\u201c\u201d]+)["\u201c\u201d]/);
              const isGenColError = errMsg.includes('DEFAULT') && genColMatch;

              if (isGenColError) {
                const genColName = genColMatch[1];
                console.log(chalk.yellow(`[ AVISO ] Coluna "${genColName}" é GENERATED — removendo e repetindo UPDATE (tentativa ${updateAttempts})...`));
                delete currentData[genColName];
                // Continua para a próxima tentativa
              } else {
                // Erro não relacionado a coluna gerada — relança para o catch externo
                throw updateErr;
              }
            }
          }

          if (!result) {
            throw new Error(`Não foi possível executar o UPDATE após ${MAX_UPDATE_RETRIES} tentativas.`);
          }
        }
        else if (action === 'delete') {
          const { idColumn, idValue } = payload.payload;
          const safeIdCol = idColumn.replace(/[^a-zA-Z0-9_]/g, '');
          
          let deletedRowData = { [safeIdCol]: idValue };

          if (dbType === 'oracle') {
            sql = `DELETE FROM "${safeTable}" WHERE "${safeIdCol}" = :1`;
            params = [idValue];
            await oracleConnection.execute(sql, params, { autoCommit: true });
            result = { rows: [] };
          } else {
            sql = `DELETE FROM "${safeTable}" WHERE "${safeIdCol}" = $1 RETURNING *`;
            params = [idValue];
            result = await pgClient.query(sql, params);
            if (result.rows.length > 0) {
              deletedRowData = result.rows[0];
            }
          }
          console.log(chalk.green(`[ OK ] DELETE: 1 linha removida.`));

          if (bpmEngine) {
            bpmEngine.processEvent(safeTable, 'record_deleted', deletedRowData).catch(err => {
              console.error(chalk.red(`[BPM] Erro ao processar DELETE:`), err);
            });
          }
        } else if (action === 'execute_custom') {
          sql = payload.payload.query || payload.payload.sql;
          params = payload.payload.params || [];
          
          if (!sql) {
            throw new Error('Query SQL não fornecida para a ação customizada.');
          }

          if (dbType === 'oracle') {
            sql = sql.replace(/\$(\d+)/g, ':$1');
          }

          console.log(chalk.gray(`[ SQL ] Executando Custom Action: ${sql}`));
          let execResult;
          if (dbType === 'oracle') {
            const oraRes = await oracleConnection.execute(sql, params, { autoCommit: true, outFormat: oracledb.OUT_FORMAT_OBJECT });
            execResult = { rows: oraRes.rows || [] };
          } else {
            execResult = await pgClient.query(sql, params);
          }
          result = execResult;
          console.log(chalk.green(`[ OK ] CUSTOM ACTION executada.`));
        } else if (action === 'trigger_bpm') {
          const { workflows, rowData, tableName } = payload.payload;
          const safeTable = (tableName || table || '').replace(/[^a-zA-Z0-9_]/g, '');

          if (workflows && workflows.length > 0 && bpmEngine) {
             await bpmEngine.processCustomAction(workflows, safeTable, rowData);
          }
          
          let finalData = rowData;
          try {
             const pkValue = rowData.id || rowData.ID || rowData.Id;
             if (dbType === 'postgres' && pkValue) {
               const res = await pgClient.query(`SELECT * FROM "${safeTable}" WHERE "id" = $1`, [pkValue]);
               if (res.rows.length > 0) finalData = res.rows[0];
             } else if (dbType === 'oracle' && pkValue) {
               const res = await oracleConnection.execute(`SELECT * FROM "${safeTable}" WHERE "id" = :1`, [pkValue], { outFormat: oracledb.OUT_FORMAT_OBJECT });
               if (res.rows && res.rows.length > 0) finalData = res.rows[0];
             }
          } catch(e) {
             console.error('[BPM] Falha ao re-buscar dados atualizados:', e.message);
          }
          
          channel.send({
             type: 'broadcast',
             event: 'bpm_workflow_completed',
             payload: { table: safeTable, action: 'CUSTOM', data: finalData }
          });
          
          result = { rows: [] };
          console.log(chalk.green(`[ OK ] BPM TRIGGER ACTION executada para fluxos customizados.`));
        } else if (action === 'sync_bpm') {
          if (bpmEngine) {
             console.log(chalk.yellow(`[BPM] Sincronização forçada dos fluxos recebida.`));
             await bpmEngine.syncWorkflows();
          }
          result = { rows: [] };
          console.log(chalk.green(`[ OK ] Fluxos BPM sincronizados com sucesso.`));
        } else {
          throw new Error('Ação não suportada');
        }

        // Envia o resultado de volta para o cliente (Next.js)
        const responsePayload = {
          queryId,
          success: true,
          action: action,
          data: result.rows
        };
        
        if (action === 'count_records') {
          responsePayload.total = result.totalRows;
        }

        // Evento Genérico (para o Dashboard BI)
        await channel.send({
          type: 'broadcast',
          event: 'sql_result',
          payload: responsePayload
        });

        // Evento Específico (para compatibilidade com a Grade/Grid)
        await channel.send({
          type: 'broadcast',
          event: `query_result_${queryId}`,
          payload: responsePayload
        });

      } catch (err) {
        console.log(chalk.red(`[ ERRO ] Falha na query:`), err.message);
        const errorPayload = {
          queryId,
          success: false,
          error: err.message
        };

        await channel.send({
          type: 'broadcast',
          event: 'sql_result',
          payload: errorPayload
        });

        await channel.send({
          type: 'broadcast',
          event: `query_result_${queryId}`,
          payload: errorPayload
        });
      }
    });

    require('./export_handler').registerExportHandlers(channel, pgClient, oracleConnection, dbType, secretToken, projectId, configData, supabase);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(chalk.green.bold('🔌 Túnel Seguro estabelecido. Tudo pronto!'));
      }
    });
}

const fs = require('fs');

async function run() {
  console.log(chalk.bold.cyan('\n🚀 MetaBuilderPRO CLI - Enterprise Gateway\n'));

  const configPath = './metabuilder.config.json';
  let configData = null;

  // 1. Tenta carregar as conexões do arquivo
  if (fs.existsSync(configPath)) {
    console.log(chalk.yellow('📄 Arquivo metabuilder.config.json detectado.'));
    try {
      configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      console.log(chalk.red('❌ Erro ao ler o arquivo metabuilder.config.json: ', err.message));
    }
  }

  let mode = configData?.mode;

  // 2. Se o "mode" não existir no JSON, nós perguntamos na tela!
  if (!mode || mode === 'ask') {
    const initial = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'O que deseja fazer?',
        choices: [
          { name: '1. Iniciar Túnel Seguro de Dados (Escuta Contínua)', value: 'tunnel' },
          { name: '2. Sincronizar Estrutura do Banco (Introspecção)', value: 'sync' }
        ]
      }
    ]);
    mode = initial.mode;
  }

  // 3. Executa a Ação com base no ConfigFile (Gateway)
  if (configData && configData.connections && configData.connections.length > 0) {
    if (mode === 'tunnel') {
      console.log(chalk.gray(`Iniciando Túnel para ${configData.connections.length} projeto(s) simultaneamente...`));
      
      const tunnelPromises = [];
      configData.connections.forEach(conn => {
        if (Array.isArray(conn.connectionsString)) {
          conn.connectionsString.forEach(dbConfig => {
            const dbType = dbConfig.type || 'postgres';
            tunnelPromises.push(startTunnel(conn.projectId, conn.secretToken, dbConfig.name, dbConfig.connectionString, configData.supabaseUrl, configData.supabaseAnonKey, configData.ldap, dbType, configData));
          });
        } else if (conn.connectionString) {
          const dbType = conn.type || 'postgres';
          tunnelPromises.push(startTunnel(conn.projectId, conn.secretToken, 'public', conn.connectionString, configData.supabaseUrl, configData.supabaseAnonKey, configData.ldap, dbType, configData));
        }
      });
      await Promise.all(tunnelPromises);
      
      // Mantém o processo vivo esperando o usuário apertar Enter
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question(chalk.gray(`\n[ TÚNEL ATIVO ] Pressione ENTER a qualquer momento para encerrar o túnel e fechar a janela...\n`), () => {
        process.exit(0);
      });
      return; 
    } 
    else if (mode === 'sync') {
      console.log(chalk.gray(`Sincronizando esquemas de ${configData.connections.length} projeto(s)...`));
      const apiUrl = configData.apiUrl || 'http://localhost:3000/api/metadata/sync';
      
      for (const conn of configData.connections) {
        if (Array.isArray(conn.connectionsString)) {
          for (const dbConfig of conn.connectionsString) {
            const dbType = dbConfig.type || 'postgres';
            const schemaDefinition = dbType === 'oracle' 
              ? await introspectOracle(dbConfig.connectionString) 
              : await introspectPostgres(dbConfig.connectionString);
            console.log(chalk.blue(`\nEnviando metadados do projeto ${conn.projectId} (Schema: ${dbConfig.name})...`));
            try {
              await axios.post(apiUrl, {
                projectId: conn.projectId,
                connectionName: dbConfig.name,
                metadata: schemaDefinition
              }, {
                headers: { 'Authorization': `Bearer ${conn.secretToken}`, 'Content-Type': 'application/json' }
              });
              console.log(chalk.green.bold(`✅ Projeto ${conn.projectId} (${dbConfig.name}) sincronizado com sucesso!`));
            } catch (error) {
              const errorMsg = formatAxiosError(error);
              console.error(chalk.red.bold(`❌ Falha no projeto ${conn.projectId} (${dbConfig.name}):`), errorMsg);
            }
          }
        } else if (conn.connectionString) {
          const dbType = conn.type || 'postgres';
          const schemaDefinition = dbType === 'oracle' 
            ? await introspectOracle(conn.connectionString) 
            : await introspectPostgres(conn.connectionString);
          console.log(chalk.blue(`\nEnviando metadados do projeto ${conn.projectId}...`));
          try {
            await axios.post(apiUrl, {
              projectId: conn.projectId,
              connectionName: 'public',
              metadata: schemaDefinition
            }, {
              headers: { 'Authorization': `Bearer ${conn.secretToken}`, 'Content-Type': 'application/json' }
            });
            console.log(chalk.green.bold(`✅ Projeto ${conn.projectId} sincronizado com sucesso!`));
          } catch (error) {
            const errorMsg = formatAxiosError(error);
            console.error(chalk.red.bold(`❌ Falha no projeto ${conn.projectId}:`), errorMsg);
          }
        }
      }
      console.log(chalk.yellow('\nProcesso de Sincronização finalizado.'));
      process.exit(0);
    }
  } 
  // 4. Fallback: Se não tem config.json, pergunta as credenciais na mão
  else {
    console.log(chalk.yellow('⚠️ Nenhuma conexão encontrada no metabuilder.config.json. Iniciando modo manual...'));
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectId',
        message: 'Qual é o ID do Projeto no MetaBuilderPRO?',
        validate: input => input ? true : 'O ID do projeto é obrigatório.'
      },
      {
        type: 'password',
        name: 'secretToken',
        message: 'Insira o Token Secreto do Projeto (Ou qualquer valor para testes):',
        default: 'test-token'
      },
      {
        type: 'list',
        name: 'dbType',
        message: 'Qual é o tipo de banco de dados local?',
        choices: [
          { name: 'PostgreSQL', value: 'postgres' },
          { name: 'Oracle', value: 'oracle' }
        ]
      },
      {
        type: 'input',
        name: 'connectionString',
        message: 'String de conexão (Postgres: postgresql://... ou Oracle: user/pass@host:port/service):',
        validate: input => input ? true : 'A string de conexão é obrigatória.'
      }
    ]);

    if (mode === 'sync') {
      const schemaDefinition = answers.dbType === 'oracle' 
        ? await introspectOracle(answers.connectionString) 
        : await introspectPostgres(answers.connectionString);
      console.log(chalk.blue('\nEnviando metadados para a plataforma MetaBuilderPRO...'));
      try {
        await axios.post('http://localhost:3000/api/metadata/sync', {
          projectId: answers.projectId,
          connectionName: 'public',
          metadata: schemaDefinition
        }, {
          headers: { 'Authorization': `Bearer ${answers.secretToken}`, 'Content-Type': 'application/json' }
        });
        console.log(chalk.green.bold('\n✅ Sincronização concluída com sucesso!'));
      } catch (error) {
        const errorMsg = formatAxiosError(error);
        console.error(chalk.red.bold('\n❌ Falha ao enviar dados para a API.'), errorMsg);
      }
      process.exit(0);
    } else if (mode === 'tunnel') {
      await startTunnel(answers.projectId, answers.secretToken, 'public', answers.connectionString, null, null, null, answers.dbType);
      
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question(chalk.gray(`\n[ TÚNEL ATIVO ] Pressione ENTER a qualquer momento para encerrar o túnel e fechar a janela...\n`), () => {
        process.exit(0);
      });
    }
  }
}

run().catch(err => {
  console.error(chalk.red('\n❌ Erro fatal:'), err);
  // Mantém aberto para visualização do erro
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  rl.question('\nPressione ENTER para fechar...', () => process.exit(1));
});
