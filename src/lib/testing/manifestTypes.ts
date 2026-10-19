/**
 * Tipos do manifesto de testes (sem dependências: o teste do Playwright também os importa).
 * O manifesto descreve cada caso de uso como o dev o configurou no Studio. Ver manifest.ts.
 */
export const MANIFEST_VERSION = 1

/**
 * Como o app exportado faz o login e controla o acesso. Com isto o motor cria sozinho o usuário de teste no banco de teste, para qualquer projeto.
 * `type`: database (tabela de usuários do próprio banco), none (app sem login) ou outro (managed, ldap...: ainda sem suporte nos testes).
 */
export interface ManifestAuth {
  type: string
  usersTable?: string
  usersPk?: string
  emailColumn?: string
  passwordColumn?: string
  nameColumn?: string
  hash?: string
  /** só quando a gestão de acesso está ligada: grupos, vínculo usuário-grupo e permissões por tela */
  access?: {
    groupsTable: string
    groupsPk: string
    groupsNameColumn: string
    link: { kind: 'column'; column: string } | { kind: 'table'; table: string; userColumn: string; roleColumn: string }
    permsTable: string
    permsRoleColumn: string
    permsViewColumn: string
    permsLevelColumn: string
  }
}

export interface ManifestOption { value: string; label: string }

export interface ManifestField {
  /** nome da coluna no banco (é também o `name` do campo no app exportado) */
  column: string
  label: string
  dataType: string
  /** tipo de componente escolhido no Studio (Seleção, Numérico, Data/Hora, Autocomplete...) */
  componentType?: string
  /** máscara de entrada do Studio (ex.: 00.000.000/0000-00) */
  mask?: string
  /** obrigatório por configuração do Studio OU por ser coluna NOT NULL sem valor padrão */
  required: boolean
  readOnly: boolean
  isPrimaryKey: boolean
  hasFormula: boolean
  options?: ManifestOption[]
}

export interface ManifestButton { id: string; label: string; actionType: string; placement?: string }

export interface ManifestDetail {
  table: string
  label: string
  foreignKey: string
  displayMode: 'tab' | 'inline'
  fields: ManifestField[]
  subDetails: Array<{ table: string; label: string; foreignKey: string; fields: ManifestField[] }>
}

/** Regra de acesso por linha do Studio (a tabela só mostra ao usuário as linhas em que `column` é igual ao valor dele), com a exceção por valor ou grupo. */
export interface ManifestRowRule {
  column: string
  op: 'eq' | 'in' | 'related'
  source: 'user.email' | 'user.name' | 'user.attr'
  attr?: string
  bypass?: { source: string; attr?: string; values: string[] }
}

export interface ManifestView {
  slug: string
  path: string
  title: string
  logicType: string
  table: string
  primaryKey: string
  displayType: string
  actionInterface: string
  /** o que a tabela permite ao usuário final (Dados & Schemas): criar, editar e excluir */
  tablePerms?: { create: boolean; update: boolean; delete: boolean }
  /** regras por linha da tabela; ausente = todos veem todas as linhas */
  rowPolicy?: ManifestRowRule[]
  filter: ManifestField[]
  grid: ManifestField[]
  form: ManifestField[]
  buttons: ManifestButton[]
  exportFormats: string[]
  details: ManifestDetail[]
}

export interface TestManifest {
  version: number
  generatedAt: string
  project: { id: string; name: string; slug: string }
  auth?: ManifestAuth
  dbStack: string
  views: ManifestView[]
}
