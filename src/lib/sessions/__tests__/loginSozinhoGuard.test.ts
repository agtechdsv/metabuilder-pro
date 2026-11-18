import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('sem sessão, nada mostra a tela de login sozinha', () => {
  it('sessao-ativa e session-expired levam à página inicial com o modal de entrar', () => {
    expect(read('src/app/auth/sessao-ativa/page.tsx')).toContain("redirect('/?entrar=1')")
    expect(read('src/app/auth/session-expired/page.tsx')).toContain("router.replace('/?entrar=1')")
  })

  it('a barra de navegação abre o modal com ?entrar=1 e limpa o parâmetro', () => {
    const nav = read('src/components/layout/Navbar.tsx')
    expect(nav).toContain("searchParams.get('entrar') === '1'")
    expect(nav).toContain("searchParams.delete('entrar')")
  })
})
