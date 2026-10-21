/** O nome da pasta do projeto na IDE Local: o slug do projeto, ou a pasta própria do dev quando a padrão é de outro login (veja projectIdentity.ts). */
export interface IDETargetLike { id: string; slug: string; folderKey?: string }

export const folderKeyOf = (t: { slug: string; folderKey?: string } | null | undefined): string => (t ? t.folderKey || t.slug : '')

/** Caminho da pasta do projeto, relativo à pasta pessoal do usuário. */
export const projectRelDir = (folderKey: string): string => `AGTech/MetaBuilderPRO/${folderKey}`
