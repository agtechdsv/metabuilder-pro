/**
 * Tours da tela "Logs do Sistema" (Studio > logs): configurar o registro, filtrar e atualizar, e ler um registro para investigar um erro.
 * Cada alvo é um `data-help-id` de ProjectLogsTab.
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour } from './types'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const LOGS = '/admin/:workspace/:project/studio/logs'

export const LOGS_TOURS: readonly PlatformTour[] = [
  // ───────────────────────── configurar ─────────────────────────
  {
    id: 'logs-configurar',
    route: LOGS,
    title: h(['Configurar o registro de logs', 'Set up log recording', 'Configurar el registro de logs']),
    summary: h(['Ligar os logs, escolher onde gravar, o que registrar e por quanto tempo guardar.', 'Turn logs on, choose where to write, what to record and how long to keep it.', 'Activar los logs, elegir dónde grabar, qué registrar y por cuánto tiempo guardar.']),
    steps: [
      st('enable', 'logs.enable', ['Ligue os logs', 'Turn logs on', 'Active los logs'], [
        'Por padrão ficam desligados. Ligado, o Agente CLI registra o que acontece no projeto. Ao ligar, aparecem dois destinos: gravar no banco (para ver aqui no painel) e gravar em arquivo (logs/tunnel-...), na máquina do Agente. Dá para usar os dois.',
        'Off by default. When on, the CLI Agent records what happens in the project. Turning it on shows two destinations: write to the database (to see here in the panel) and write to a file (logs/tunnel-...), on the Agent machine. You can use both.',
        'Desactivados por defecto. Activos, el Agente CLI registra lo que ocurre en el proyecto. Al activar aparecen dos destinos: grabar en la base (para ver aquí en el panel) y grabar en archivo (logs/tunnel-...), en la máquina del Agente. Puede usar los dos.',
      ], { interactive: true }),
      st('types', 'logs.types', ['O que registrar', 'What to record', 'Qué registrar'], [
        'Leitura (consultas SELECT), Escrita (inserções, alterações e exclusões), Erro SQL, BPM (execuções de processos), Sync (sincronizações de tabelas) e Túnel (a comunicação com o Agente). Clique para marcar ou desmarcar cada tipo. Registrar tudo gera muito volume: comece por Erro SQL e acrescente o que precisar investigar.',
        'Read (SELECT queries), Write (inserts, updates and deletes), SQL Error, BPM (process runs), Sync (table syncs) and Tunnel (the communication with the Agent). Click to check or uncheck each type. Recording everything makes a lot of volume: start with SQL Error and add what you need to investigate.',
        'Lectura (consultas SELECT), Escritura (inserciones, cambios y eliminaciones), Error SQL, BPM (ejecuciones de procesos), Sync (sincronizaciones de tablas) y Túnel (la comunicación con el Agente). Haga clic para marcar o desmarcar cada tipo. Registrar todo genera mucho volumen: empiece por Error SQL y agregue lo que necesite investigar.',
      ], { interactive: true }),
      st('retention', 'logs.retention', ['Retenção', 'Retention', 'Retención'], [
        'Por quantos dias guardar: 1, 7, 15, 30, 60 ou 90. Registros mais antigos são apagados sozinhos. Prazos longos com muitos tipos ocupam mais espaço no banco.',
        'How many days to keep: 1, 7, 15, 30, 60 or 90. Older records are deleted automatically. Long periods with many types take more space in the database.',
        'Por cuántos días guardar: 1, 7, 15, 30, 60 o 90. Los registros más antiguos se eliminan solos. Plazos largos con muchos tipos ocupan más espacio en la base.',
      ], { interactive: true }),
      st('save', 'logs.save', ['Salvar', 'Save', 'Guardar'], [
        'Nada vale até salvar. Com o Agente online, a configuração é aplicada em tempo real; com o Agente offline ela é salva e vale quando você reiniciá-lo.',
        'Nothing applies until you save. With the Agent online, the setup is applied in real time; with the Agent offline it is saved and applies when you restart it.',
        'Nada vale hasta guardar. Con el Agente en línea, la configuración se aplica en tiempo real; con el Agente fuera de línea se guarda y vale cuando lo reinicie.',
      ]),
    ],
  },

  // ───────────────────────── filtrar e atualizar ─────────────────────────
  {
    id: 'logs-filtrar',
    route: LOGS,
    title: h(['Filtrar, buscar e atualizar', 'Filter, search and refresh', 'Filtrar, buscar y actualizar']),
    summary: h(['Achar o registro certo: busca, tipo, tabela, período, origem e atualização automática.', 'Find the right record: search, type, table, period, source and auto refresh.', 'Encontrar el registro correcto: búsqueda, tipo, tabla, período, origen y actualización automática.']),
    steps: [
      st('search', 'logs.search', ['Buscar por texto', 'Search by text', 'Buscar por texto'], [
        'Procura na mensagem e no SQL dos registros. Os registros vêm do Agente CLI pelo túnel: se aparecer "CLI offline", ligue o Agente para ver os logs.',
        'Searches the message and the SQL of the records. Records come from the CLI Agent through the tunnel: if "CLI offline" shows up, start the Agent to see the logs.',
        'Busca en el mensaje y en el SQL de los registros. Los registros vienen del Agente CLI por el túnel: si aparece "CLI offline", encienda el Agente para ver los logs.',
      ], { interactive: true }),
      st('type', 'logs.filter_type', ['Filtrar por tipo', 'Filter by type', 'Filtrar por tipo'], [
        'Mostra só um tipo: Leitura, Escrita, Erro SQL, BPM, Sync ou Túnel. Para investigar um problema, comece por Erro SQL.',
        'Shows only one type: Read, Write, SQL Error, BPM, Sync or Tunnel. To investigate a problem, start with SQL Error.',
        'Muestra solo un tipo: Lectura, Escritura, Error SQL, BPM, Sync o Túnel. Para investigar un problema, empiece por Error SQL.',
      ], { interactive: true }),
      st('table', 'logs.filter_table', ['Filtrar por tabela', 'Filter by table', 'Filtrar por tabla'], [
        'Digite o nome de uma tabela para ver só o que passou por ela.',
        'Type a table name to see only what went through it.',
        'Escriba el nombre de una tabla para ver solo lo que pasó por ella.',
      ], { interactive: true }),
      st('source', 'logs.source', ['Banco ou arquivo', 'Database or file', 'Base o archivo'], [
        'Banco: os registros gravados no banco, com período por data e hora. Arquivo: o arquivo de log do dia, na máquina do Agente, escolhido por data. Cada origem só tem o que foi gravado naquele destino, na configuração de logs.',
        'Database: the records written to the database, with a date and time period. File: the log file of the day, on the Agent machine, chosen by date. Each source only has what was written to that destination, in the log setup.',
        'Base: los registros grabados en la base, con período por fecha y hora. Archivo: el archivo de log del día, en la máquina del Agente, elegido por fecha. Cada origen solo tiene lo que se grabó en ese destino, en la configuración de logs.',
      ], { interactive: true }),
      st('dates', 'logs.dates', ['Período', 'Period', 'Período'], [
        'No Banco você informa de quando até quando. No Arquivo, escolhe um dia. Estreitar o período deixa a busca mais rápida.',
        'On Database you set from when to when. On File, you pick a day. Narrowing the period makes the search faster.',
        'En Base indica desde cuándo hasta cuándo. En Archivo, elige un día. Acotar el período hace la búsqueda más rápida.',
      ], { interactive: true }),
      st('refresh', 'logs.refresh', ['Atualizar', 'Refresh', 'Actualizar'], [
        'Recarrega a lista e o resumo agora. A lista também recarrega sozinha quando você muda um filtro.',
        'Reloads the list and the summary now. The list also reloads by itself when you change a filter.',
        'Recarga la lista y el resumen ahora. La lista también se recarga sola cuando cambia un filtro.',
      ], { interactive: true }),
      st('auto', 'logs.autorefresh', ['Atualização automática', 'Auto refresh', 'Actualización automática'], [
        'Liga a atualização a cada 5 segundos, ótima para acompanhar um problema enquanto você reproduz a ação no app. Desligue quando terminar, para não sobrecarregar.',
        'Turns on a refresh every 5 seconds, great to follow a problem while you reproduce the action in the app. Turn it off when done, so you do not overload.',
        'Activa la actualización cada 5 segundos, ideal para seguir un problema mientras reproduce la acción en la app. Apáguela al terminar, para no sobrecargar.',
      ], { interactive: true }),
      st('pagesize', 'logs.pagesize', ['Linhas por página', 'Rows per page', 'Filas por página'], [
        'De 50 a 1000 linhas por página. Valores altos mostram mais de uma vez, mas carregam mais devagar.',
        'From 50 to 1000 rows per page. High values show more at once, but load slower.',
        'De 50 a 1000 filas por página. Valores altos muestran más de una vez, pero cargan más lento.',
      ], { interactive: true }),
      st('count', 'logs.count', ['Quantos registros', 'How many records', 'Cuántos registros'], [
        'Quantas entradas existem com os filtros atuais. Se a lista tiver mais de uma página, aparece a paginação abaixo da tabela.',
        'How many entries exist with the current filters. If the list has more than one page, pagination shows below the table.',
        'Cuántas entradas existen con los filtros actuales. Si la lista tiene más de una página, la paginación aparece debajo de la tabla.',
      ]),
      st('stats', 'logs.stats', ['Resumo da sessão', 'Session summary', 'Resumen de la sesión'], [
        'A contagem de registros por tipo. Um número alto de Erro SQL é o primeiro sinal de que algo está errado.',
        'The count of records per type. A high SQL Error number is the first sign that something is wrong.',
        'El conteo de registros por tipo. Un número alto de Error SQL es la primera señal de que algo anda mal.',
      ], { skipIfMissing: true }),
      st('pagination', 'logs.pagination', ['Paginação', 'Pagination', 'Paginación'], [
        'Navegue entre as páginas com Anterior e Próxima.',
        'Move between pages with Previous and Next.',
        'Navegue entre las páginas con Anterior y Siguiente.',
      ], { skipIfMissing: true }),
      st('clear', 'logs.clear', ['Limpar tudo', 'Clear everything', 'Limpiar todo'], [
        'Apaga TODOS os registros do projeto, depois de uma confirmação (Sim ou Não). Não dá para desfazer. Prefira ajustar a retenção, que apaga só os mais antigos.',
        'Deletes ALL the records of the project, after a confirmation (Yes or No). It cannot be undone. Prefer adjusting retention, which deletes only the oldest.',
        'Elimina TODOS los registros del proyecto, tras una confirmación (Sí o No). No se puede deshacer. Prefiera ajustar la retención, que borra solo los más antiguos.',
      ]),
    ],
  },

  // ───────────────────────── ler um registro ─────────────────────────
  {
    id: 'logs-ler-registro',
    route: LOGS,
    title: h(['Ler um registro e investigar um erro', 'Read a record and investigate an error', 'Leer un registro e investigar un error']),
    summary: h(['O que cada coluna mostra e como abrir um registro para ver o SQL e o erro completos.', 'What each column shows and how to open a record to see the full SQL and error.', 'Qué muestra cada columna y cómo abrir un registro para ver el SQL y el error completos.']),
    steps: [
      st('intro', undefined, ['Antes de começar', 'Before you start', 'Antes de empezar'], [
        'Este tour usa os registros que já existem. Se a tabela estiver vazia, confira três coisas: o Agente CLI está online, os logs estão ligados e os tipos certos estão marcados. Faça alguma ação no app e clique em Atualizar. Os passos que dependem de registros são pulados se não houver nenhum.',
        'This tour uses the records that already exist. If the table is empty, check three things: the CLI Agent is online, logs are on and the right types are checked. Do something in the app and click Refresh. Steps that depend on records are skipped if there are none.',
        'Este recorrido usa los registros que ya existen. Si la tabla está vacía, compruebe tres cosas: el Agente CLI está en línea, los logs están activados y los tipos correctos están marcados. Haga alguna acción en la app y haga clic en Actualizar. Los pasos que dependen de registros se omiten si no hay ninguno.',
      ]),
      st('table', 'logs.table', ['As colunas', 'The columns', 'Las columnas'], [
        'Data e hora, Tipo, Ação, Tabela, Mensagem, tempo em milissegundos e linhas afetadas. O tempo vem colorido: verde até 300 ms, laranja de 300 a 1000 ms e vermelho acima de 1000 ms, que merece atenção.',
        'Date and time, Type, Action, Table, Message, time in milliseconds and rows affected. The time is colored: green up to 300 ms, orange from 300 to 1000 ms and red above 1000 ms, which deserves attention.',
        'Fecha y hora, Tipo, Acción, Tabla, Mensaje, tiempo en milisegundos y filas afectadas. El tiempo viene coloreado: verde hasta 300 ms, naranja de 300 a 1000 ms y rojo por encima de 1000 ms, que merece atención.',
      ], { skipIfMissing: true }),
      st('row', 'logs.row', ['Abra um registro', 'Open a record', 'Abra un registro'], [
        'Clique na linha destacada para expandi-la. Clicar de novo recolhe.',
        'Click the highlighted row to expand it. Clicking again collapses it.',
        'Haga clic en la fila destacada para expandirla. Hacer clic de nuevo la contrae.',
      ], {
        skipIfMissing: true,
        interactive: true,
        completeWhen: { id: 'logs.row', check: 'attr', attr: 'data-help-state', equals: 'open' },
        waitingHint: h(['Clique na linha para expandir e continuar.', 'Click the row to expand and continue.', 'Haga clic en la fila para expandir y continuar.']),
      }),
      st('detail', 'logs.detail', ['O detalhe completo', 'The full detail', 'El detalle completo'], [
        'Aqui está o SQL completo (copie para testar no seu banco), os metadados do registro e, no rodapé, o ID da sessão, o schema e a data completa. Em um Erro SQL, o texto do erro está na mensagem e nos metadados.',
        'Here is the full SQL (copy it to test in your database), the record metadata and, at the bottom, the session ID, the schema and the full date. In an SQL Error, the error text is in the message and in the metadata.',
        'Aquí está el SQL completo (cópielo para probarlo en su base), los metadatos del registro y, al pie, el ID de la sesión, el schema y la fecha completa. En un Error SQL, el texto del error está en el mensaje y en los metadatos.',
      ], { skipIfMissing: true }),
      st('recipe', undefined, ['Receita para investigar', 'Recipe to investigate', 'Receta para investigar'], [
        '1) Ligue os logs de Erro SQL. 2) Reproduza o problema no app. 3) Filtre por tipo Erro SQL e, se quiser, pela tabela. 4) Abra o registro mais recente e leia o SQL e o erro. 5) Desligue a atualização automática e, se não precisar mais, reduza a retenção.',
        '1) Turn on SQL Error logs. 2) Reproduce the problem in the app. 3) Filter by SQL Error type and, if you want, by table. 4) Open the most recent record and read the SQL and the error. 5) Turn off auto refresh and, if you no longer need it, reduce the retention.',
        '1) Active los logs de Error SQL. 2) Reproduzca el problema en la app. 3) Filtre por tipo Error SQL y, si quiere, por tabla. 4) Abra el registro más reciente y lea el SQL y el error. 5) Apague la actualización automática y, si ya no la necesita, reduzca la retención.',
      ]),
    ],
  },
]
