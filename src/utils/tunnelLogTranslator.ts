type SupportedLang = 'pt' | 'en' | 'es'

interface LogPattern {
  regex: RegExp
  en: string | ((match: RegExpMatchArray) => string)
  es: string | ((match: RegExpMatchArray) => string)
}

const patterns: LogPattern[] = [
  {
    regex: /Iniciando T[úu]nel para (\d+) projeto\(s\) simultaneamente\.\.\./i,
    en: (m) => `Starting Tunnel for ${m[1]} project(s) simultaneously...`,
    es: (m) => `Iniciando Túnel para ${m[1]} proyecto(s) simultáneamente...`,
  },
  {
    regex: /Arquivo metabuilder\.config\.json detectado\./i,
    en: 'metabuilder.config.json file detected.',
    es: 'Archivo metabuilder.config.json detectado.',
  },
  {
    regex: /Log sendo salvo em:\s*(.*)/i,
    en: (m) => `Log being saved to: ${m[1]}`,
    es: (m) => `Registro guardado en: ${m[1]}`,
  },
  {
    regex: /Conectando ao banco de dados local para o t[úu]nel \((.*?)\)\.\.\./i,
    en: (m) => `Connecting to local database for tunnel (${m[1]})...`,
    es: (m) => `Conectando a la base de datos local para el túnel (${m[1]})...`,
  },
  {
    regex: /Conex[ãa]o cont[íi]nua estabelecida com sucesso!\s*\((.*?)\)/i,
    en: (m) => `Continuous connection established successfully! (${m[1]})`,
    es: (m) => `¡Conexión continua establecida con éxito! (${m[1]})`,
  },
  {
    regex: /Agente MetaBuilderPRO ouvindo ativamente comandos no canal:\s*(.*)/i,
    en: (m) => `MetaBuilderPRO Agent actively listening for commands on channel: ${m[1]}`,
    es: (m) => `Agente MetaBuilderPRO escuchando activamente comandos en el canal: ${m[1]}`,
  },
  {
    regex: /\(Pressione Ctrl\+C para encerrar o t[úu]nel\)/i,
    en: '(Press Ctrl+C to terminate the tunnel)',
    es: '(Presione Ctrl+C para finalizar el túnel)',
  },
  {
    regex: /Log de banco desativado para este projeto\./i,
    en: 'Database log disabled for this project.',
    es: 'Registro de base de datos deshabilitado para este proyecto.',
  },
  {
    regex: /Inicializando motor de automa[çc][õo]es\.\.\./i,
    en: 'Initializing automation engine...',
    es: 'Inicializando motor de automatizaciones...',
  },
  {
    regex: /Todos os agendamentos antigos foram limpos\./i,
    en: 'All old schedules have been cleared.',
    es: 'Se han limpiado todas las programaciones anteriores.',
  },
  {
    regex: /T[úu]nel Seguro estabelecido\.\s*Tudo pronto!/i,
    en: 'Secure Tunnel established. All ready!',
    es: '¡Túnel Seguro establecido. Todo listo!',
  },
  {
    regex: /syncModels carregou (\d+) modelos para o projeto\s*(.*)/i,
    en: (m) => `syncModels loaded ${m[1]} models for project ${m[2]}`,
    es: (m) => `syncModels cargó ${m[1]} modelos para el proyecto ${m[2]}`,
  },
  {
    regex: /Motor rodando\.\s*Escutando (\d+) fluxos ativos\./i,
    en: (m) => `Engine running. Listening to ${m[1]} active flows.`,
    es: (m) => `Motor en ejecución. Escuchando ${m[1]} flujos activos.`,
  },
  {
    regex: /\[\s*T[ÚU]NEL HEADLESS\s*\]\s*Daemon ativo\.\s*Aguardando comandos remotos\.\.\./i,
    en: '[ HEADLESS TUNNEL ] Daemon active. Waiting for remote commands...',
    es: '[ TÚNEL HEADLESS ] Daemon activo. Esperando comandos remotos...',
  },
  {
    regex: /\[\s*T[ÚU]NEL ATIVO\s*\]\s*Pressione ENTER a qualquer momento para encerrar o t[úu]nel e fechar a janela\.\.\./i,
    en: '[ ACTIVE TUNNEL ] Press ENTER at any time to terminate the tunnel and close the window...',
    es: '[ TÚNEL ACTIVO ] Presione ENTER en cualquier momento para finalizar el túnel y cerrar la ventana...',
  },
  {
    regex: /\[\s*T[ÚU]NEL\s*\]\s*Recebido (.*?)\.\s*Encerrando daemon\.\.\./i,
    en: (m) => `[ TUNNEL ] Received ${m[1]}. Shutting down daemon...`,
    es: (m) => `[ TÚNEL ] Recibido ${m[1]}. Finalizando daemon...`,
  },
  {
    regex: /\[\s*EXEC\s*\]\s*Comando Recebido no schema '(.*?)':\s*(.*)/i,
    en: (m) => `[ EXEC ] Command Received on schema '${m[1]}': ${m[2]}`,
    es: (m) => `[ EXEC ] Comando Recibido en schema '${m[1]}': ${m[2]}`,
  },
  {
    regex: /\[\s*SQL\s*\]\s*Buscando usu[áa]rio:\s*(.*)/i,
    en: (m) => `[ SQL ] Searching user: ${m[1]}`,
    es: (m) => `[ SQL ] Buscando usuario: ${m[1]}`,
  },
  {
    regex: /\[\s*SQL\s*\]\s*Executando Custom Action:\s*(.*)/i,
    en: (m) => `[ SQL ] Executing Custom Action: ${m[1]}`,
    es: (m) => `[ SQL ] Ejecutando Acción Personalizada: ${m[1]}`,
  },
  {
    regex: /\[\s*OK\s*\]\s*LOGIN:\s*Usu[áa]rio\s*['"]?(.*?)['"]?\s*autenticado com sucesso\.?/i,
    en: (m) => `[ OK ] LOGIN: User '${m[1]}' authenticated successfully.`,
    es: (m) => `[ OK ] LOGIN: Usuario '${m[1]}' autenticado con éxito.`,
  },
  {
    regex: /\[\s*CLI\s*\]\s*Encerrado com c[óo]digo\s*(.*)/i,
    en: (m) => `[CLI] Exited with code ${m[1]}`,
    es: (m) => `[CLI] Finalizado con código ${m[1]}`,
  },
  {
    regex: /\[\s*OK\s*\]\s*CUSTOM ACTION executada\./i,
    en: '[ OK ] CUSTOM ACTION executed.',
    es: '[ OK ] ACCIÓN PERSONALIZADA ejecutada.',
  },
  {
    regex: /\[\s*OK\s*\]\s*BPM TRIGGER ACTION executada para fluxos customizados\./i,
    en: '[ OK ] BPM TRIGGER ACTION executed for custom flows.',
    es: '[ OK ] BPM TRIGGER ACTION ejecutada para flujos personalizados.',
  },
  {
    regex: /\[\s*OK\s*\]\s*BPM SYNC ACTION processada para evento (.*?) em (.*?)\./i,
    en: (m) => `[ OK ] BPM SYNC ACTION processed for event ${m[1]} on ${m[2]}.`,
    es: (m) => `[ OK ] BPM SYNC ACTION procesada para evento ${m[1]} en ${m[2]}.`,
  },
  {
    regex: /\[\s*OK\s*\]\s*Fluxos BPM sincronizados com sucesso\./i,
    en: '[ OK ] BPM workflows synchronized successfully.',
    es: '[ OK ] Flujos BPM sincronizados con éxito.',
  },
  {
    regex: /\[\s*OK\s*\]\s*Configura[çc][õo]es de Log sincronizadas dinamicamente\./i,
    en: '[ OK ] Log configurations synchronized dynamically.',
    es: '[ OK ] Configuraciones de registro sincronizadas dinámicamente.',
  },
  {
    regex: /\[\s*LOG\s*\]\s*Logs limpos com sucesso\./i,
    en: '[ LOG ] Logs cleared successfully.',
    es: '[ LOG ] Registros limpiados con éxito.',
  },
  {
    regex: /\[\s*LOG\s*\]\s*Retornou (\d+) entradas de log\./i,
    en: (m) => `[ LOG ] Returned ${m[1]} log entries.`,
    es: (m) => `[ LOG ] Retornó ${m[1]} entradas de registro.`,
  },
  {
    regex: /\[\s*BPM\s*\]\s*Sincroniza[çc][ãa]o for[çc]ada dos fluxos recebida\./i,
    en: '[ BPM ] Forced synchronization of workflows received.',
    es: '[ BPM ] Sincronización forzada de flujos recibida.',
  },
  {
    regex: /\[\s*BPM\s*\]\s*Falha ao re-buscar dados atualizados:\s*(.*)/i,
    en: (m) => `[ BPM ] Failed to refetch updated data: ${m[1]}`,
    es: (m) => `[ BPM ] Fallo al volver a buscar datos actualizados: ${m[1]}`,
  },
  {
    regex: /\[\s*AVISO\s*\]\s*Falha ao enviar broadcast '(.*?)':\s*(.*)/i,
    en: (m) => `[ WARNING ] Failed to send broadcast '${m[1]}': ${m[2]}`,
    es: (m) => `[ AVISO ] Fallo al enviar difusión '${m[1]}': ${m[2]}`,
  },
  {
    regex: /\[\s*ERRO\s*\]\s*Falha na query:\s*(.*)/i,
    en: (m) => `[ ERROR ] Query failed: ${m[1]}`,
    es: (m) => `[ ERROR ] Fallo en la consulta: ${m[1]}`,
  },
  {
    regex: /Sincronizando esquemas de (\d+) projeto\(s\)\.\.\./i,
    en: (m) => `Synchronizing schemas for ${m[1]} project(s)...`,
    es: (m) => `Sincronizando esquemas de ${m[1]} proyecto(s)...`,
  },
  {
    regex: /❌\s*Falha ao iniciar t[úu]nel para '(.*?)' \((.*?)\):\s*(.*)/i,
    en: (m) => `❌ Failed to start tunnel for '${m[1]}' (${m[2]}): ${m[3]}`,
    es: (m) => `❌ Fallo al iniciar túnel para '${m[1]}' (${m[2]}): ${m[3]}`,
  },
  {
    regex: /❌\s*\[FALHA NA INTROSPEC[ÇC][ÃA]O\]\s*Banco '(.*?)' \((.*?)\) inacess[íi]vel:\s*(.*)/i,
    en: (m) => `❌ [INTROSPECTION FAILED] Database '${m[1]}' (${m[2]}) inaccessible: ${m[3]}`,
    es: (m) => `❌ [FALLO EN INTROSPECCIÓN] Base de datos '${m[1]}' (${m[2]}) inaccesible: ${m[3]}`,
  },
  {
    regex: /\[SYSTEM\] Arquivo de log n[ãa]o encontrado\. O t[úu]nel pode n[ãa]o ter sido iniciado ainda\./i,
    en: '[SYSTEM] Log file not found. The tunnel may not have been started yet.',
    es: '[SYSTEM] Archivo de registro no encontrado. Es posible que el túnel aún no se haya iniciado.',
  },
  {
    regex: /\[SYSTEM\] Visualiza[çc][ãa]o de logs do t[úu]nel s[óo] est[áa] dispon[íi]vel no ambiente Desktop \(IDE\)\./i,
    en: '[SYSTEM] Tunnel log visualization is only available in the Desktop (IDE) environment.',
    es: '[SYSTEM] La visualización de registros del túnel solo está disponible en el entorno Desktop (IDE).',
  },
  {
    regex: /\[ERRO\] Falha ao ler o arquivo de log do t[úu]nel local\.\s*Detalhe:\s*(.*)/i,
    en: (m) => `[ERROR] Failed to read the local tunnel log file. Detail: ${m[1]}`,
    es: (m) => `[ERROR] Falló al leer el archivo de registro del túnel local. Detalle: ${m[1]}`,
  },
  {
    regex: /\[ERRO\] Falha ao iniciar escuta de logs em tempo real\.\s*Detalhe:\s*(.*)/i,
    en: (m) => `[ERROR] Failed to start real-time log listening. Detail: ${m[1]}`,
    es: (m) => `[ERROR] Falló al iniciar escucha de registros en tiempo real. Detalle: ${m[1]}`,
  },
  {
    regex: /\[ERRO\] Falha ao carregar m[óo]dulos do Desktop\.\s*Detalhe:\s*(.*)/i,
    en: (m) => `[ERROR] Failed to load Desktop modules. Detail: ${m[1]}`,
    es: (m) => `[ERROR] Falló al cargar módulos del Desktop. Detalle: ${m[1]}`,
  },
  {
    regex: /\[Build\] Iniciando npm install\.\.\./i,
    en: '[Build] Starting npm install...',
    es: '[Build] Iniciando npm install...',
  },
  {
    regex: /\[Build\] npm install conclu[íi]do com sucesso!/i,
    en: '[Build] npm install completed successfully!',
    es: '[Build] ¡npm install completado con éxito!',
  },
  {
    regex: /\[Build\] npm install falhou com c[óo]digo (\d+)/i,
    en: (m) => `[Build] npm install failed with code ${m[1]}`,
    es: (m) => `[Build] npm install falló con código ${m[1]}`,
  },
  {
    regex: /Iniciando Sincroniza[çc][ãa]o Geral\.\.\./i,
    en: 'Starting Global Synchronization...',
    es: 'Iniciando Sincronización General...',
  },
  {
    regex: /Conectando ao banco de dados\.\.\./i,
    en: 'Connecting to database...',
    es: 'Conectando a la base de datos...',
  },
  {
    regex: /✓\s*Conex[ãa]o local estabelecida com sucesso!/i,
    en: '✓ Local connection successfully established!',
    es: '✓ ¡Conexión local establecida con éxito!',
  },
  {
    regex: /Lendo tabelas\.\.\./i,
    en: 'Reading tables...',
    es: 'Leyendo tablas...',
  },
  {
    regex: /Lendo colunas\.\.\./i,
    en: 'Reading columns...',
    es: 'Leyendo columnas...',
  },
  {
    regex: /Lendo chaves prim[áa]rias\.\.\./i,
    en: 'Reading primary keys...',
    es: 'Leyendo claves primarias...',
  },
  {
    regex: /Lendo chaves estrangeiras \(relacionamentos\)\.\.\./i,
    en: 'Reading foreign keys (relationships)...',
    es: 'Leyendo claves foráneas (relaciones)...',
  },
  {
    regex: /✓\s*Lidos metadados de (\d+) tabelas\./i,
    en: (m) => `✓ Metadata read for ${m[1]} tables.`,
    es: (m) => `✓ Leídos metadatos de ${m[1]} tablas.`,
  },
  {
    regex: /Conectando ao banco de dados Oracle\.\.\./i,
    en: 'Connecting to Oracle database...',
    es: 'Conectando a la base de datos Oracle...',
  },
  {
    regex: /✓\s*Conex[ãa]o Oracle local estabelecida com sucesso!/i,
    en: '✓ Local Oracle connection successfully established!',
    es: '✓ ¡Conexión Oracle local establecida con éxito!',
  },
  {
    regex: /Enviando metadados do projeto\s+([^\s]+)\s+\(Schema:\s*([^\)]+)\)\.\.\./i,
    en: (m) => `Sending metadata for project ${m[1]} (Schema: ${m[2]})...`,
    es: (m) => `Enviando metadatos del proyecto ${m[1]} (Schema: ${m[2]})...`,
  },
  {
    regex: /Enviando metadados do projeto\s+([^\s\.]+)\.\.\./i,
    en: (m) => `Sending metadata for project ${m[1]}...`,
    es: (m) => `Enviando metadatos del proyecto ${m[1]}...`,
  },
  {
    regex: /\[SYNC\]\s*\+\s*ADICIONADO\s*\|\s*Tabela:\s*([^\s|]+)\s*\|\s*(\d+)\s*coluna\(s\) detectada\(s\)(.*)/i,
    en: (m) => `[SYNC] + ADDED | Table: ${m[1]} | ${m[2]} column(s) detected${m[3]}`,
    es: (m) => `[SYNC] + AÑADIDO | Tabla: ${m[1]} | ${m[2]} columna(s) detectada(s)${m[3]}`,
  },
  {
    regex: /\[SYNC\]\s*\-\s*REMOVIDO\s*\|\s*Tabela:\s*([^\s|]+)\s*\|\s*(.*)/i,
    en: (m) => `[SYNC] - REMOVED | Table: ${m[1]} | ${m[2]}`,
    es: (m) => `[SYNC] - ELIMINADO | Tabla: ${m[1]} | ${m[2]}`,
  },
  {
    regex: /\[SYNC\]\s*~\s*ALTERADO\s*\|\s*Tabela:\s*([^\s|]+)\s*\|\s*(.*)/i,
    en: (m) => `[SYNC] ~ MODIFIED | Table: ${m[1]} | ${m[2]}`,
    es: (m) => `[SYNC] ~ MODIFICADO | Tabla: ${m[1]} | ${m[2]}`,
  },
  {
    regex: /✅\s*Projeto\s+(.*?)\s*\((.*?)\)\s*sincronizado com sucesso!/i,
    en: (m) => `✅ Project ${m[1]} (${m[2]}) synchronized successfully!`,
    es: (m) => `✅ ¡Proyecto ${m[1]} (${m[2]}) sincronizado con éxito!`,
  },
  {
    regex: /✅\s*Projeto\s+(.*?)\s*sincronizado com sucesso!/i,
    en: (m) => `✅ Project ${m[1]} synchronized successfully!`,
    es: (m) => `✅ ¡Proyecto ${m[1]} sincronizado con éxito!`,
  },
  {
    regex: /⚠️\s*Projeto\s+(.*?)\s*\((.*?)\):\s*diverg[êe]ncias detectadas\s*—\s*draft criado para revis[ãa]o manual\./i,
    en: (m) => `⚠️ Project ${m[1]} (${m[2]}): divergences detected — draft created for manual review.`,
    es: (m) => `⚠️ Proyecto ${m[1]} (${m[2]}): divergencias detectadas — borrador creado para revisión manual.`,
  },
  {
    regex: /⚠️\s*Projeto\s+(.*?):\s*diverg[êe]ncias detectadas\s*—\s*draft criado para revis[ãa]o manual\./i,
    en: (m) => `⚠️ Project ${m[1]}: divergences detected — draft created for manual review.`,
    es: (m) => `⚠️ Proyecto ${m[1]}: divergencias detectadas — borrador creado para revisión manual.`,
  },
  {
    regex: /Processo de Sincroniza[çc][ãa]o finalizado\./i,
    en: 'Synchronization process finished.',
    es: 'Proceso de sincronización finalizado.',
  },
  {
    regex: /Sincroniza[çc][ãa]o finalizada com sucesso/i,
    en: 'Synchronization finished successfully',
    es: 'Sincronización finalizada con éxito',
  },
  {
    regex: /\[FALHA\]\s*(.*)/i,
    en: (m) => `[FAILURE] ${m[1]}`,
    es: (m) => `[FALLO] ${m[1]}`,
  },
  {
    regex: /\[ERRO INTERNO\]\s*(.*)/i,
    en: (m) => `[INTERNAL ERROR] ${m[1]}`,
    es: (m) => `[ERROR INTERNO] ${m[1]}`,
  }
]

export function translateTunnelLog(log: string, lang: SupportedLang = 'pt'): string {
  if (lang === 'pt' || !log) return log

  let text = log
  for (const pattern of patterns) {
    const match = text.match(pattern.regex)
    if (match) {
      const translation = lang === 'en' ? pattern.en : pattern.es
      text = typeof translation === 'function' ? translation(match) : translation
      break
    }
  }

  // Substituições pontuais internas que possam vir dentro de queries/erros
  if (lang === 'en') {
    text = text.replace(/Senha incorreta/gi, 'Incorrect password')
    text = text.replace(/Usuário não encontrado/gi, 'User not found')
    text = text.replace(/\[ ERRO \]/g, '[ ERROR ]')
    text = text.replace(/\[ AVISO \]/g, '[ WARNING ]')
  } else if (lang === 'es') {
    text = text.replace(/Senha incorreta/gi, 'Contraseña incorrecta')
    text = text.replace(/Usuário não encontrado/gi, 'Usuario no encontrado')
    text = text.replace(/\[ ERRO \]/g, '[ ERROR ]')
    text = text.replace(/\[ AVISO \]/g, '[ AVISO ]')
  }

  return text
}
