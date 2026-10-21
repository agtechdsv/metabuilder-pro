import { describe, it, expect } from 'vitest'
import { decideFolder, ownFolderKey } from '../projectIdentity'
import { folderKeyOf, projectRelDir } from '../folderKey'

const dono = { userId: 'user-a', email: 'a@x.com', createdAt: '2026-10-20' }

describe('pasta do projeto na IDE Local: de quem é', () => {
  it('sem dono registrado, ou o dono é o próprio login: usa a pasta padrão', () => {
    expect(decideFolder(null, 'user-a', '')).toBe('default')
    expect(decideFolder(dono, 'user-a', '')).toBe('default')
    expect(decideFolder(dono, null, '')).toBe('default')
  })

  it('o dono é outro login: pergunta uma vez e depois respeita a escolha', () => {
    expect(decideFolder(dono, 'user-b', '')).toBe('ask')
    expect(decideFolder(dono, 'user-b', 'own')).toBe('own')
    expect(decideFolder(dono, 'user-b', 'shared')).toBe('default')
  })

  it('a pasta própria é o slug com o início do id do login', () => {
    expect(ownFolderKey('vendas-pg', '9de76b47-ccc3-4d94-91d3-a3d3a37afced')).toBe('vendas-pg--9de76b47')
  })

  it('o caminho usa a pasta própria quando existe, senão o slug', () => {
    expect(folderKeyOf({ slug: 'vendas-pg' })).toBe('vendas-pg')
    expect(folderKeyOf({ slug: 'vendas-pg', folderKey: 'vendas-pg--9de76b47' })).toBe('vendas-pg--9de76b47')
    expect(folderKeyOf(null)).toBe('')
    expect(projectRelDir('vendas-pg')).toBe('AGTech/MetaBuilderPRO/vendas-pg')
  })
})
