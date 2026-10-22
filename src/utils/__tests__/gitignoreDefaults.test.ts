import { describe, it, expect } from 'vitest'
import { gitignoreCompleto, GITIGNORE_PADRAO } from '../gitignoreDefaults'

describe('.gitignore da pasta do projeto', () => {
  it('um .gitignore vazio ganha todas as regras padrão, incluindo a compilação do Java', () => {
    const t = gitignoreCompleto('')
    for (const r of GITIGNORE_PADRAO) expect(t.split('\n')).toContain(r)
    expect(t.split('\n')).toContain('target/')
  })

  it('um .gitignore antigo (só regras de Node) ganha as do Java sem perder o que tinha e sem repetir', () => {
    const antigo = 'node_modules\n.next\n.vscode\n.DS_Store\n*.log\n.env*\n'
    const t = gitignoreCompleto(antigo)
    expect(t.startsWith(antigo)).toBe(true)
    expect(t.split('\n').filter(l => l === 'node_modules')).toHaveLength(1)
    expect(t.split('\n')).toEqual(expect.arrayContaining(['target/', '*.class', '.idea/', '*.iml']))
  })

  it('o que o dev acrescentou fica, e rodar de novo não muda nada', () => {
    const dev = gitignoreCompleto('meu-segredo.txt\r\nnode_modules')
    expect(dev).toContain('meu-segredo.txt')
    expect(gitignoreCompleto(dev)).toBe(dev)
  })
})
