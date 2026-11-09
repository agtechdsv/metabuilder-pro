/**
 * Tours da tela "Configurar Login & Segurança" (Studio > auth): uma visão geral e um tour por aba / estratégia.
 * Textos em pt, en e es; cada alvo é um `data-help-id` que existe em auth/page.tsx, ProjectSecuritySettings e TableAccessMode.
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour } from './types'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const AUTH = '/admin/:workspace/:project/studio/auth'

/** a pessoa escolheu a estratégia `kind` (o grupo de cartões informa a escolhida em data-help-state) */
const picked = (kind: string) => ({ id: 'auth.strategies', check: 'attr' as const, attr: 'data-help-state', equals: kind })
const pickHint = (name: T3): HelpText => h([`Clique no cartão "${name[0]}" para continuar. Nada é gravado até você salvar.`, `Click the "${name[1]}" card to continue. Nothing is saved until you save.`, `Haga clic en la tarjeta "${name[2]}" para continuar. No se guarda nada hasta que guarde.`])

export const AUTH_TOURS: readonly PlatformTour[] = [
  // ───────────────────────── visão geral ─────────────────────────
  {
    id: 'auth-visao-geral',
    route: AUTH,
    freeClicks: true,
    title: h(['Login & Segurança: visão geral', 'Login & Security: overview', 'Acceso y Seguridad: visión general']),
    summary: h(['As quatro abas da tela e onde fica cada coisa. Cada aba tem um tour próprio neste menu.', 'The four tabs of the screen and where each thing is. Each tab has its own tour in this menu.', 'Las cuatro pestañas de la pantalla y dónde está cada cosa. Cada pestaña tiene su propio recorrido en este menú.']),
    steps: [
      st('tabs', 'auth.tabs', ['Quatro abas', 'Four tabs', 'Cuatro pestañas'], [
        'Esta tela define como os usuários FINAIS do seu app entram e o que podem acessar. São quatro abas: Controle de Acesso, Estratégia de Autenticação, Personalização Visual e Gestão de Usuários.',
        'This screen defines how the END users of your app sign in and what they can access. There are four tabs: Access Control, Authentication Strategy, Visual Customization and User Management.',
        'Esta pantalla define cómo entran los usuarios FINALES de su app y a qué pueden acceder. Son cuatro pestañas: Control de Acceso, Estrategia de Autenticación, Personalización Visual y Gestión de Usuarios.',
      ]),
      st('access', 'auth.tab_permissions', ['Controle de Acesso', 'Access Control', 'Control de Acceso'], [
        'Segurança do app (login por biometria e verificação em duas etapas) e o bloqueio das tabelas por padrão: o que o usuário final enxerga das suas tabelas.',
        'App security (biometric sign-in and two-step verification) and the default table lock: what the end user sees of your tables.',
        'Seguridad de la app (acceso biométrico y verificación en dos pasos) y el bloqueo de tablas por defecto: lo que el usuario final ve de sus tablas.',
      ]),
      st('strategy', 'auth.tab_strategy', ['Estratégia de Autenticação', 'Authentication Strategy', 'Estrategia de Autenticación'], [
        'COMO o login funciona: Managed Auth, o seu banco legado, LDAP/Active Directory ou sem autenticação. É a decisão mais importante da tela.',
        'HOW sign-in works: Managed Auth, your legacy database, LDAP/Active Directory or no authentication. It is the most important decision on this screen.',
        'CÓMO funciona el acceso: Managed Auth, su base heredada, LDAP/Active Directory o sin autenticación. Es la decisión más importante de la pantalla.',
      ]),
      st('visual', 'auth.tab_visual', ['Personalização Visual', 'Visual Customization', 'Personalización Visual'], [
        'A aparência da tela de login do seu app: logotipo, cores, tema, textos, rótulos dos campos e o botão, com uma prévia ao vivo.',
        'The look of your app sign-in screen: logo, colors, theme, texts, field labels and the button, with a live preview.',
        'La apariencia de la pantalla de acceso de su app: logotipo, colores, tema, textos, etiquetas de los campos y el botón, con una vista previa en vivo.',
      ]),
      st('users', 'auth.tab_users', ['Gestão de Usuários', 'User Management', 'Gestión de Usuarios'], [
        'Lista de usuários, grupos de acesso e a matriz de permissões de telas por grupo. Com a estratégia de banco legado, os usuários vêm da SUA tabela, pelo Agente CLI.',
        'User list, access groups and the screen permission matrix per group. With the legacy database strategy, users come from YOUR table, through the CLI Agent.',
        'Lista de usuarios, grupos de acceso y la matriz de permisos de pantallas por grupo. Con la estrategia de base heredada, los usuarios vienen de SU tabla, por el Agente CLI.',
      ]),
      st('save', 'auth.save', ['Salvar', 'Save', 'Guardar'], [
        'O botão Salvar do cabeçalho grava a estratégia, a personalização visual e as opções de acesso às tabelas. Ele some na aba Controle de Acesso, que tem os próprios botões de salvar. Alterações só valem depois de salvar.',
        'The Save button in the header saves the strategy, the visual customization and the table access options. It disappears on the Access Control tab, which has its own save buttons. Changes only apply after saving.',
        'El botón Guardar del encabezado guarda la estrategia, la personalización visual y las opciones de acceso a las tablas. Desaparece en la pestaña Control de Acceso, que tiene sus propios botones de guardar. Los cambios solo valen después de guardar.',
      ], { enterClick: 'auth.tab_strategy' }),
      st('more', 'platform.help_button', ['Para ir além', 'Going further', 'Para ir más allá'], [
        'Neste menu de ajuda há um tour para cada assunto: Controle de Acesso, cada Estratégia (Managed Auth, banco legado, LDAP, sem autenticação), Personalização Visual, Usuários, Grupos e Permissões de Telas.',
        'In this help menu there is one tour for each topic: Access Control, each Strategy (Managed Auth, legacy database, LDAP, no authentication), Visual Customization, Users, Groups and Screen Permissions.',
        'En este menú de ayuda hay un recorrido para cada tema: Control de Acceso, cada Estrategia (Managed Auth, base heredada, LDAP, sin autenticación), Personalización Visual, Usuarios, Grupos y Permisos de Pantallas.',
      ]),
    ],
  },

  // ───────────────────────── controle de acesso ─────────────────────────
  {
    id: 'auth-controle-acesso',
    route: AUTH,
    freeClicks: true,
    title: h(['Controle de Acesso: segurança e tabelas', 'Access Control: security and tables', 'Control de Acceso: seguridad y tablas']),
    summary: h(['Passkey, MFA e o bloqueio de tabelas por padrão para o usuário final.', 'Passkey, MFA and the default table lock for the end user.', 'Passkey, MFA y el bloqueo de tablas por defecto para el usuario final.']),
    steps: [
      st('security', 'auth.security', ['Segurança do App', 'App security', 'Seguridad de la app'], [
        'As regras de login que valem para os usuários FINAIS deste projeto. Cada opção é um interruptor; o botão de salvar desta área fica no fim do bloco.',
        'The sign-in rules that apply to the END users of this project. Each option is a switch; the save button of this area is at the bottom of the block.',
        'Las reglas de acceso que valen para los usuarios FINALES de este proyecto. Cada opción es un interruptor; el botón de guardar de esta área está al final del bloque.',
      ], { enterClick: 'auth.tab_permissions' }),
      st('passkey', 'auth.passkey', ['Login por biometria (Passkey)', 'Biometric sign-in (Passkey)', 'Acceso biométrico (Passkey)'], [
        'Permite entrar com FaceID, TouchID ou Windows Hello, sem digitar senha. É a opção recomendada. Você pode testar o interruptor: nada vale até salvar.',
        'Lets users sign in with FaceID, TouchID or Windows Hello, without typing a password. It is the recommended option. You can try the switch: nothing applies until you save.',
        'Permite entrar con FaceID, TouchID o Windows Hello, sin escribir la contraseña. Es la opción recomendada. Puede probar el interruptor: nada vale hasta guardar.',
      ], { interactive: true }),
      st('mfa', 'auth.mfa', ['Autenticação multifator (MFA)', 'Multi-factor authentication (MFA)', 'Autenticación multifactor (MFA)'], [
        'Exige que cada usuário final configure um aplicativo autenticador (Microsoft ou Google) e informe um código de 6 dígitos ao entrar. Mais segurança, um passo a mais no login.',
        'Requires each end user to set up an authenticator app (Microsoft or Google) and enter a 6-digit code when signing in. More security, one extra sign-in step.',
        'Exige que cada usuario final configure una aplicación autenticadora (Microsoft o Google) e informe un código de 6 dígitos al entrar. Más seguridad, un paso más al acceder.',
      ], { interactive: true }),
      st('security-save', 'auth.security_save', ['Salvar as políticas', 'Save the policies', 'Guardar las políticas'], [
        '"Salvar Políticas de Segurança" grava Passkey e MFA no projeto e passa a valer para os usuários finais. É um salvar só desta área.',
        '"Save Security Policies" stores Passkey and MFA in the project and starts applying to end users. It is a save for this area only.',
        '"Guardar Políticas de Seguridad" guarda Passkey y MFA en el proyecto y pasa a valer para los usuarios finales. Es un guardado solo de esta área.',
      ]),
      st('table-access', 'auth.table_access', ['Acesso do usuário final às tabelas', 'End user access to tables', 'Acceso del usuario final a las tablas'], [
        'Define o que acontece com as tabelas em que você ainda não configurou nada. Desligado: todas ficam abertas ao usuário final, cada uma com as suas permissões e regras por linha. Ligado: só as tabelas liberadas ficam acessíveis; as demais respondem vazias e não aceitam gravação.',
        'Defines what happens to the tables you have not configured yet. Off: all are open to the end user, each with its own permissions and row rules. On: only the released tables are accessible; the others answer empty and accept no writes.',
        'Define qué pasa con las tablas que aún no configuró. Apagado: todas quedan abiertas al usuario final, cada una con sus permisos y reglas por fila. Encendido: solo las tablas liberadas quedan accesibles; las demás responden vacías y no aceptan escritura.',
      ]),
      st('table-toggle', 'auth.table_access_toggle', ['Bloquear tabelas por padrão', 'Lock tables by default', 'Bloquear tablas por defecto'], [
        'Marque "Bloquear tabelas por padrão" para ver as opções de liberação. É a postura mais segura: ninguém acessa uma tabela que você não liberou de propósito. Pode desmarcar depois; nada vale até salvar.',
        'Check "Lock tables by default" to see the release options. It is the safest stance: nobody reaches a table you did not release on purpose. You can uncheck it later; nothing applies until you save.',
        'Marque "Bloquear tablas por defecto" para ver las opciones de liberación. Es la postura más segura: nadie accede a una tabla que no liberó a propósito. Puede desmarcar después; nada vale hasta guardar.',
      ], {
        interactive: true,
        completeWhen: { id: 'auth.table_access', check: 'attr', attr: 'data-help-state', equals: 'closed' },
        waitingHint: h(['Marque "Bloquear tabelas por padrão" para continuar (desmarque no fim se não quiser bloquear).', 'Check "Lock tables by default" to continue (uncheck it at the end if you do not want to lock).', 'Marque "Bloquear tablas por defecto" para continuar (desmarque al final si no quiere bloquear).']),
      }),
      st('table-bulk', 'auth.table_access_bulk', ['Liberar ou fechar tudo', 'Release or close all', 'Liberar o cerrar todo'], [
        'Atalhos para liberar todas as tabelas de uma vez ou fechar todas. Depois ajuste uma a uma na lista abaixo.',
        'Shortcuts to release all tables at once or close all of them. Then adjust one by one in the list below.',
        'Atajos para liberar todas las tablas de una vez o cerrar todas. Después ajuste una por una en la lista de abajo.',
      ], { skipIfMissing: true }),
      st('table-list', 'auth.table_access_list', ['Tabelas liberadas', 'Released tables', 'Tablas liberadas'], [
        'Marque as tabelas que o usuário final pode usar. Libere também as tabelas ligadas por relação às telas, senão elas aparecem vazias. Cada tabela liberada continua obedecendo às suas permissões e regras por linha.',
        'Check the tables the end user may use. Also release the tables linked by relation to your screens, otherwise they show empty. Each released table still obeys its permissions and row rules.',
        'Marque las tablas que el usuario final puede usar. Libere también las tablas ligadas por relación a sus pantallas, si no aparecen vacías. Cada tabla liberada sigue obedeciendo sus permisos y reglas por fila.',
      ], { skipIfMissing: true }),
      st('table-save', 'auth.table_access_save', ['Salvar', 'Save', 'Guardar'], [
        'Este botão salva a tela de login inteira, junto com a estratégia e a personalização visual. Se estava só explorando, desmarque o bloqueio antes de salvar.',
        'This button saves the whole sign-in screen, together with the strategy and the visual customization. If you were only exploring, uncheck the lock before saving.',
        'Este botón guarda la pantalla de acceso completa, junto con la estrategia y la personalización visual. Si solo estaba explorando, desmarque el bloqueo antes de guardar.',
      ]),
    ],
  },

  // ───────────────────────── estratégia: Managed Auth ─────────────────────────
  {
    id: 'auth-estrategia-managed',
    route: AUTH,
    freeClicks: true,
    title: h(['Estratégia: Managed Auth', 'Strategy: Managed Auth', 'Estrategia: Managed Auth']),
    summary: h(['O MetaBuilder guarda os usuários do app em uma base isolada. A opção mais rápida.', 'MetaBuilder keeps the app users in an isolated database. The fastest option.', 'MetaBuilder guarda los usuarios de la app en una base aislada. La opción más rápida.']),
    steps: [
      st('pick', 'auth.strategies', ['Escolha Managed Auth', 'Pick Managed Auth', 'Elija Managed Auth'], [
        'Clique no cartão "Managed Auth". O MetaBuilder gerencia os usuários em uma base de dados isolada: rápido e fácil, sem precisar de uma tabela de usuários sua.',
        'Click the "Managed Auth" card. MetaBuilder manages the users in an isolated database: fast and easy, with no need for a users table of your own.',
        'Haga clic en la tarjeta "Managed Auth". MetaBuilder gestiona los usuarios en una base de datos aislada: rápido y fácil, sin necesitar una tabla de usuarios propia.',
      ], { enterClick: 'auth.tab_strategy', interactive: true, completeWhen: picked('managed'), waitingHint: pickHint(['Managed Auth', 'Managed Auth', 'Managed Auth']) }),
      st('panel', 'auth.managed_panel', ['O que acontece', 'What happens', 'Qué ocurre'], [
        'Com esta estratégia criamos automaticamente a tabela e as APIs de login e registro. Nenhuma configuração extra é necessária.',
        'With this strategy we automatically create the table and the sign-in and sign-up APIs. No extra setup is needed.',
        'Con esta estrategia creamos automáticamente la tabla y las APIs de acceso y registro. No hace falta ninguna configuración extra.',
      ]),
      st('signup', 'auth.signup', ['Permitir cadastro', 'Allow sign-up', 'Permitir registro'], [
        'Liga o link "Criar conta" no portal de login, para os próprios usuários se cadastrarem. Deixe desligado se quiser controlar quem entra.',
        'Turns on the "Create account" link on the sign-in portal, so users can register themselves. Leave it off if you want to control who gets in.',
        'Activa el enlace "Crear cuenta" en el portal de acceso, para que los propios usuarios se registren. Déjelo apagado si quiere controlar quién entra.',
      ], { interactive: true }),
      st('save', 'auth.save', ['Salvar', 'Save', 'Guardar'], [
        'A estratégia só vale depois de salvar. Em apps já publicados, trocar de estratégia muda a forma de entrar de todos os usuários.',
        'The strategy only applies after saving. On already published apps, changing strategy changes how every user signs in.',
        'La estrategia solo vale después de guardar. En apps ya publicadas, cambiar de estrategia cambia la forma de entrar de todos los usuarios.',
      ]),
    ],
  },

  // ───────────────────────── estratégia: banco legado ─────────────────────────
  {
    id: 'auth-estrategia-banco-legado',
    route: AUTH,
    freeClicks: true,
    title: h(['Estratégia: banco legado', 'Strategy: legacy database', 'Estrategia: base heredada']),
    summary: h(['O login é validado na SUA tabela de usuários, pelo Agente CLI. Mapeie as colunas e, se quiser, os grupos.', 'Sign-in is validated against YOUR users table, through the CLI Agent. Map the columns and, if you want, the groups.', 'El acceso se valida en SU tabla de usuarios, por el Agente CLI. Mapee las columnas y, si quiere, los grupos.']),
    steps: [
      st('pick', 'auth.strategies', ['Escolha o banco legado', 'Pick the legacy database', 'Elija la base heredada'], [
        'Clique no cartão do banco legado. O Agente CLI valida o login comparando com a SUA tabela de usuários sincronizada. Aparecem os campos de mapeamento logo abaixo.',
        'Click the legacy database card. The CLI Agent validates sign-in by comparing against YOUR synced users table. The mapping fields appear right below.',
        'Haga clic en la tarjeta de la base heredada. El Agente CLI valida el acceso comparando con SU tabla de usuarios sincronizada. Los campos de mapeo aparecen justo debajo.',
      ], { enterClick: 'auth.tab_strategy', interactive: true, completeWhen: picked('database'), waitingHint: pickHint(['Banco legado', 'Legacy database', 'Base heredada']) }),
      st('table', 'auth.db_table', ['Tabela de usuários', 'Users table', 'Tabla de usuarios'], [
        'Escolha a tabela sincronizada onde ficam os logins dos seus usuários.',
        'Pick the synced table where your users sign-in data lives.',
        'Elija la tabla sincronizada donde están los accesos de sus usuarios.',
      ], { interactive: true }),
      st('email', 'auth.db_email', ['Coluna do e-mail (login)', 'E-mail column (login)', 'Columna del correo (acceso)'], [
        'A coluna que guarda o e-mail ou o identificador que a pessoa digita para entrar.',
        'The column that holds the e-mail or the identifier the person types to sign in.',
        'La columna que guarda el correo o el identificador que la persona escribe para entrar.',
      ], { interactive: true }),
      st('display', 'auth.db_display', ['Coluna de exibição (opcional)', 'Display column (optional)', 'Columna de visualización (opcional)'], [
        'O nome que o app mostra para a pessoa depois do login. Se deixar em "Padrão Automático", o app escolhe sozinho.',
        'The name the app shows to the person after sign-in. If you leave "Automatic default", the app picks one by itself.',
        'El nombre que la app muestra a la persona después del acceso. Si lo deja en "Predeterminado automático", la app elige sola.',
      ], { interactive: true }),
      st('password', 'auth.db_password', ['Coluna da senha', 'Password column', 'Columna de la contraseña'], [
        'A coluna onde está a senha (ou o hash dela) na sua tabela. O app nunca mostra esse valor.',
        'The column where the password (or its hash) is in your table. The app never shows this value.',
        'La columna donde está la contraseña (o su hash) en su tabla. La app nunca muestra ese valor.',
      ], { interactive: true }),
      st('hash', 'auth.db_hash', ['Formato do hash', 'Hash format', 'Formato del hash'], [
        'Como a senha está guardada: bcrypt (recomendado), MD5, SHA-256 ou texto puro. Precisa ser igual ao que o seu sistema usa, senão ninguém consegue entrar. Evite MD5 e texto puro em produção.',
        'How the password is stored: bcrypt (recommended), MD5, SHA-256 or plain text. It must match what your system uses, otherwise nobody can sign in. Avoid MD5 and plain text in production.',
        'Cómo está guardada la contraseña: bcrypt (recomendado), MD5, SHA-256 o texto plano. Debe coincidir con lo que usa su sistema, si no nadie puede entrar. Evite MD5 y texto plano en producción.',
      ], { interactive: true }),
      st('sync', 'auth.legacy_sync', ['Sincronizar grupos de acesso legado', 'Sync legacy access groups', 'Sincronizar grupos de acceso heredados'], [
        'Liga a leitura dos grupos (papéis) que já existem no seu banco, para você gerenciar as permissões aqui no Studio sem recriar tudo. Ao ligar, aparecem os campos de mapeamento dos grupos; ao desligar, eles somem e os próximos passos são pulados.',
        'Turns on reading the groups (roles) that already exist in your database, so you manage permissions here in Studio without recreating everything. When on, the group mapping fields appear; when off, they disappear and the next steps are skipped.',
        'Activa la lectura de los grupos (roles) que ya existen en su base, para gestionar los permisos aquí en el Studio sin recrear todo. Al activarlo, aparecen los campos de mapeo de los grupos; al desactivarlo, desaparecen y los próximos pasos se omiten.',
      ], { interactive: true }),
      st('groups', 'auth.legacy_groups_fields', ['Tabela e coluna dos grupos', 'Groups table and column', 'Tabla y columna de los grupos'], [
        'Escolha a tabela de grupos/roles e a coluna com o nome de cada grupo. Esses nomes passam a aparecer na aba Grupos de Acesso.',
        'Pick the groups/roles table and the column holding each group name. Those names then show up in the Access Groups tab.',
        'Elija la tabla de grupos/roles y la columna con el nombre de cada grupo. Esos nombres pasan a aparecer en la pestaña Grupos de Acceso.',
      ], { skipIfMissing: true }),
      st('rel', 'auth.legacy_rel_type', ['Como o usuário se liga ao grupo', 'How the user links to the group', 'Cómo se liga el usuario al grupo'], [
        'Coluna direta na tabela de usuários (ex.: role_id): um grupo por usuário. Tabela intermediária N:N (ex.: user_roles): um usuário em vários grupos; aí você informa a tabela e as colunas de user ID e role ID.',
        'Direct column in the users table (e.g. role_id): one group per user. N:N link table (e.g. user_roles): a user in several groups; then you set the table and the user ID and role ID columns.',
        'Columna directa en la tabla de usuarios (ej.: role_id): un grupo por usuario. Tabla intermedia N:N (ej.: user_roles): un usuario en varios grupos; entonces informa la tabla y las columnas de user ID y role ID.',
      ], { skipIfMissing: true, interactive: true }),
      st('rel-fields', 'auth.legacy_rel_fields', ['Colunas da ligação', 'Link columns', 'Columnas del vínculo'], [
        'Aqui você diz ONDE está a ligação. Com "coluna direta", escolha a coluna da tabela de usuários que guarda o grupo (ex.: role_id). Com "tabela intermediária N:N", escolha a tabela de ligação e, nela, a coluna do usuário (user ID) e a do grupo (role ID).',
        'Here you say WHERE the link is. With "direct column", pick the users table column that holds the group (e.g. role_id). With "N:N link table", pick the link table and, in it, the user column (user ID) and the group column (role ID).',
        'Aquí dice DÓNDE está el vínculo. Con "columna directa", elija la columna de la tabla de usuarios que guarda el grupo (ej.: role_id). Con "tabla intermedia N:N", elija la tabla de enlace y, en ella, la columna del usuario (user ID) y la del grupo (role ID).',
      ], { skipIfMissing: true }),
      st('save', 'auth.save', ['Salvar', 'Save', 'Guardar'], [
        'Salve para valer. Depois, confira na aba Gestão de Usuários se a lista carrega: ela depende do Agente CLI online e do mapeamento correto das colunas.',
        'Save to apply. Then check in the User Management tab that the list loads: it depends on the CLI Agent being online and the columns being mapped correctly.',
        'Guarde para que valga. Después compruebe en la pestaña Gestión de Usuarios que la lista carga: depende de que el Agente CLI esté en línea y de las columnas bien mapeadas.',
      ]),
    ],
  },

  // ───────────────────────── estratégia: LDAP ─────────────────────────
  {
    id: 'auth-estrategia-ldap',
    route: AUTH,
    freeClicks: true,
    title: h(['Estratégia: LDAP / Active Directory', 'Strategy: LDAP / Active Directory', 'Estrategia: LDAP / Active Directory']),
    summary: h(['Login validado no Active Directory do cliente. A configuração fica no arquivo do Agente CLI, não nesta tela.', 'Sign-in validated against the customer Active Directory. The setup lives in the CLI Agent file, not on this screen.', 'Acceso validado en el Active Directory del cliente. La configuración está en el archivo del Agente CLI, no en esta pantalla.']),
    steps: [
      st('pick', 'auth.strategies', ['Escolha LDAP / AD', 'Pick LDAP / AD', 'Elija LDAP / AD'], [
        'Clique no cartão "LDAP / AD": integração corporativa nativa, com a validação feita no Active Directory do cliente.',
        'Click the "LDAP / AD" card: native corporate integration, with validation done in the customer Active Directory.',
        'Haga clic en la tarjeta "LDAP / AD": integración corporativa nativa, con la validación hecha en el Active Directory del cliente.',
      ], { enterClick: 'auth.tab_strategy', interactive: true, completeWhen: picked('ldap'), waitingHint: pickHint(['LDAP / AD', 'LDAP / AD', 'LDAP / AD']) }),
      st('info', 'auth.ldap_info', ['Configuração fora do navegador', 'Setup outside the browser', 'Configuración fuera del navegador'], [
        'Por segurança, a URL, o Base DN e as credenciais do AD NÃO são pedidos nesta tela. Você configura o bloco "ldap" no arquivo metabuilder.config.json do Agente CLI, na máquina que alcança o AD.',
        'For security, the AD URL, Base DN and credentials are NOT asked on this screen. You set up the "ldap" block in the metabuilder.config.json file of the CLI Agent, on the machine that reaches the AD.',
        'Por seguridad, la URL, el Base DN y las credenciales del AD NO se piden en esta pantalla. Usted configura el bloque "ldap" en el archivo metabuilder.config.json del Agente CLI, en la máquina que alcanza el AD.',
      ]),
      st('signup', 'auth.signup', ['Permitir auto-cadastro', 'Allow self sign-up', 'Permitir autorregistro'], [
        "O interruptor \"Permitir Auto-cadastro\" mostra o link \"Criar conta\" no portal de login, para a pessoa criar a própria conta. Com LDAP/AD os usuários costumam já existir no diretório do cliente, então em geral fica desligado. Você pode testar o interruptor: nada vale até salvar.",
        "The \"Allow Self Sign-up\" switch shows the \"Create account\" link on the sign-in portal, so people can create their own account. With LDAP/AD users usually already exist in the customer directory, so it is normally off. You can try the switch: nothing applies until you save.",
        "El interruptor \"Permitir Autorregistro\" muestra el enlace \"Crear cuenta\" en el portal de acceso, para que la persona cree su propia cuenta. Con LDAP/AD los usuarios suelen existir ya en el directorio del cliente, así que en general queda apagado. Puede probar el interruptor: nada vale hasta guardar.",
      ]),
      st('save', 'auth.save', ['Salvar', 'Save', 'Guardar'], [
        'Salvar grava só a escolha da estratégia. O login por LDAP funciona quando o bloco "ldap" do Agente estiver configurado e o Agente estiver online.',
        'Saving stores only the strategy choice. LDAP sign-in works once the Agent "ldap" block is set up and the Agent is online.',
        'Guardar solo guarda la elección de la estrategia. El acceso por LDAP funciona cuando el bloque "ldap" del Agente esté configurado y el Agente esté en línea.',
      ]),
    ],
  },

  // ───────────────────────── estratégia: sem autenticação ─────────────────────────
  {
    id: 'auth-estrategia-sem-login',
    route: AUTH,
    freeClicks: true,
    title: h(['Estratégia: sem autenticação', 'Strategy: no authentication', 'Estrategia: sin autenticación']),
    summary: h(['Acesso livre às telas, só para enquanto o app ainda não foi ao ar.', 'Free access to the screens, only while the app is not live yet.', 'Acceso libre a las pantallas, solo mientras la app aún no salió al aire.']),
    steps: [
      st('pick', 'auth.strategies', ['Escolha "Sem autenticação"', 'Pick "No authentication"', 'Elija "Sin autenticación"'], [
        'Clique no cartão "Sem autenticação". Ele existe para quem ainda está montando o app: não exige login nenhum.',
        'Click the "No authentication" card. It exists for those still building the app: it requires no sign-in at all.',
        'Haga clic en la tarjeta "Sin autenticación". Existe para quien aún está armando la app: no exige ningún acceso.',
      ], { enterClick: 'auth.tab_strategy', interactive: true, completeWhen: picked('none'), waitingHint: pickHint(['Sem autenticação', 'No authentication', 'Sin autenticación']) }),
      st('panel', 'auth.none_panel', ['Atenção: acesso público', 'Warning: public access', 'Atención: acceso público'], [
        'Com esta estratégia o acesso a todas as telas, pastas e painéis é público e direto. Em um app exportado, os middlewares de proteção são removidos. Nunca deixe assim em produção.',
        'With this strategy access to all screens, folders and panels is public and direct. In an exported app the protection middlewares are removed. Never leave it like this in production.',
        'Con esta estrategia el acceso a todas las pantallas, carpetas y paneles es público y directo. En una app exportada se quitan los middlewares de protección. Nunca lo deje así en producción.',
      ]),
      st('signup', 'auth.signup', ['Permitir auto-cadastro', 'Allow self sign-up', 'Permitir autorregistro'], [
        "O interruptor \"Permitir Auto-cadastro\" mostra o link \"Criar conta\" no portal de login. Sem autenticação não há login, então o link não tem uso e costuma ficar desligado. Você pode testar o interruptor: nada vale até salvar.",
        "The \"Allow Self Sign-up\" switch shows the \"Create account\" link on the sign-in portal. With no authentication there is no sign-in, so the link has no use and is normally off. You can try the switch: nothing applies until you save.",
        "El interruptor \"Permitir Autorregistro\" muestra el enlace \"Crear cuenta\" en el portal de acceso. Sin autenticación no hay acceso, así que el enlace no tiene uso y suele quedar apagado. Puede probar el interruptor: nada vale hasta guardar.",
      ]),
      st('save', 'auth.save', ['Salvar', 'Save', 'Guardar'], [
        'Só vale depois de salvar. Antes de publicar para usuários reais, volte aqui e escolha uma das outras estratégias.',
        'It only applies after saving. Before publishing to real users, come back here and pick one of the other strategies.',
        'Solo vale después de guardar. Antes de publicar para usuarios reales, vuelva aquí y elija una de las otras estrategias.',
      ]),
    ],
  },

  // ───────────────────────── personalização visual ─────────────────────────
  {
    id: 'auth-personalizacao-visual',
    route: AUTH,
    freeClicks: true,
    title: h(['Personalização visual do login', 'Sign-in visual customization', 'Personalización visual del acceso']),
    summary: h(['Logotipo, cores, tema, textos, rótulos e botão da tela de login, com prévia ao vivo.', 'Logo, colors, theme, texts, labels and button of the sign-in screen, with a live preview.', 'Logotipo, colores, tema, textos, etiquetas y botón de la pantalla de acceso, con vista previa en vivo.']),
    steps: [
      st('identity', 'auth.visual_identity', ['Identidade e logotipo', 'Identity and logo', 'Identidad y logotipo'], [
        'URL do logotipo (uma imagem pública, começando com https://), um ícone em SVG, a cor primária e o tema padrão: escuro, claro ou automático (segue o aparelho). Pode digitar à vontade: a prévia ao lado reage na hora.',
        'Logo URL (a public image, starting with https://), an SVG icon, the primary color and the default theme: dark, light or automatic (follows the device). Type freely: the preview next to it reacts instantly.',
        'URL del logotipo (una imagen pública, que empiece con https://), un ícono en SVG, el color primario y el tema por defecto: oscuro, claro o automático (sigue el dispositivo). Escriba con libertad: la vista previa de al lado reacciona al instante.',
      ], { enterClick: 'auth.tab_visual', interactive: true }),
      st('texts', 'auth.visual_texts', ['Textos de boas-vindas', 'Welcome texts', 'Textos de bienvenida'], [
        'O título e a descrição que a pessoa lê ao abrir o login. Frases curtas funcionam melhor.',
        'The title and description the person reads when opening the sign-in. Short sentences work best.',
        'El título y la descripción que la persona lee al abrir el acceso. Las frases cortas funcionan mejor.',
      ], { interactive: true }),
      st('fields', 'auth.visual_fields', ['Campos e dicas', 'Fields and hints', 'Campos y pistas'], [
        'Os rótulos e os textos de exemplo (placeholder) dos campos de e-mail e senha, e uma mensagem de ajuda. Use a linguagem do seu usuário, por exemplo "Matrícula" no lugar de "E-mail".',
        'The labels and example texts (placeholders) of the e-mail and password fields, and a help message. Use your user language, for example "Employee ID" instead of "E-mail".',
        'Las etiquetas y los textos de ejemplo (placeholder) de los campos de correo y contraseña, y un mensaje de ayuda. Use el lenguaje de su usuario, por ejemplo "Matrícula" en lugar de "Correo".',
      ], { interactive: true }),
      st('button', 'auth.visual_button', ['Botão principal', 'Main button', 'Botón principal'], [
        'O texto e a cor do botão de entrar. Escolha uma cor com bom contraste com o fundo do tema.',
        'The text and color of the sign-in button. Pick a color with good contrast against the theme background.',
        'El texto y el color del botón de entrar. Elija un color con buen contraste con el fondo del tema.',
      ], { interactive: true }),
      st('preview', 'auth.visual_preview', ['Prévia ao vivo', 'Live preview', 'Vista previa en vivo'], [
        'Simula a tela de login do seu app com tudo o que você configurou, sem precisar publicar. Confira as cores nos dois temas antes de salvar.',
        'Simulates the sign-in screen of your app with everything you set up, without publishing. Check the colors in both themes before saving.',
        'Simula la pantalla de acceso de su app con todo lo que configuró, sin publicar. Compruebe los colores en los dos temas antes de guardar.',
      ]),
      st('save', 'auth.save', ['Salvar', 'Save', 'Guardar'], [
        'A personalização só vai para o login do app depois de salvar.',
        'The customization only reaches the app sign-in after saving.',
        'La personalización solo llega al acceso de la app después de guardar.',
      ]),
    ],
  },

  // ───────────────────────── usuários ─────────────────────────
  {
    id: 'auth-usuarios',
    route: AUTH,
    freeClicks: true,
    title: h(['Gestão de usuários: a lista', 'User management: the list', 'Gestión de usuarios: la lista']),
    summary: h(['Ver, criar, editar e excluir usuários da sua tabela, e escolher o grupo de cada um.', 'View, create, edit and delete users of your table, and pick each user group.', 'Ver, crear, editar y eliminar usuarios de su tabla, y elegir el grupo de cada uno.']),
    steps: [
      st('subtabs', 'auth.users_subtabs', ['Três visões', 'Three views', 'Tres vistas'], [
        'A aba tem três visões: Lista de Usuários, Grupos de Acesso e Permissões de Telas. Este tour mostra a lista; os outros dois têm tours próprios.',
        'The tab has three views: User List, Access Groups and Screen Permissions. This tour shows the list; the other two have their own tours.',
        'La pestaña tiene tres vistas: Lista de Usuarios, Grupos de Acceso y Permisos de Pantallas. Este recorrido muestra la lista; las otras dos tienen recorridos propios.',
      ], { enterClick: 'auth.tab_users' }),
      st('table', 'auth.users_table', ['Os usuários', 'The users', 'Los usuarios'], [
        'Cada linha é um usuário da sua tabela de usuários: nome, e-mail, grupo de acesso e as ações. Se a lista vier vazia, confira se o Agente CLI está online e se a estratégia é a de banco legado.',
        'Each row is a user of your users table: name, e-mail, access group and actions. If the list comes back empty, check that the CLI Agent is online and that the strategy is the legacy database.',
        'Cada fila es un usuario de su tabla de usuarios: nombre, correo, grupo de acceso y acciones. Si la lista llega vacía, compruebe que el Agente CLI esté en línea y que la estrategia sea la de base heredada.',
      ], { enterClick: 'auth.users_sub_list' }),
      st('group', 'auth.user_group', ['Trocar o grupo de um usuário', 'Change a user group', 'Cambiar el grupo de un usuario'], [
        'O seletor da linha troca o grupo do usuário. A troca é gravada na hora, sem botão de salvar, e vale para o próximo acesso dele. Pode escolher um grupo, mas lembre de voltar ao que estava se for só teste.',
        'The row selector changes the user group. The change is saved right away, with no save button, and applies on that user next sign-in. You can pick a group, but remember to put it back if it was only a test.',
        'El selector de la fila cambia el grupo del usuario. El cambio se guarda al instante, sin botón de guardar, y vale en el próximo acceso de ese usuario. Puede elegir un grupo, pero recuerde volver al anterior si era solo una prueba.',
      ], { skipIfMissing: true }),
      st('search', 'auth.users_search', ['Buscar', 'Search', 'Buscar'], [
        'Digite parte do nome, do e-mail ou de qualquer coluna da lista para filtrar as linhas. Apague o texto para ver todos de novo.',
        'Type part of the name, e-mail or any column of the list to filter the rows. Clear the text to see everyone again.',
        'Escriba parte del nombre, del correo o de cualquier columna de la lista para filtrar las filas. Borre el texto para ver a todos de nuevo.',
      ]),
      st('create', 'auth.user_create', ['Criar usuário', 'Create user', 'Crear usuario'], [
        'Abre um formulário com as colunas da sua tabela de usuários (sem a chave, os campos com valor padrão e as colunas de auditoria). A coluna de senha é digitada como senha. O registro é gravado no SEU banco, pelo Agente CLI. Pode abrir para conhecer e fechar sem salvar.',
        'Opens a form with the columns of your users table (without the key, the fields with a default value and the audit columns). The password column is typed as a password. The record is written to YOUR database, through the CLI Agent. You can open it to take a look and close it without saving.',
        'Abre un formulario con las columnas de su tabla de usuarios (sin la clave, los campos con valor por defecto y las columnas de auditoría). La columna de contraseña se escribe como contraseña. El registro se escribe en SU base, por el Agente CLI. Puede abrirlo para conocerlo y cerrarlo sin guardar.',
      ]),
      st('refresh', 'auth.users_refresh', ['Atualizar', 'Refresh', 'Actualizar'], [
        'Recarrega usuários, grupos e permissões. Use depois de mudar algo direto no seu banco.',
        'Reloads users, groups and permissions. Use it after changing something directly in your database.',
        'Recarga usuarios, grupos y permisos. Úselo después de cambiar algo directamente en su base.',
      ]),
      st('edit', 'auth.user_edit', ['Editar o usuário', 'Edit the user', 'Editar el usuario'], [
        'O lápis abre o mesmo formulário, já preenchido. Na coluna da senha, deixar em branco mantém a atual. Os ícones de ação só aparecem ao passar o mouse na linha; durante o tour eles ficam visíveis.',
        'The pencil opens the same form, already filled in. In the password column, leaving it blank keeps the current one. The action icons only show when you hover a row; during the tour they stay visible.',
        'El lápiz abre el mismo formulario, ya completado. En la columna de contraseña, dejarla en blanco mantiene la actual. Los íconos de acción solo aparecen al pasar el mouse por la fila; durante el recorrido quedan visibles.',
      ], { skipIfMissing: true }),
      st('delete', 'auth.user_delete', ['Excluir o usuário', 'Delete the user', 'Eliminar el usuario'], [
        'A lixeira abre uma confirmação e, se você confirmar, apaga o registro da SUA tabela, via Agente CLI. Não dá para desfazer. Pode clicar para ver a confirmação e escolher Cancelar.',
        'The trash opens a confirmation and, if you confirm, erases the record from YOUR table, through the CLI Agent. It cannot be undone. You can click to see the confirmation and choose Cancel.',
        'La papelera abre una confirmación y, si usted confirma, borra el registro de SU tabla, por el Agente CLI. No se puede deshacer. Puede hacer clic para ver la confirmación y elegir Cancelar.',
      ], { skipIfMissing: true }),
    ],
  },

  // ───────────────────────── grupos ─────────────────────────
  {
    id: 'auth-grupos',
    route: AUTH,
    freeClicks: true,
    title: h(['Grupos de acesso', 'Access groups', 'Grupos de acceso']),
    summary: h(['Criar, renomear e excluir os grupos (papéis) que recebem permissões de telas.', 'Create, rename and delete the groups (roles) that receive screen permissions.', 'Crear, renombrar y eliminar los grupos (roles) que reciben permisos de pantallas.']),
    steps: [
      st('where', 'auth.users_subtabs', ['Onde ficam os grupos', 'Where the groups are', 'Dónde están los grupos'], [
        'Grupos de Acesso é uma das visões da aba Gestão de Usuários. Um grupo (por exemplo, Vendedores ou Gerentes) reúne usuários que compartilham as mesmas permissões.',
        'Access Groups is one of the views of the User Management tab. A group (for example Sellers or Managers) gathers users that share the same permissions.',
        'Grupos de Acceso es una de las vistas de la pestaña Gestión de Usuarios. Un grupo (por ejemplo Vendedores o Gerentes) reúne usuarios que comparten los mismos permisos.',
      ], { enterClick: 'auth.tab_users' }),
      st('create', 'auth.group_create', ['Criar grupo', 'Create group', 'Crear grupo'], [
        'Clique em "Criar Grupo", dê um nome (ex.: Vendedores, Gerentes, Administradores) e salve. O grupo nasce sem restrições: depois você define o que cada grupo vê na visão Permissões de Telas.',
        'Click "Create Group", give it a name (e.g. Sellers, Managers, Administrators) and save. The group starts with no restrictions: afterwards you set what each group sees in the Screen Permissions view.',
        'Haga clic en "Crear Grupo", póngale un nombre (ej.: Vendedores, Gerentes, Administradores) y guarde. El grupo nace sin restricciones: después define lo que ve cada grupo en la vista Permisos de Pantallas.',
      ], { enterClick: 'auth.users_sub_groups' }),
      st('table', 'auth.groups_table', ['A lista de grupos', 'The group list', 'La lista de grupos'], [
        'Mostra o identificador e o nome de cada grupo.',
        'Shows the identifier and name of each group.',
        'Muestra el identificador y el nombre de cada grupo.',
      ], { skipIfMissing: true }),
      st('edit', 'auth.group_edit', ['Renomear o grupo', 'Rename the group', 'Renombrar el grupo'], [
        'O lápis troca o nome na própria linha: Enter confirma e Esc cancela. Os ícones só aparecem ao passar o mouse na linha; durante o tour eles ficam visíveis.',
        'The pencil renames in the row itself: Enter confirms and Esc cancels. The icons only show when you hover a row; during the tour they stay visible.',
        'El lápiz cambia el nombre en la propia fila: Enter confirma y Esc cancela. Los íconos solo aparecen al pasar el mouse por la fila; durante el recorrido quedan visibles.',
      ], { skipIfMissing: true }),
      st('delete', 'auth.group_delete', ['Excluir o grupo', 'Delete the group', 'Eliminar el grupo'], [
        'A lixeira pede confirmação. Excluir um grupo é irreversível: os usuários dele perdem na hora os acessos associados. Pode clicar para ver a confirmação e escolher Cancelar.',
        'The trash asks for confirmation. Deleting a group is irreversible: its users instantly lose the associated access. You can click to see the confirmation and choose Cancel.',
        'La papelera pide confirmación. Eliminar un grupo es irreversible: sus usuarios pierden al instante los accesos asociados. Puede hacer clic para ver la confirmación y elegir Cancelar.',
      ], { skipIfMissing: true }),
      st('next', undefined, ['Próximo passo', 'Next step', 'Siguiente paso'], [
        'Com os grupos criados, atribua o grupo de cada usuário na Lista de Usuários e defina o que cada grupo acessa em Permissões de Telas. Há um tour para cada um.',
        'With the groups created, assign each user group in the User List and set what each group accesses in Screen Permissions. There is a tour for each.',
        'Con los grupos creados, asigne el grupo de cada usuario en la Lista de Usuarios y defina lo que accede cada grupo en Permisos de Pantallas. Hay un recorrido para cada uno.',
      ]),
    ],
  },

  // ───────────────────────── permissões de telas ─────────────────────────
  {
    id: 'auth-permissoes-telas',
    route: AUTH,
    freeClicks: true,
    title: h(['Permissões de telas por grupo', 'Screen permissions per group', 'Permisos de pantallas por grupo']),
    summary: h(['A matriz que diz o que cada grupo pode ver e fazer em cada tela do app.', 'The matrix that says what each group can see and do on each app screen.', 'La matriz que dice qué puede ver y hacer cada grupo en cada pantalla de la app.']),
    steps: [
      st('where', 'auth.users_subtabs', ['Onde fica', 'Where it is', 'Dónde está'], [
        'A matriz fica na visão Permissões de Telas, dentro da aba Gestão de Usuários. Ela precisa de pelo menos um grupo criado.',
        'The matrix is in the Screen Permissions view, inside the User Management tab. It needs at least one group created.',
        'La matriz está en la vista Permisos de Pantallas, dentro de la pestaña Gestión de Usuarios. Necesita al menos un grupo creado.',
      ], { enterClick: 'auth.tab_users' }),
      st('help', 'auth.perm_help', ['Os três níveis', 'The three levels', 'Los tres niveles'], [
        'Nenhum: a tela some do menu e a rota é bloqueada. Leitura: abre a tela, mas não cria, edita nem exclui. Escrita: faz tudo.',
        'None: the screen disappears from the menu and the route is blocked. Read: opens the screen, but cannot create, edit or delete. Write: does everything.',
        'Ninguno: la pantalla desaparece del menú y la ruta se bloquea. Lectura: abre la pantalla, pero no crea, edita ni elimina. Escritura: hace todo.',
      ], { enterClick: 'auth.users_sub_perms' }),
      st('matrix', 'auth.perm_matrix', ['A matriz', 'The matrix', 'La matriz'], [
        'Cada linha é uma tela e cada coluna é um grupo. As telas vêm em dois blocos: Casos de Uso do Sistema (login, downloads, automações, logs) e Casos de Uso do DEV (as suas). Role para os lados se houver muitos grupos.',
        'Each row is a screen and each column is a group. Screens come in two blocks: System Use Cases (login, downloads, automations, logs) and DEV Use Cases (yours). Scroll sideways if there are many groups.',
        'Cada fila es una pantalla y cada columna es un grupo. Las pantallas vienen en dos bloques: Casos de Uso del Sistema (login, descargas, automatizaciones, logs) y Casos de Uso del DEV (los suyos). Desplácese hacia los lados si hay muchos grupos.',
      ]),
      st('levels', 'auth.perm_levels', ['Escolha o nível', 'Pick the level', 'Elija el nivel'], [
        'Clique em Nenhum, Leitura ou Escrita. Atenção: cada clique grava na hora, sem botão de salvar, e vale para os usuários daquele grupo imediatamente. A tela de Automações é diferente: um interruptor que libera ou bloqueia o acesso.',
        'Click None, Read or Write. Careful: each click is saved right away, with no save button, and applies at once to the users of that group. The Automations screen is different: a switch that allows or blocks access.',
        'Haga clic en Ninguno, Lectura o Escritura. Cuidado: cada clic se guarda al instante, sin botón de guardar, y vale de inmediato para los usuarios de ese grupo. La pantalla de Automatizaciones es distinta: un interruptor que permite o bloquea el acceso.',
      ], { skipIfMissing: true }),
    ],
  },
]
