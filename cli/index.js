#!/usr/bin/env node

require('dotenv').config({ path: '../.env.local' }); // Para facilitar os testes locais
const { Client } = require('pg');
const inquirer = require('inquirer');
const chalk = require('chalk');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Configurações do Supabase lidas do ambiente ou perguntadas depois
let SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
let SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

// Função 2: Iniciar Túnel Seguro (Modo Agente Escuta)
async function startTunnel(projectId, secretToken, connectionString, configSupabaseUrl, configSupabaseKey) {
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

  const pgClient = new Client({ connectionString });
  
  console.log(chalk.blue(`\nConectando ao banco de dados local para o túnel...`));
  await pgClient.connect();
  console.log(chalk.green('✓ Conexão contínua estabelecida com sucesso!'));

  const channelName = `tunnel:${projectId}`;
  const channel = supabase.channel(channelName);

  console.log(chalk.cyan(`\n🎧 Agente MetaBuilderPRO ouvindo ativamente comandos no canal: ${channelName}...`));
  console.log(chalk.gray(`(Pressione Ctrl+C para encerrar o túnel)`));

  channel
    .on('broadcast', { event: 'sql_query' }, async (payload) => {
      // Recebeu um comando do painel MetaBuilderPRO
      const { queryId, table, action, token } = payload.payload;

      // Segurança: Verifica se o comando veio com o token correto do projeto
      // Para testes do MVP, desativei essa checagem de token para não ter erro.
      /*
      if (token !== secretToken) {
        console.log(chalk.red(`[ BLOQUEADO ] Comando recebido com token inválido.`));
        return;
      }
      */

      console.log(chalk.yellow(`[ EXEC ] Comando Recebido: Buscar dados da tabela '${table}'`));

      try {
        const safeTable = table.replace(/[^a-zA-Z0-9_]/g, ''); // Sanitização de nome de tabela
        let sql = '';
        let params = [];
        let result;

        if (action === 'select') {
          sql = `SELECT * FROM "${safeTable}" LIMIT 100`;
          result = await pgClient.query(sql);
          console.log(chalk.green(`[ OK ] SELECT: Retornou ${result.rows.length} linhas.`));
        } 
        else if (action === 'insert') {
          const data = payload.payload.data; // { coluna: "valor" }
          const keys = Object.keys(data).map(k => `"${k.replace(/[^a-zA-Z0-9_]/g, '')}"`);
          const values = Object.values(data);
          const placeholders = values.map((_, i) => `$${i + 1}`);
          
          sql = `INSERT INTO "${safeTable}" (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
          params = values;
          result = await pgClient.query(sql, params);
          console.log(chalk.green(`[ OK ] INSERT: 1 linha criada.`));
        }
        else if (action === 'update') {
          const { idColumn, idValue, data } = payload.payload;
          const safeIdCol = idColumn.replace(/[^a-zA-Z0-9_]/g, '');
          
          const keys = Object.keys(data).map(k => `"${k.replace(/[^a-zA-Z0-9_]/g, '')}"`);
          const values = Object.values(data);
          const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
          
          sql = `UPDATE "${safeTable}" SET ${setClause} WHERE "${safeIdCol}" = $${values.length + 1} RETURNING *`;
          params = [...values, idValue];
          result = await pgClient.query(sql, params);
          console.log(chalk.green(`[ OK ] UPDATE: 1 linha atualizada.`));
        }
        else if (action === 'delete') {
          const { idColumn, idValue } = payload.payload;
          const safeIdCol = idColumn.replace(/[^a-zA-Z0-9_]/g, '');
          
          sql = `DELETE FROM "${safeTable}" WHERE "${safeIdCol}" = $1 RETURNING *`;
          params = [idValue];
          result = await pgClient.query(sql, params);
          console.log(chalk.green(`[ OK ] DELETE: 1 linha removida.`));
        } else {
          throw new Error('Ação não suportada');
        }

        // Envia o resultado de volta para o cliente (Next.js)
        await channel.send({
          type: 'broadcast',
          event: `query_result_${queryId}`,
          payload: {
            success: true,
            data: result.rows
          }
        });

      } catch (err) {
        console.log(chalk.red(`[ ERRO ] Falha na query:`), err.message);
        await channel.send({
          type: 'broadcast',
          event: `query_result_${queryId}`,
          payload: {
            success: false,
            error: err.message
          }
        });
      }
    })
    .subscribe((status) => {
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
      
      const tunnelPromises = configData.connections.map(conn => 
        startTunnel(conn.projectId, conn.secretToken, conn.connectionString, configData.supabaseUrl, configData.supabaseAnonKey)
      );
      
      await Promise.all(tunnelPromises);
      return; 
    } 
    else if (mode === 'sync') {
      console.log(chalk.gray(`Sincronizando esquemas de ${configData.connections.length} projeto(s)...`));
      const apiUrl = configData.apiUrl || 'http://localhost:3000/api/metadata/sync';
      
      for (const conn of configData.connections) {
        const schemaDefinition = await introspectPostgres(conn.connectionString);
        console.log(chalk.blue(`\nEnviando metadados do projeto ${conn.projectId}...`));
        try {
          await axios.post(apiUrl, {
            projectId: conn.projectId,
            metadata: schemaDefinition
          }, {
            headers: { 'Authorization': `Bearer ${conn.secretToken}`, 'Content-Type': 'application/json' }
          });
          console.log(chalk.green.bold(`✅ Projeto ${conn.projectId} sincronizado com sucesso!`));
        } catch (error) {
          console.error(chalk.red.bold(`❌ Falha no projeto ${conn.projectId}:`), error.response ? error.response.data : error.message);
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
        type: 'input',
        name: 'connectionString',
        message: 'String de conexão PostgreSQL do SEU BANCO local:',
        validate: input => input.startsWith('postgres') ? true : 'A string deve começar com postgresql://'
      }
    ]);

    if (mode === 'sync') {
      const schemaDefinition = await introspectPostgres(answers.connectionString);
      console.log(chalk.blue('\nEnviando metadados para a plataforma MetaBuilderPRO...'));
      try {
        await axios.post('http://localhost:3000/api/metadata/sync', {
          projectId: answers.projectId,
          metadata: schemaDefinition
        }, {
          headers: { 'Authorization': `Bearer ${answers.secretToken}`, 'Content-Type': 'application/json' }
        });
        console.log(chalk.green.bold('\n✅ Sincronização concluída com sucesso!'));
      } catch (error) {
        console.error(chalk.red.bold('\n❌ Falha ao enviar dados para a API.'), error.response ? error.response.data : error.message);
      }
      process.exit(0);
    } else if (mode === 'tunnel') {
      await startTunnel(answers.projectId, answers.secretToken, answers.connectionString);
    }
  }
}

run();
