import { describe, it, expect } from 'vitest'
import { dominioReservado, txtNome, txtValor } from '../domainVerification'

describe('prova de domínio por TXT', () => {
  it('o valor é o mesmo para o domínio com e sem www, e muda com o domínio, o destino e o segredo', () => {
    const base = txtValor('www.empresa.com', 'proj-1', 's1')
    expect(txtValor('empresa.com', 'proj-1', 's1')).toBe(base)
    expect(txtValor('EMPRESA.com.', 'proj-1', 's1')).toBe(base)
    expect(txtValor('outra.com', 'proj-1', 's1')).not.toBe(base)
    expect(txtValor('empresa.com', 'proj-2', 's1')).not.toBe(base)
    expect(txtValor('empresa.com', 'proj-1', 's2')).not.toBe(base)
    expect(base).toMatch(/^mb-verify=[0-9a-f]{32}$/)
  })

  it('o registro fica em _metabuilder-verify.<domínio sem www>', () => {
    expect(txtNome('www.empresa.com')).toBe('_metabuilder-verify.empresa.com')
    expect(txtNome('teste.veritumpro.com')).toBe('_metabuilder-verify.teste.veritumpro.com')
  })

  it('domínios do sistema e de hospedagem não podem ser vinculados', () => {
    for (const d of ['metabuilderpro.com', 'www.metabuilderpro.com', 'app.metabuilderpro.com', 'x.vercel.app', 'localhost']) expect(dominioReservado(d), d).toBe(true)
    for (const d of ['veritumpro.com', 'teste.veritumpro.com', 'meumetabuilderpro.com.br']) expect(dominioReservado(d), d).toBe(false)
  })
})
