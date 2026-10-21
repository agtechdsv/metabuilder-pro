import { describe, it, expect } from 'vitest'
import { otherStack, ownerOfFolder, stackOfEntries, suggestFolderName, validateFolderName } from '../projectFolders'

describe('pasta do projeto: nome', () => {
  it('aceita nomes normais', () => {
    for (const n of ['vendas-pg', 'vendas-pg-java', 'Vendas_PG.v2', 'a', 'teste123', ' vendas-pg ']) expect(validateFolderName(n), n).toBeNull()
  })

  it('recusa vazio, muito longo e caracteres perigosos', () => {
    expect(validateFolderName('')).toBe('empty')
    expect(validateFolderName('   ')).toBe('empty')
    expect(validateFolderName('a'.repeat(61))).toBe('long')
    expect(validateFolderName('a'.repeat(60))).toBeNull()
    for (const n of ['a/b', 'a\\b', '..', 'a..b', '../x', 'C:\\x', '-x', '.x', 'x.', 'a b', 'ação', 'a:b', 'a*b', 'a?b', 'a<b', 'a|b', '"a"']) expect(validateFolderName(n), n).toBe('chars')
  })

  it('recusa os nomes reservados do Windows (com ou sem extensão)', () => {
    for (const n of ['CON', 'con', 'PRN', 'AUX', 'NUL', 'COM1', 'com9', 'LPT1', 'nul.txt']) expect(validateFolderName(n), n).toBe('reserved')
    expect(validateFolderName('console')).toBeNull()
    expect(validateFolderName('com10')).toBeNull()
  })
})

describe('pasta do projeto: sugestão', () => {
  it('sugere a pilha que falta, ou -2 quando não sabe', () => {
    expect(suggestFolderName('vendas-pg', 'java', [])).toBe('vendas-pg-java')
    expect(suggestFolderName('vendas-pg', 'node', [])).toBe('vendas-pg-node')
    expect(suggestFolderName('vendas-pg', null, [])).toBe('vendas-pg-2')
  })

  it('não repete um nome que já existe (sem diferenciar maiúsculas)', () => {
    expect(suggestFolderName('vendas-pg', 'java', ['vendas-pg', 'Vendas-PG-Java'])).toBe('vendas-pg-java-2')
    expect(suggestFolderName('vendas-pg', 'java', ['vendas-pg-java', 'vendas-pg-java-2'])).toBe('vendas-pg-java-3')
  })

  it('a sugestão é sempre um nome válido', () => {
    for (const s of ['vendas-pg', 'kika-projetos', 'a']) for (const p of ['node', 'java', null] as const) expect(validateFolderName(suggestFolderName(s, p, [])), `${s}/${p}`).toBeNull()
  })

  it('a outra pilha', () => {
    expect(otherStack('node')).toBe('java')
    expect(otherStack('java')).toBe('node')
    expect(otherStack('vazia')).toBeNull()
  })
})

describe('pasta do projeto: que pilha tem', () => {
  it('reconhece Node, Java, vazia e desconhecida pelo que há na raiz', () => {
    expect(stackOfEntries(['app', 'components', 'package.json', '.git', 'Dockerfile'])).toBe('node')
    expect(stackOfEntries(['backend', 'frontend', 'docker-compose.yml', '.git'])).toBe('java')
    expect(stackOfEntries(['.git', '.gitignore', '.metabuilder'])).toBe('vazia')
    expect(stackOfEntries([])).toBe('vazia')
    expect(stackOfEntries(['fotos', 'notas.txt'])).toBe('desconhecida')
  })

  it('Java vem antes de Node (o frontend do Java também tem package.json, mas dentro de frontend/)', () => {
    expect(stackOfEntries(['backend', 'frontend', 'package.json'])).toBe('java')
  })
})

describe('pasta do projeto: de quem é', () => {
  it('livre se não existe; do projeto ou de outro pelo marcador', () => {
    expect(ownerOfFolder(false, null, 'x', 'p1', 'vendas-pg')).toBe('free')
    expect(ownerOfFolder(true, { projectId: 'p1', slug: 'vendas-pg' }, 'vendas-pg-java', 'p1', 'vendas-pg')).toBe('this')
    expect(ownerOfFolder(true, { projectId: 'p2', slug: 'crm' }, 'vendas-pg-java', 'p1', 'vendas-pg')).toBe('other')
  })

  it('sem marcador (pasta antiga): só a de nome igual ao slug é do projeto; qualquer outra é recusada', () => {
    expect(ownerOfFolder(true, null, 'vendas-pg', 'p1', 'vendas-pg')).toBe('this')
    expect(ownerOfFolder(true, null, 'Vendas-PG', 'p1', 'vendas-pg')).toBe('this')
    expect(ownerOfFolder(true, null, 'minhas-coisas', 'p1', 'vendas-pg')).toBe('other')
  })
})
