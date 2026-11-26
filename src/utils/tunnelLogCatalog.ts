/**
 * Catálogo de linhas do log do túnel nos três idiomas, para traduzir NA HORA DE EXIBIR.
 *
 * Cada entrada é um modelo por idioma com parâmetros nomeados ({n}, {table}...). A linha é comparada com os modelos dos TRÊS idiomas
 * (ela pode ter sido gravada pelo CLI em outro idioma que o da tela) e escrita no idioma pedido. Assim, trocar o idioma da tela
 * retraduz também o histórico, e o que o CLI já gravou traduzido (inglês/espanhol) volta para o português.
 *
 * Os modelos casam com o TEXTO da linha, sem a etiqueta de nível (`[ EXEC ]`, `[ OK ]`...): a janela do log a separa antes.
 * Linhas fora do catálogo ficam como estão (SQL e dados nunca são traduzidos).
 */

export type LogLang = 'pt' | 'en' | 'es'

interface LogTemplate {
  pt: string
  en: string
  es: string
  /** parâmetros que são, eles mesmos, um texto do catálogo "actions" (ex.: o que o comando recebido faz) */
  sub?: string[]
  /** parâmetros com palavras de estado (ativo, recusado...) traduzidas pela tabela VALUE_WORDS */
  words?: string[]
}

interface Compiled { entry: LogTemplate; lang: LogLang; re: RegExp; names: string[] }

/** Símbolos que abrem várias linhas (✓ ✅ ⚠️ ❌ ⏰ 🎧 🔌 🚀 📄...): ficam como estão e não atrapalham o casamento. */
const SYMBOL_PREFIX = '((?:[\\u2190-\\u2BFF\\u{1F300}-\\u{1FAFF}\\uFE0F]+\\s*)?)'

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function compile(entry: LogTemplate, lang: LogLang): Compiled {
  const names: string[] = []
  const parts = entry[lang].split(/\{(\w+)\}/)
  let src = ''
  parts.forEach((part, i) => {
    if (i % 2 === 0) { src += escapeRe(part); return }
    names.push(part)
    // o último parâmetro leva o resto da linha
    src += i === parts.length - 2 && parts[parts.length - 1] === '' ? '([\\s\\S]*)' : '([\\s\\S]+?)'
  })
  return { entry, lang, re: new RegExp(`^${SYMBOL_PREFIX}${src}\\s*$`, 'u'), names }
}

const compileAll = (list: LogTemplate[]): Compiled[] => list.flatMap((e) => (['pt', 'en', 'es'] as LogLang[]).map((l) => compile(e, l)))

/** Palavras de estado que aparecem como valor em algumas linhas (ex.: segurança do túnel). */
const VALUE_WORDS: Array<{ pt: string; en: string; es: string }> = [
  { pt: 'obrigatórios', en: 'required', es: 'obligatorios' },
  { pt: 'opcionais', en: 'optional', es: 'opcionales' },
  { pt: 'RECUSADO', en: 'REFUSED', es: 'RECHAZADO' },
  { pt: 'ACEITO', en: 'ACCEPTED', es: 'ACEPTADO' },
  { pt: 'ativas', en: 'active', es: 'activas' },
  { pt: 'ativos', en: 'active', es: 'activos' },
  { pt: 'ativo', en: 'active', es: 'activo' },
  { pt: 'desativadas', en: 'disabled', es: 'desactivadas' },
  { pt: 'desativados', en: 'disabled', es: 'desactivados' },
  { pt: 'desativado', en: 'disabled', es: 'desactivado' },
]
const valueWord = (value: string, lang: LogLang): string => {
  const hit = VALUE_WORDS.find((w) => w.pt === value || w.en === value || w.es === value)
  return hit ? hit[lang] : value
}

// ── o que um comando recebido faz (texto depois de "Comando Recebido no schema 'x': ") ──────────────────────────────
const ACTIONS: LogTemplate[] = [
  { pt: "{verb} na tabela '{table}'", en: "{verb} on table '{table}'", es: "{verb} en la tabla '{table}'" },
  { pt: 'Validar Login', en: 'Validate Login', es: 'Validar Inicio de Sesión' },
  { pt: 'Sincronizar BPM', en: 'Sync BPM', es: 'Sincronizar BPM' },
  { pt: 'Ler Logs', en: 'Read Logs', es: 'Leer Registros' },
  { pt: 'Buscar Estatísticas de Logs', en: 'Fetch Log Statistics', es: 'Obtener Estadísticas de Registros' },
  { pt: 'Limpar Logs', en: 'Clear Logs', es: 'Limpiar Registros' },
  { pt: 'Sincronizar Configuração de Logs', en: 'Sync Log Settings', es: 'Sincronizar Configuración de Registros' },
  { pt: 'Comando SQL Nativo (RAW)', en: 'Native SQL Command (RAW)', es: 'Comando SQL Nativo (RAW)' },
  { pt: 'Executar {action}', en: 'Run {action}', es: 'Ejecutar {action}' },
]

// ── linhas do log ───────────────────────────────────────────────────────────────────────────────────────────────────
const LINES: LogTemplate[] = [
  // comandos e SQL
  { pt: "Comando Recebido no schema '{schema}': {detail}", en: "Command Received on schema '{schema}': {detail}", es: "Comando Recibido en schema '{schema}': {detail}", sub: ['detail'] },
  { pt: 'Executando COUNT: {sql}', en: 'Executing COUNT: {sql}', es: 'Ejecutando COUNT: {sql}' },
  { pt: 'Executando Custom Action: {sql}', en: 'Executing Custom Action: {sql}', es: 'Ejecutando Acción Personalizada: {sql}' },
  { pt: 'Executando RAW SQL: {sql}', en: 'Executing RAW SQL: {sql}', es: 'Ejecutando RAW SQL: {sql}' },
  { pt: 'Executando: {sql}', en: 'Executing: {sql}', es: 'Ejecutando: {sql}' },
  { pt: 'Buscando usuários: {sql}', en: 'Searching users: {sql}', es: 'Buscando usuarios: {sql}' },
  { pt: 'Buscando usuário: {sql}', en: 'Searching user: {sql}', es: 'Buscando usuario: {sql}' },
  // resultados
  { pt: 'SELECT: Retornou {n} linhas (Limit: {limit}, Offset: {offset}).', en: 'SELECT: Returned {n} rows (Limit: {limit}, Offset: {offset}).', es: 'SELECT: Devolvió {n} filas (Limit: {limit}, Offset: {offset}).' },
  { pt: 'COUNT: Retornou total de {n} linhas.', en: 'COUNT: Returned a total of {n} rows.', es: 'COUNT: Devolvió un total de {n} filas.' },
  { pt: 'INSERT: 1 linha criada.', en: 'INSERT: 1 row created.', es: 'INSERT: 1 fila creada.' },
  { pt: 'UPDATE: 1 linha atualizada.', en: 'UPDATE: 1 row updated.', es: 'UPDATE: 1 fila actualizada.' },
  { pt: 'DELETE: 1 linha removida.', en: 'DELETE: 1 row removed.', es: 'DELETE: 1 fila eliminada.' },
  { pt: 'GET_USERS: Retornou {n} usuários.', en: 'GET_USERS: Returned {n} users.', es: 'GET_USERS: Devolvió {n} usuarios.' },
  { pt: 'RAW SQL executado com sucesso.', en: 'RAW SQL executed successfully.', es: 'RAW SQL ejecutado con éxito.' },
  { pt: 'RAW SQL: Sucesso.', en: 'RAW SQL: Success.', es: 'RAW SQL: Éxito.' },
  { pt: 'CUSTOM ACTION executada.', en: 'CUSTOM ACTION executed.', es: 'ACCIÓN PERSONALIZADA ejecutada.' },
  { pt: 'BPM TRIGGER ACTION executada para fluxos customizados.', en: 'BPM TRIGGER ACTION executed for custom flows.', es: 'BPM TRIGGER ACTION ejecutada para flujos personalizados.' },
  { pt: 'BPM SYNC ACTION processada para evento {event} em {table}.', en: 'BPM SYNC ACTION processed for event {event} on {table}.', es: 'BPM SYNC ACTION procesada para evento {event} en {table}.' },
  { pt: 'Fluxos BPM sincronizados com sucesso.', en: 'BPM workflows synchronized successfully.', es: 'Flujos BPM sincronizados con éxito.' },
  { pt: 'Configurações de Log sincronizadas dinamicamente.', en: 'Log settings synchronized dynamically.', es: 'Configuraciones de registro sincronizadas dinámicamente.' },
  { pt: 'Webhook processado para o fluxo {id}.', en: 'Webhook processed for flow {id}.', es: 'Webhook procesado para el flujo {id}.' },
  { pt: 'Webhook Retornou: {status}', en: 'Webhook Returned: {status}', es: 'Webhook Devolvió: {status}' },
  { pt: "LOGIN: Usuário '{user}' autenticado com sucesso.", en: "LOGIN: User '{user}' authenticated successfully.", es: "LOGIN: Usuario '{user}' autenticado con éxito." },
  { pt: 'Falha na query: {error}', en: 'Query failed: {error}', es: 'Fallo en la consulta: {error}' },
  { pt: "Falha ao enviar broadcast '{event}': {error}", en: "Failed to send broadcast '{event}': {error}", es: "Fallo al enviar difusión '{event}': {error}" },
  { pt: 'Coluna "{col}" não existe no Postgres (42703) — removendo e repetindo {op} (tentativa {n})...', en: 'Column "{col}" does not exist in Postgres (42703) — removing and retrying {op} (attempt {n})...', es: 'La columna "{col}" no existe en Postgres (42703) — eliminando y repitiendo {op} (intento {n})...' },
  { pt: 'Coluna "{col}" é GENERATED — removendo e repetindo {op} (tentativa {n})...', en: 'Column "{col}" is GENERATED — removing and retrying {op} (attempt {n})...', es: 'La columna "{col}" es GENERATED — eliminando y repitiendo {op} (intento {n})...' },
  // segurança e respostas do túnel
  { pt: 'Comandos assinados: {signed} | formato antigo (token no comando): {legacy} | respostas em tópico privado: {replies} | comandos em tópico privado: {commands} | acesso por tabela do usuário final: {access}', en: 'Signed commands: {signed} | legacy format (token in the command): {legacy} | private-topic replies: {replies} | private-topic commands: {commands} | end-user table access: {access}', es: 'Comandos firmados: {signed} | formato antiguo (token en el comando): {legacy} | respuestas en tema privado: {replies} | comandos en tema privado: {commands} | acceso por tabla del usuario final: {access}', words: ['signed', 'legacy', 'replies', 'commands', 'access'] },
  { pt: "Comando sem tópico de resposta válido: a resposta '{event}' não foi enviada.", en: "Command without a valid reply topic: the reply '{event}' was not sent.", es: "Comando sin tema de respuesta válido: la respuesta '{event}' no fue enviada." },
  // partida do túnel e do motor
  { pt: 'Iniciando Túnel para {n} projeto(s) simultaneamente...', en: 'Starting Tunnel for {n} project(s) simultaneously...', es: 'Iniciando Túnel para {n} proyecto(s) simultáneamente...' },
  { pt: 'Conectando ao banco de dados local para o túnel ({db})...', en: 'Connecting to local database for tunnel ({db})...', es: 'Conectando a la base de datos local para el túnel ({db})...' },
  { pt: 'Conexão contínua estabelecida com sucesso! ({db})', en: 'Continuous connection established successfully! ({db})', es: '¡Conexión continua establecida con éxito! ({db})' },
  { pt: 'Agente MetaBuilderPRO ouvindo ativamente comandos no canal: {channel}', en: 'MetaBuilderPRO Agent actively listening for commands on channel: {channel}', es: 'Agente MetaBuilderPRO escuchando activamente comandos en el canal: {channel}' },
  { pt: '(Pressione Ctrl+C para encerrar o túnel)', en: '(Press Ctrl+C to terminate the tunnel)', es: '(Presione Ctrl+C para finalizar el túnel)' },
  { pt: 'Túnel Seguro estabelecido. Tudo pronto!', en: 'Secure Tunnel established. All ready!', es: '¡Túnel Seguro establecido. Todo listo!' },
  { pt: 'Daemon ativo. Aguardando comandos remotos...', en: 'Daemon active. Waiting for remote commands...', es: 'Daemon activo. Esperando comandos remotos...' },
  { pt: 'Log de banco desativado para este projeto.', en: 'Database log disabled for this project.', es: 'Registro de base de datos deshabilitado para este proyecto.' },
  { pt: 'Log de banco desativado dinamicamente.', en: 'Database log dynamically disabled.', es: 'Registro de base de datos deshabilitado dinámicamente.' },
  { pt: 'Inicializando motor de automações...', en: 'Initializing automation engine...', es: 'Inicializando motor de automatizaciones...' },
  { pt: 'Todos os agendamentos antigos foram limpos.', en: 'All old schedules have been cleared.', es: 'Se han limpiado todas las programaciones anteriores.' },
  { pt: 'syncModels carregou {n} modelos para o projeto {project}', en: 'syncModels loaded {n} models for project {project}', es: 'syncModels cargó {n} modelos para el proyecto {project}' },
  { pt: 'Motor rodando. Escutando {n} fluxos ativos.', en: 'Engine running. Listening to {n} active flows.', es: 'Motor en ejecución. Escuchando {n} flujos activos.' },
  { pt: 'Erro ao buscar os fluxos no servidor: {error}', en: 'Error fetching the flows from the server: {error}', es: 'Error al obtener los flujos del servidor: {error}' },
  { pt: 'Erro ao sincronizar models: {error}', en: 'Error synchronizing models: {error}', es: 'Error al sincronizar models: {error}' },
  { pt: 'Erro ao buscar a configuração de destinatários no servidor: {error}', en: 'Error fetching the recipients configuration from the server: {error}', es: 'Error al obtener la configuración de destinatarios del servidor: {error}' },
  { pt: 'Sincronização forçada dos fluxos recebida.', en: 'Forced synchronization of the flows received.', es: 'Sincronización forzada de los flujos recibida.' },
  // BPM
  { pt: 'Disparando fluxo SÍNCRONO "{flow}" para a tabela {table}...', en: 'Triggering SYNCHRONOUS flow "{flow}" for table {table}...', es: 'Disparando flujo SÍNCRONO "{flow}" para la tabla {table}...' },
  { pt: 'Disparando fluxo customizado "{flow}" via Ação de Interface...', en: 'Triggering custom flow "{flow}" via Interface Action...', es: 'Disparando flujo personalizado "{flow}" mediante Acción de Interfaz...' },
  { pt: 'Disparando fluxo "{flow}" para a tabela {table}...', en: 'Triggering flow "{flow}" for table {table}...', es: 'Disparando flujo "{flow}" para la tabla {table}...' },
  { pt: 'Webhook recebido: disparando fluxo "{flow}"...', en: 'Webhook received: triggering flow "{flow}"...', es: 'Webhook recibido: disparando flujo "{flow}"...' },
  { pt: 'Disparando Webhook [{method}] para: {url}', en: 'Triggering Webhook [{method}] to: {url}', es: 'Disparando Webhook [{method}] a: {url}' },
  { pt: 'Disparando e-mail para: {to} (Template: {template})', en: 'Sending email to: {to} (Template: {template})', es: 'Enviando correo a: {to} (Plantilla: {template})' },
  { pt: 'E-mail disparado com sucesso!', en: 'Email sent successfully!', es: '¡Correo enviado con éxito!' },
  { pt: 'E-mail não enviado: Destinatário não encontrado.', en: 'Email not sent: Recipient not found.', es: 'Correo no enviado: Destinatario no encontrado.' },
  { pt: 'Erro ao enviar e-mail: {error}', en: 'Error sending email: {error}', es: 'Error al enviar el correo: {error}' },
  { pt: 'Buscando alvos para e-mail: {sql}', en: 'Looking up email targets: {sql}', es: 'Buscando destinatarios del correo: {sql}' },
  { pt: '⏰ Agendamento disparado para o fluxo "{flow}"!', en: '⏰ Schedule triggered for flow "{flow}"!', es: '⏰ Programación disparada para el flujo "{flow}"!' },
  { pt: '{n} gatilho(s) agendado(s) configurado(s) com sucesso.', en: '{n} scheduled trigger(s) configured successfully.', es: '{n} disparador(es) programado(s) configurado(s) con éxito.' },
  { pt: 'Fluxo SÍNCRONO bloqueou a ação!', en: 'SYNCHRONOUS flow blocked the action!', es: '¡El flujo SÍNCRONO bloqueó la acción!' },
  { pt: 'Falha na execução do fluxo SÍNCRONO {flow}: {error}', en: 'Failure running SYNCHRONOUS flow {flow}: {error}', es: 'Fallo al ejecutar el flujo SÍNCRONO {flow}: {error}' },
  { pt: 'Falha na execução do fluxo {flow}: {error}', en: 'Failure running flow {flow}: {error}', es: 'Fallo al ejecutar el flujo {flow}: {error}' },
  { pt: 'Fluxo "{flow}" interrompido: {error}', en: 'Flow "{flow}" interrupted: {error}', es: 'Flujo "{flow}" interrumpido: {error}' },
  { pt: 'Consultando dados: {sql}', en: 'Querying data: {sql}', es: 'Consultando datos: {sql}' },
  { pt: 'Consulta "{name}" sem resultado: o fluxo não continua.', en: 'Query "{name}" returned nothing: the flow does not continue.', es: 'La consulta "{name}" no devolvió nada: el flujo no continúa.' },
  { pt: 'Consulta "{name}": {n} linha(s).', en: 'Query "{name}": {n} row(s).', es: 'Consulta "{name}": {n} fila(s).' },
  { pt: 'Executando Insert: {sql}', en: 'Running Insert: {sql}', es: 'Ejecutando Insert: {sql}' },
  { pt: 'Executando Update: {sql}', en: 'Running Update: {sql}', es: 'Ejecutando Update: {sql}' },
  { pt: 'Executando Delete: {sql}', en: 'Running Delete: {sql}', es: 'Ejecutando Delete: {sql}' },
  { pt: "Regra: Campo '{field}' ({actual}) {op} Valor Esperado ({expected}) => Resultado: {result}", en: "Rule: Field '{field}' ({actual}) {op} Expected Value ({expected}) => Result: {result}", es: "Regla: Campo '{field}' ({actual}) {op} Valor Esperado ({expected}) => Resultado: {result}" },
  { pt: 'Grupo resultou em: {result}', en: 'Group resulted in: {result}', es: 'El grupo resultó en: {result}' },
  { pt: 'Condição final resultou em: {result}', en: 'Final condition resulted in: {result}', es: 'La condición final resultó en: {result}' },
  { pt: 'Fluxo "{flow}": o agendamento "Apenas uma vez" está sem data e hora específicas: ignorado. Informe a data e a hora.', en: 'Flow "{flow}": the "Run once" schedule has no specific date and time: ignored. Provide the date and time.', es: 'Flujo "{flow}": la programación "Solo una vez" no tiene fecha y hora específicas: ignorada. Indique la fecha y la hora.' },
  { pt: 'Fluxo "{flow}": o agendamento "Apenas uma vez" ({date}) já passou: ignorado.', en: 'Flow "{flow}": the "Run once" schedule ({date}) has already passed: ignored.', es: 'Flujo "{flow}": la programación "Solo una vez" ({date}) ya pasó: ignorada.' },
]

const LINE_INDEX = compileAll(LINES)
const ACTION_INDEX = compileAll(ACTIONS)

function match(text: string, index: Compiled[], target: LogLang, subIndex?: Compiled[]): string | null {
  for (const c of index) {
    const m = c.re.exec(text)
    if (!m) continue
    const prefix = m[1] || ''
    const values: Record<string, string> = {}
    c.names.forEach((name, i) => {
      let v = m[i + 2] ?? ''
      if (c.entry.sub?.includes(name) && subIndex) v = match(v, subIndex, target) ?? v
      if (c.entry.words?.includes(name)) v = valueWord(v, target)
      values[name] = v
    })
    return prefix + c.entry[target].replace(/\{(\w+)\}/g, (_, n: string) => values[n] ?? '')
  }
  return null
}

/** Texto (sem a etiqueta de nível) no idioma pedido; null se a linha não está no catálogo. */
export function translateWithCatalog(text: string, target: LogLang): string | null {
  return match(text, LINE_INDEX, target, ACTION_INDEX)
}

// ── etiquetas de nível ([ ERRO ] → [ ERROR ]) ─────────────────────────────────────────────────────────────────────
const LEVELS: Array<{ pt: string; en: string; es: string }> = [
  { pt: 'ERRO', en: 'ERROR', es: 'ERROR' },
  { pt: 'ERRO INTERNO', en: 'INTERNAL ERROR', es: 'ERROR INTERNO' },
  { pt: 'AVISO', en: 'WARNING', es: 'AVISO' },
  { pt: 'FALHA', en: 'FAILURE', es: 'FALLO' },
  { pt: 'SEGURANÇA', en: 'SECURITY', es: 'SEGURIDAD' },
  { pt: 'RESPOSTA', en: 'RESPONSE', es: 'RESPUESTA' },
  { pt: 'BLOQUEADO', en: 'BLOCKED', es: 'BLOQUEADO' },
  { pt: 'IGNORADO', en: 'IGNORED', es: 'IGNORADO' },
  { pt: 'TÚNEL', en: 'TUNNEL', es: 'TÚNEL' },
  { pt: 'TÚNEL ATIVO', en: 'ACTIVE TUNNEL', es: 'TÚNEL ACTIVO' },
  { pt: 'TÚNEL HEADLESS', en: 'HEADLESS TUNNEL', es: 'TÚNEL HEADLESS' },
]

/** Etiqueta de nível no idioma pedido (a mesma, se não for uma das conhecidas). */
export function translateLogLevel(level: string, target: LogLang): string {
  const key = level.trim().toUpperCase()
  const hit = LEVELS.find((l) => l.pt === key || l.en === key || l.es === key)
  return hit ? hit[target] : level
}
