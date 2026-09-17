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
    sync_columns_detected: '{count} coluna(s) detectada(s)',
    // Tunnel logs
    tunnel_starting_for: 'Iniciando Túnel para {count} projeto(s) simultaneamente...',
    tunnel_headless_daemon: '[ TÚNEL HEADLESS ] Daemon ativo. Aguardando comandos remotos...',
    tunnel_shutdown: '[ TÚNEL ] Recebido {signal}. Encerrando daemon...',
    tunnel_connecting_db: 'Conectando ao banco de dados local para o túnel ({dbType})...',
    tunnel_conn_established: '✓ Conexão contínua estabelecida com sucesso! ({name})',
    tunnel_conn_failed: '❌ [FALHA DE CONEXÃO] Não foi possível conectar ao banco \'{name}\' ({dbType}):',
    tunnel_conn_warning: '⚠️ O túnel permanecerá ativo para atender e reportar erros deste banco, e os demais bancos continuam operando normalmente!',
    tunnel_agent_listening: '🎧 Agente MetaBuilderPRO ouvindo ativamente comandos no canal: {channel}...',
    tunnel_press_ctrl_c: '(Pressione Ctrl+C para encerrar o túnel)',
    tunnel_press_enter: '[ TÚNEL ATIVO ] Pressione ENTER a qualquer momento para encerrar o túnel e fechar a janela...',
    tunnel_ready: '🔌 Túnel Seguro estabelecido. Tudo pronto!',
    tunnel_blocked_token: '[ BLOQUEADO ] Comando recebido com token inválido para o projeto {projectId}.',
    tunnel_ignored_schema: '[ IGNORADO ] Comando destinado ao schema \'{incoming}\', mas este agente atende \'{expected}\'.',
    tunnel_command_received: '[ EXEC ] Comando Recebido no schema \'{schema}\': {action}',
    tunnel_db_disabled: '[MBLog] Log de banco desativado para este projeto.',
    tunnel_db_disabled_dyn: '[MBLog] Log de banco desativado dinamicamente.',
    bpm_init: '[BPM] Inicializando motor de automações...',
    bpm_schedules_cleared: '[BPM] Todos os agendamentos antigos foram limpos.',
    bpm_models_loaded: '[BPM-DEBUG] syncModels carregou {count} modelos para o projeto {projectId}',
    bpm_running: '[BPM] Motor rodando. Escutando {count} fluxos ativos.',
    bpm_flows_changed: '[BPM] Mudança detectada nos fluxos. Sincronizando...',
    bpm_init_failed: '[ Motor BPM ] Falha ao inicializar motor de automações:',
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
    tunnel_connecting_db: 'Connecting to local database for tunnel ({dbType})...',
    tunnel_conn_established: '✓ Continuous connection established successfully! ({name})',
    tunnel_conn_failed: '❌ [CONNECTION FAILURE] Could not connect to database \'{name}\' ({dbType}):',
    tunnel_conn_warning: '⚠️ The tunnel will remain active to serve and report errors for this database, while other databases continue operating normally!',
    tunnel_agent_listening: '🎧 MetaBuilderPRO Agent actively listening for commands on channel: {channel}...',
    tunnel_press_ctrl_c: '(Press Ctrl+C to terminate the tunnel)',
    tunnel_press_enter: '[ ACTIVE TUNNEL ] Press ENTER at any time to terminate the tunnel and close the window...',
    tunnel_ready: '🔌 Secure Tunnel established. All ready!',
    tunnel_blocked_token: '[ BLOCKED ] Command received with invalid token for project {projectId}.',
    tunnel_ignored_schema: '[ IGNORED ] Command intended for schema \'{incoming}\', but this agent serves \'{expected}\'.',
    tunnel_command_received: '[ EXEC ] Command Received on schema \'{schema}\': {action}',
    tunnel_db_disabled: '[MBLog] Database log disabled for this project.',
    tunnel_db_disabled_dyn: '[MBLog] Database log dynamically disabled.',
    bpm_init: '[BPM] Initializing automation engine...',
    bpm_schedules_cleared: '[BPM] All old schedules have been cleared.',
    bpm_models_loaded: '[BPM-DEBUG] syncModels loaded {count} models for project {projectId}',
    bpm_running: '[BPM] Engine running. Listening to {count} active flows.',
    bpm_flows_changed: '[BPM] Change detected in flows. Synchronizing...',
    bpm_init_failed: '[ BPM Engine ] Failed to initialize automation engine:',
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
    tunnel_connecting_db: 'Conectando a la base de datos local para el túnel ({dbType})...',
    tunnel_conn_established: '✓ ¡Conexión continua establecida con éxito! ({name})',
    tunnel_conn_failed: '❌ [FALLO DE CONEXIÓN] No se pudo conectar a la base de datos \'{name}\' ({dbType}):',
    tunnel_conn_warning: '⚠️ ¡El túnel permanecerá activo para atender y reportar errores de esta base de datos, mientras las demás siguen operando con normalidad!',
    tunnel_agent_listening: '🎧 Agente MetaBuilderPRO escuchando activamente comandos en el canal: {channel}...',
    tunnel_press_ctrl_c: '(Presione Ctrl+C para finalizar el túnel)',
    tunnel_press_enter: '[ TÚNEL ACTIVO ] Presione ENTER en cualquier momento para finalizar el túnel y cerrar la ventana...',
    tunnel_ready: '🔌 ¡Túnel Seguro establecido. Todo listo!',
    tunnel_blocked_token: '[ BLOQUEADO ] Comando recibido con token no válido para el proyecto {projectId}.',
    tunnel_ignored_schema: '[ IGNORADO ] Comando destinado al schema \'{incoming}\', pero este agente atiende \'{expected}\'.',
    tunnel_command_received: '[ EXEC ] Comando Recibido en schema \'{schema}\': {action}',
    tunnel_db_disabled: '[MBLog] Registro de base de datos deshabilitado para este proyecto.',
    tunnel_db_disabled_dyn: '[MBLog] Registro de base de datos deshabilitado dinámicamente.',
    bpm_init: '[BPM] Inicializando motor de automatizaciones...',
    bpm_schedules_cleared: '[BPM] Se han limpiado todas las programaciones anteriores.',
    bpm_models_loaded: '[BPM-DEBUG] syncModels cargó {count} modelos para el proyecto {projectId}',
    bpm_running: '[BPM] Motor en ejecución. Escuchando {count} flujos activos.',
    bpm_flows_changed: '[BPM] Cambio detectado en los flujos. Sincronizando...',
    bpm_init_failed: '[ Motor BPM ] Fallo al inicializar el motor de automatizaciones:',
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

const fallbackPatterns = [
  { regex: /Iniciando T[úu]nel para (\d+) projeto\(s\) simultaneamente\.\.\./i, en: (m) => `Starting Tunnel for ${m[1]} project(s) simultaneously...`, es: (m) => `Iniciando Túnel para ${m[1]} proyecto(s) simultáneamente...` },
  { regex: /Conectando ao banco de dados local para o t[úu]nel \((.*?)\)\.\.\./i, en: (m) => `Connecting to local database for tunnel (${m[1]})...`, es: (m) => `Conectando a la base de datos local para el túnel (${m[1]})...` },
  { regex: /Conex[ãa]o cont[íi]nua estabelecida com sucesso!\s*\((.*?)\)/i, en: (m) => `Continuous connection established successfully! (${m[1]})`, es: (m) => `¡Conexión continua establecida con éxito! (${m[1]})` },
  { regex: /Agente MetaBuilderPRO ouvindo ativamente comandos no canal:\s*(.*)/i, en: (m) => `MetaBuilderPRO Agent actively listening for commands on channel: ${m[1]}`, es: (m) => `Agente MetaBuilderPRO escuchando activamente comandos en el canal: ${m[1]}` },
  { regex: /\(Pressione Ctrl\+C para encerrar o t[úu]nel\)/i, en: '(Press Ctrl+C to terminate the tunnel)', es: '(Presione Ctrl+C para finalizar el túnel)' },
  { regex: /Log de banco desativado para este projeto\./i, en: 'Database log disabled for this project.', es: 'Registro de base de datos deshabilitado para este proyecto.' },
  { regex: /Log de banco desativado dinamicamente\./i, en: 'Database log dynamically disabled.', es: 'Registro de base de datos deshabilitado dinámicamente.' },
  { regex: /Inicializando motor de automa[çc][õo]es\.\.\./i, en: 'Initializing automation engine...', es: 'Inicializando motor de automatizaciones...' },
  { regex: /Todos os agendamentos antigos foram limpos\./i, en: 'All old schedules have been cleared.', es: 'Se han limpiado todas las programaciones anteriores.' },
  { regex: /syncModels carregou (\d+) modelos para o projeto\s*(.*)/i, en: (m) => `syncModels loaded ${m[1]} models for project ${m[2]}`, es: (m) => `syncModels cargó ${m[1]} modelos para el proyecto ${m[2]}` },
  { regex: /Motor rodando\.\s*Escutando (\d+) fluxos ativos\./i, en: (m) => `Engine running. Listening to ${m[1]} active flows.`, es: (m) => `Motor en ejecución. Escuchando ${m[1]} flujos activos.` },
  { regex: /T[úu]nel Seguro estabelecido\.\s*Tudo pronto!/i, en: 'Secure Tunnel established. All ready!', es: '¡Túnel Seguro establecido. Todo listo!' },
  { regex: /\[\s*T[ÚU]NEL HEADLESS\s*\]\s*Daemon ativo\.\s*Aguardando comandos remotos\.\.\./i, en: '[ HEADLESS TUNNEL ] Daemon active. Waiting for remote commands...', es: '[ TÚNEL HEADLESS ] Daemon activo. Esperando comandos remotos...' },
  { regex: /\[\s*T[ÚU]NEL ATIVO\s*\]\s*Pressione ENTER a qualquer momento para encerrar o t[úu]nel e fechar a janela\.\.\./i, en: '[ ACTIVE TUNNEL ] Press ENTER at any time to terminate the tunnel and close the window...', es: '[ TÚNEL ACTIVO ] Presione ENTER en cualquier momento para finalizar el túnel y cerrar la ventana...' },
  { regex: /\[\s*T[ÚU]NEL\s*\]\s*Recebido (.*?)\.\s*Encerrando daemon\.\.\./i, en: (m) => `[ TUNNEL ] Received ${m[1]}. Shutting down daemon...`, es: (m) => `[ TÚNEL ] Recibido ${m[1]}. Finalizando daemon...` },
  { regex: /\[\s*EXEC\s*\]\s*Comando Recebido no schema '(.*?)':\s*(.*)/i, en: (m) => `[ EXEC ] Command Received on schema '${m[1]}': ${m[2]}`, es: (m) => `[ EXEC ] Comando Recibido en schema '${m[1]}': ${m[2]}` },
  { regex: /\[\s*BLOQUEADO\s*\]\s*Comando recebido com token inv[áa]lido para o projeto (.*)\./i, en: (m) => `[ BLOCKED ] Command received with invalid token for project ${m[1]}.`, es: (m) => `[ BLOQUEADO ] Comando recibido con token no válido para el proyecto ${m[1]}.` },
  { regex: /\[\s*IGNORADO\s*\]\s*Comando destinado ao schema '(.*?)', mas este agente atende '(.*?)'\./i, en: (m) => `[ IGNORED ] Command intended for schema '${m[1]}', but this agent serves '${m[2]}'.`, es: (m) => `[ IGNORADO ] Comando destinado al schema '${m[1]}', pero este agente atiende '${m[2]}'.` },
  { regex: /Sessao iniciada em:\s*(.*)/i, en: (m) => `Session started at: ${m[1]}`, es: (m) => `Sesión iniciada en: ${m[1]}` },
  { regex: /Sessao encerrada\./i, en: 'Session ended.', es: 'Sesión finalizada.' },
];

function translateLogFallback(line, targetLang) {
  if (!line || targetLang === 'pt') return line;
  for (const pat of fallbackPatterns) {
    const match = line.match(pat.regex);
    if (match) {
      const replacer = pat[targetLang];
      if (typeof replacer === 'function') {
        return replacer(match);
      } else if (typeof replacer === 'string') {
        return replacer;
      }
    }
  }
  return line;
}

module.exports = {
  detectLanguage,
  setLanguage,
  getLanguage,
  t,
  dictionaries,
  translateLogFallback
};
