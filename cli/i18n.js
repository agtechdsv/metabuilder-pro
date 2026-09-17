'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');

const dictionaries = {
  pt: {
    cli_title: 'MetaBuilderPRO CLI - Enterprise Gateway',
    config_detected: 'Arquivo metabuilder.config.json detectado.',
    config_read_error: 'Erro ao ler o arquivo metabuilder.config.json: ',
    log_saved_at: 'Log sendo salvo em: {path}',
    sync_starting_for: 'Sincronizando esquemas de {count} projeto(s)...',
    connecting_db: 'Conectando ao banco de dados...',
    connecting_db_oracle: 'Conectando ao banco de dados Oracle...',
    conn_established: '✓ Conexão local estabelecida com sucesso!',
    conn_oracle_established: '✓ Conexão Oracle local estabelecida com sucesso!',
    reading_tables: 'Lendo tabelas...',
    reading_columns: 'Lendo colunas...',
    reading_pks: 'Lendo chaves primárias...',
    reading_fks: 'Lendo chaves estrangeiras (relacionamentos)...',
    metadata_read_tables: '✓ Lidos metadados de {count} tabelas.',
    sending_metadata_schema: 'Enviando metadados do projeto {projectId} (Schema: {schema})...',
    sending_metadata: 'Enviando metadados do projeto {projectId}...',
    sync_divergences_detected: '⚠️ Projeto {projectId} ({schema}): divergências detectadas — draft criado para revisão manual.',
    sync_divergences_detected_no_schema: '⚠️ Projeto {projectId}: divergências detectadas — draft criado para revisão manual.',
    sync_success_schema: '✅ Projeto {projectId} ({schema}) sincronizado com sucesso!',
    sync_success: '✅ Projeto {projectId} sincronizado com sucesso!',
    sync_failure_schema: '❌ Falha no projeto {projectId} ({schema}):',
    sync_failure: '❌ Falha no projeto {projectId}:',
    sync_process_finished: 'Processo de Sincronização finalizado.',
    sync_finished_success: 'Sincronização finalizada com sucesso',
    // Logger headers & sync labels
    header_mode: 'MetaBuilderPRO CLI -- Modo: {mode}',
    session_started: 'Sessao iniciada em: {time}',
    session_ended: 'Sessao encerrada.',
    sync_added: '+ ADICIONADO',
    sync_removed: '- REMOVIDO  ',
    sync_modified: '~ ALTERADO  ',
    sync_change: '? MUDANÇA   ',
    sync_table: 'Tabela',
    sync_columns_detected: '{count} coluna(s) detectada(s)',
    // Tunnel logs
    tunnel_starting_for: 'Iniciando Túnel para {count} projeto(s) simultaneamente...',
    tunnel_headless_daemon: '[ TÚNEL HEADLESS ] Daemon ativo. Aguardando comandos remotos...',
    tunnel_shutdown: '[ TÚNEL ] Recebido {signal}. Encerrando daemon...',
  },
  en: {
    cli_title: 'MetaBuilderPRO CLI - Enterprise Gateway',
    config_detected: 'metabuilder.config.json file detected.',
    config_read_error: 'Error reading metabuilder.config.json file: ',
    log_saved_at: 'Log being saved to: {path}',
    sync_starting_for: 'Synchronizing schemas of {count} project(s)...',
    connecting_db: 'Connecting to database...',
    connecting_db_oracle: 'Connecting to Oracle database...',
    conn_established: '✓ Local connection successfully established!',
    conn_oracle_established: '✓ Local Oracle connection successfully established!',
    reading_tables: 'Reading tables...',
    reading_columns: 'Reading columns...',
    reading_pks: 'Reading primary keys...',
    reading_fks: 'Reading foreign keys (relationships)...',
    metadata_read_tables: '✓ Metadata read for {count} tables.',
    sending_metadata_schema: 'Sending metadata for project {projectId} (Schema: {schema})...',
    sending_metadata: 'Sending metadata for project {projectId}...',
    sync_divergences_detected: '⚠️ Project {projectId} ({schema}): divergences detected — draft created for manual review.',
    sync_divergences_detected_no_schema: '⚠️ Project {projectId}: divergences detected — draft created for manual review.',
    sync_success_schema: '✅ Project {projectId} ({schema}) synchronized successfully!',
    sync_success: '✅ Project {projectId} synchronized successfully!',
    sync_failure_schema: '❌ Failure in project {projectId} ({schema}):',
    sync_failure: '❌ Failure in project {projectId}:',
    sync_process_finished: 'Synchronization process finished.',
    sync_finished_success: 'Synchronization finished successfully',
    // Logger headers & sync labels
    header_mode: 'MetaBuilderPRO CLI -- Mode: {mode}',
    session_started: 'Session started at: {time}',
    session_ended: 'Session ended.',
    sync_added: '+ ADDED     ',
    sync_removed: '- REMOVED   ',
    sync_modified: '~ MODIFIED  ',
    sync_change: '? CHANGE    ',
    sync_table: 'Table',
    sync_columns_detected: '{count} column(s) detected',
    // Tunnel logs
    tunnel_starting_for: 'Starting Tunnel for {count} project(s) simultaneously...',
    tunnel_headless_daemon: '[ HEADLESS TUNNEL ] Daemon active. Waiting for remote commands...',
    tunnel_shutdown: '[ TUNNEL ] Received {signal}. Shutting down daemon...',
  },
  es: {
    cli_title: 'MetaBuilderPRO CLI - Enterprise Gateway',
    config_detected: 'Archivo metabuilder.config.json detectado.',
    config_read_error: 'Error al leer el archivo metabuilder.config.json: ',
    log_saved_at: 'Registro guardándose en: {path}',
    sync_starting_for: 'Sincronizando esquemas de {count} proyecto(s)...',
    connecting_db: 'Conectando a la base de datos...',
    connecting_db_oracle: 'Conectando a la base de datos Oracle...',
    conn_established: '✓ ¡Conexión local establecida con éxito!',
    conn_oracle_established: '✓ ¡Conexión Oracle local establecida con éxito!',
    reading_tables: 'Leyendo tablas...',
    reading_columns: 'Leyendo columnas...',
    reading_pks: 'Leyendo claves primarias...',
    reading_fks: 'Leyendo claves foráneas (relaciones)...',
    metadata_read_tables: '✓ Leídos metadatos de {count} tablas.',
    sending_metadata_schema: 'Enviando metadatos del proyecto {projectId} (Schema: {schema})...',
    sending_metadata: 'Enviando metadatos del proyecto {projectId}...',
    sync_divergences_detected: '⚠️ Proyecto {projectId} ({schema}): divergencias detectadas — borrador creado para revisión manual.',
    sync_divergences_detected_no_schema: '⚠️ Proyecto {projectId}: divergencias detectadas — borrador creado para revisión manual.',
    sync_success_schema: '✅ ¡Proyecto {projectId} ({schema}) sincronizado con éxito!',
    sync_success: '✅ ¡Proyecto {projectId} sincronizado con éxito!',
    sync_failure_schema: '❌ Fallo en el proyecto {projectId} ({schema}):',
    sync_failure: '❌ Fallo en el proyecto {projectId}:',
    sync_process_finished: 'Proceso de sincronización finalizado.',
    sync_finished_success: 'Sincronización finalizada con éxito',
    // Logger headers & sync labels
    header_mode: 'MetaBuilderPRO CLI -- Modo: {mode}',
    session_started: 'Sesión iniciada en: {time}',
    session_ended: 'Sesión finalizada.',
    sync_added: '+ AÑADIDO   ',
    sync_removed: '- ELIMINADO ',
    sync_modified: '~ MODIFICADO',
    sync_change: '? CAMBIO    ',
    sync_table: 'Tabla',
    sync_columns_detected: '{count} columna(s) detectada(s)',
    // Tunnel logs
    tunnel_starting_for: 'Iniciando Túnel para {count} proyecto(s) simultáneamente...',
    tunnel_headless_daemon: '[ TÚNEL HEADLESS ] Daemon activo. Esperando comandos remotos...',
    tunnel_shutdown: '[ TÚNEL ] Recibido {signal}. Finalizando daemon...',
  }
};

function detectLanguage() {
  const langArg = process.argv.find(arg => arg.startsWith('--lang='));
  if (langArg) {
    const val = langArg.split('=')[1].trim().toLowerCase();
    if (dictionaries[val]) return val;
  }

  // Check .metabuilder/language.txt in user profile
  const userProfile = process.env.USERPROFILE || process.env.HOME;
  if (userProfile) {
    try {
      const p = path.join(userProfile, '.metabuilder', 'language.txt');
      if (fs.existsSync(p)) {
        const val = fs.readFileSync(p, 'utf8').trim().toLowerCase();
        if (dictionaries[val]) return val;
      }
    } catch (e) {}
  }

  // Check %APPDATA%/.metabuilder/language.txt
  if (process.env.APPDATA) {
    try {
      const p = path.join(process.env.APPDATA, '.metabuilder', 'language.txt');
      if (fs.existsSync(p)) {
        const val = fs.readFileSync(p, 'utf8').trim().toLowerCase();
        if (dictionaries[val]) return val;
      }
    } catch (e) {}
  }

  // Check temp dir
  try {
    const p = path.join(os.tmpdir(), 'metabuilder_language.txt');
    if (fs.existsSync(p)) {
      const val = fs.readFileSync(p, 'utf8').trim().toLowerCase();
      if (dictionaries[val]) return val;
    }
  } catch (e) {}

  return 'pt';
}

let currentLang = detectLanguage();

function setLanguage(lang) {
  if (lang && dictionaries[lang.toLowerCase()]) {
    currentLang = lang.toLowerCase();
  }
}

function getLanguage() {
  return currentLang;
}

function t(key, params = {}) {
  const dict = dictionaries[currentLang] || dictionaries.pt;
  let text = dict[key] || dictionaries.pt[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return text;
}

module.exports = {
  detectLanguage,
  setLanguage,
  getLanguage,
  t,
  dictionaries
};
