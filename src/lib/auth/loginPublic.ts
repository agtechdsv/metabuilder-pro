/**
 * O que a tela de LOGIN de um app pode mandar ao navegador de quem ainda não entrou. A página monta tudo no servidor com a chave de
 * serviço e antes entregava as linhas inteiras (projeto, workspace e configuração de autenticação): o nome da tabela de usuários, o
 * nome da coluna de senha e o algoritmo do hash, o endereço do servidor LDAP, as tabelas de grupos, o menu inteiro do app, o
 * `owner_id` do workspace... Aqui sai só o que a tela usa para se desenhar e entrar.
 */

/** Chaves visuais da configuração (`ui_config`) que a tela de login usa. Nada de `db_*`, grupos nem `table_access`. */
export const LOGIN_VISUAL_KEYS = [
  'theme', 'bg_color', 'primary_color', 'button_color', 'button_text',
  'welcome_title', 'welcome_desc', 'email_label', 'email_placeholder', 'password_label', 'password_placeholder',
  'allow_signup', 'icon_svg', 'brand_icon', 'logo_url', 'login_tooltip',
] as const

export function publicLoginVisual(ui: unknown): Record<string, unknown> {
  const src = ui && typeof ui === 'object' ? (ui as Record<string, unknown>) : {}
  const out: Record<string, unknown> = {}
  for (const k of LOGIN_VISUAL_KEYS) if (src[k] !== undefined) out[k] = src[k]
  return out
}

/**
 * O projeto como a tela de login precisa: identidade e aparência (nome, descrição, ícone, tema) e o tema do workspace. Sem o menu
 * (`navigation`), sem ids de dono nem colunas internas. O `secret_token` só vai no modo antigo (sem relay), em que o navegador fala
 * direto com o túnel; com o relay ligado o servidor é quem fala e o token nunca sai daqui.
 */
export function publicLoginProject(project: any, relay: boolean): Record<string, unknown> {
  const ws = Array.isArray(project?.workspaces) ? project.workspaces[0] : project?.workspaces
  return {
    id: project?.id,
    name: project?.name,
    slug: project?.slug,
    description: project?.description ?? null,
    icon: project?.icon ?? null,
    theme_config: project?.theme_config ?? {},
    workspaces: ws ? { slug: ws.slug, name: ws.name, theme_config: ws.theme_config ?? {} } : null,
    ...(relay ? {} : { secret_token: project?.secret_token }),
  }
}

/**
 * A configuração de autenticação que vai ao navegador. Com o relay (o normal) o servidor valida o login sozinho e a tela só precisa do
 * tipo de login e da coluna do nome de exibição. Sem o relay (modo antigo) a tela manda a configuração ao túnel, então ela inteira
 * precisa ir: é uma das razões para o relay ficar ligado.
 */
export function publicLoginAuth(auth: any, relay: boolean): Record<string, unknown> {
  if (!relay) return auth
  return { auth_type: auth?.auth_type, db_display_name_column: auth?.db_display_name_column || '' }
}
