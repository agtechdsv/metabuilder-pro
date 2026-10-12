import type { GeneratorLanguage } from './i18n'

/**
 * Textos da gestão de acesso do app exportado (telas Usuários, Grupos de Acesso e Permissões de Telas, menu e mensagens),
 * nos idiomas de geração. Evite aspas simples e duplas nos textos: eles entram direto em literais do código gerado.
 */
export interface AccessDictionary {
  menu_folder: string
  users_title: string
  groups_title: string
  perms_title: string
  users_subtitle: string
  groups_subtitle: string
  perms_subtitle: string
  create_user: string
  create_group: string
  col_user: string
  col_email: string
  col_group: string
  col_actions: string
  col_id: string
  col_group_name: string
  col_screen: string
  no_group: string
  reset_password: string
  delete: string
  rename: string
  save: string
  name_optional: string
  email: string
  password: string
  new_password_for: string
  confirm_delete_user: string
  confirm_delete_group: string
  confirm_delete_group_note: string
  new_group_prompt: string
  rename_group_prompt: string
  no_users: string
  no_groups: string
  level_none: string
  level_read: string
  level_write: string
  generic_error: string
  err_session_expired: string
  err_no_access: string
  err_read_only_screen: string
  err_email_password: string
  err_new_password: string
  err_group_name: string
  err_unknown_screen: string
  err_invalid_level: string
  err_read_only_table: string
}

const DICTIONARIES: Record<GeneratorLanguage, AccessDictionary> = {
  pt: {
    menu_folder: 'Gestão de Acesso',
    users_title: 'Usuários',
    groups_title: 'Grupos de Acesso',
    perms_title: 'Permissões de Telas',
    users_subtitle: 'Quem entra no sistema e a qual grupo de acesso pertence.',
    groups_subtitle: 'Os grupos a que os usuários pertencem. As telas de cada grupo ficam em Permissões de Telas.',
    perms_subtitle: 'Nenhum: a tela some do menu e a rota é bloqueada. Leitura: abre a tela, mas não cria, edita nem exclui. Escrita: faz tudo. Vale no próximo login de cada usuário.',
    create_user: 'Criar Usuário',
    create_group: 'Criar Grupo',
    col_user: 'Usuário',
    col_email: 'E-mail',
    col_group: 'Grupo',
    col_actions: 'Ações',
    col_id: 'ID',
    col_group_name: 'Nome do grupo',
    col_screen: 'Tela',
    no_group: 'Sem grupo',
    reset_password: 'Redefinir senha',
    delete: 'Excluir',
    rename: 'Renomear',
    save: 'Salvar',
    name_optional: 'Nome (opcional)',
    email: 'E-mail',
    password: 'Senha',
    new_password_for: 'Nova senha para',
    confirm_delete_user: 'Excluir o usuário',
    confirm_delete_group: 'Excluir o grupo',
    confirm_delete_group_note: 'Os usuários dele ficam sem grupo.',
    new_group_prompt: 'Nome do novo grupo',
    rename_group_prompt: 'Novo nome do grupo',
    no_users: 'Nenhum usuário.',
    no_groups: 'Nenhum grupo.',
    level_none: 'Nenhum',
    level_read: 'Leitura',
    level_write: 'Escrita',
    generic_error: 'Não foi possível concluir.',
    err_session_expired: 'Sessão expirada. Entre novamente.',
    err_no_access: 'Você não tem acesso a esta tela.',
    err_read_only_screen: 'Seu grupo só pode consultar esta tela.',
    err_email_password: 'Informe o e-mail e a senha.',
    err_new_password: 'Informe a nova senha.',
    err_group_name: 'Informe o nome do grupo.',
    err_unknown_screen: 'Tela desconhecida.',
    err_invalid_level: 'Nível inválido.',
    err_read_only_table: 'Seu grupo de acesso só pode consultar esta tela: criar, editar e excluir não são permitidos.',
  },
  en: {
    menu_folder: 'Access Management',
    users_title: 'Users',
    groups_title: 'Access Groups',
    perms_title: 'Screen Permissions',
    users_subtitle: 'Who signs in to the system and which access group they belong to.',
    groups_subtitle: 'The groups users belong to. The screens of each group are set in Screen Permissions.',
    perms_subtitle: 'None: the screen disappears from the menu and its route is blocked. Read: opens the screen but cannot create, edit or delete. Write: full access. Applies at each user next sign-in.',
    create_user: 'Create User',
    create_group: 'Create Group',
    col_user: 'User',
    col_email: 'E-mail',
    col_group: 'Group',
    col_actions: 'Actions',
    col_id: 'ID',
    col_group_name: 'Group name',
    col_screen: 'Screen',
    no_group: 'No group',
    reset_password: 'Reset password',
    delete: 'Delete',
    rename: 'Rename',
    save: 'Save',
    name_optional: 'Name (optional)',
    email: 'E-mail',
    password: 'Password',
    new_password_for: 'New password for',
    confirm_delete_user: 'Delete the user',
    confirm_delete_group: 'Delete the group',
    confirm_delete_group_note: 'Its users are left without a group.',
    new_group_prompt: 'New group name',
    rename_group_prompt: 'New name for the group',
    no_users: 'No users.',
    no_groups: 'No groups.',
    level_none: 'None',
    level_read: 'Read',
    level_write: 'Write',
    generic_error: 'Could not complete the action.',
    err_session_expired: 'Session expired. Please sign in again.',
    err_no_access: 'You do not have access to this screen.',
    err_read_only_screen: 'Your group can only view this screen.',
    err_email_password: 'Enter the e-mail and the password.',
    err_new_password: 'Enter the new password.',
    err_group_name: 'Enter the group name.',
    err_unknown_screen: 'Unknown screen.',
    err_invalid_level: 'Invalid level.',
    err_read_only_table: 'Your access group can only view this screen: creating, editing and deleting are not allowed.',
  },
  es: {
    menu_folder: 'Gestión de Acceso',
    users_title: 'Usuarios',
    groups_title: 'Grupos de Acceso',
    perms_title: 'Permisos de Pantallas',
    users_subtitle: 'Quién ingresa al sistema y a qué grupo de acceso pertenece.',
    groups_subtitle: 'Los grupos a los que pertenecen los usuarios. Las pantallas de cada grupo se definen en Permisos de Pantallas.',
    perms_subtitle: 'Ninguno: la pantalla desaparece del menú y la ruta se bloquea. Lectura: abre la pantalla, pero no crea, edita ni elimina. Escritura: hace todo. Vale desde el próximo inicio de sesión de cada usuario.',
    create_user: 'Crear Usuario',
    create_group: 'Crear Grupo',
    col_user: 'Usuario',
    col_email: 'Correo electrónico',
    col_group: 'Grupo',
    col_actions: 'Acciones',
    col_id: 'ID',
    col_group_name: 'Nombre del grupo',
    col_screen: 'Pantalla',
    no_group: 'Sin grupo',
    reset_password: 'Restablecer contraseña',
    delete: 'Eliminar',
    rename: 'Renombrar',
    save: 'Guardar',
    name_optional: 'Nombre (opcional)',
    email: 'Correo electrónico',
    password: 'Contraseña',
    new_password_for: 'Nueva contraseña para',
    confirm_delete_user: 'Eliminar al usuario',
    confirm_delete_group: 'Eliminar el grupo',
    confirm_delete_group_note: 'Sus usuarios quedan sin grupo.',
    new_group_prompt: 'Nombre del nuevo grupo',
    rename_group_prompt: 'Nuevo nombre del grupo',
    no_users: 'Ningún usuario.',
    no_groups: 'Ningún grupo.',
    level_none: 'Ninguno',
    level_read: 'Lectura',
    level_write: 'Escritura',
    generic_error: 'No fue posible completar la acción.',
    err_session_expired: 'Sesión expirada. Inicie sesión nuevamente.',
    err_no_access: 'No tiene acceso a esta pantalla.',
    err_read_only_screen: 'Su grupo solo puede consultar esta pantalla.',
    err_email_password: 'Informe el correo y la contraseña.',
    err_new_password: 'Informe la nueva contraseña.',
    err_group_name: 'Informe el nombre del grupo.',
    err_unknown_screen: 'Pantalla desconocida.',
    err_invalid_level: 'Nivel inválido.',
    err_read_only_table: 'Su grupo de acceso solo puede consultar esta pantalla: crear, editar y eliminar no están permitidos.',
  },
}

export function getAccessDictionary(lang?: string): AccessDictionary {
  const normalized = (lang || 'pt').toLowerCase().slice(0, 2) as GeneratorLanguage
  return DICTIONARIES[normalized] || DICTIONARIES.pt
}
